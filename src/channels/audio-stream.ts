import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { AudioTranscriptionResult } from "../media-understanding/types.js";
import { resolveDefaultAgentId, resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import { resolveConfiguredModelRef, resolveThinkingDefault } from "../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  defaultTranscriptionEngine,
  type TranscriptionEngine,
} from "../media-understanding/transcription.js";

const logAudio = createSubsystemLogger("audio");

export type AudioSession = {
  id: string;
  clientId: string;
  buffer: Buffer[];
  totalBytes: number;
  lastActivity: number;
  active: boolean;
  silenceFrames: number;
  socket?: WebSocket;
};

// VAD Constants
const VAD_THRESHOLD = 0.01; // RMS threshold
const SILENCE_FRAME_COUNT = 10; // ~200-500ms depending on frame size
const MAX_BUFFER_SIZE = 2 * 1024 * 1024; // 2MB soft limit

export class AudioStreamChannel {
  private sessions = new Map<string, AudioSession>();
  private transcriptionEngine: TranscriptionEngine = defaultTranscriptionEngine;

  constructor() {}

  public getSession(clientId: string): AudioSession {
    let session = this.sessions.get(clientId);
    if (!session) {
      session = {
        id: randomUUID(),
        clientId,
        buffer: [],
        totalBytes: 0,
        lastActivity: Date.now(),
        active: false,
        silenceFrames: 0,
      };
      this.sessions.set(clientId, session);
      logAudio.info(`New audio session started client=${clientId}`);
    }
    return session;
  }

  public async handleAudioFrame(clientId: string, data: Buffer) {
    const session = this.getSession(clientId);
    session.lastActivity = Date.now();
    session.active = true;

    // 1. Calculate RMS for VAD
    const rms = this.calculateRMS(data);
    const isSilence = rms < VAD_THRESHOLD;

    if (isSilence) {
      session.silenceFrames++;
    } else {
      session.silenceFrames = 0;
    }

    // 2. Buffer data
    session.buffer.push(data);
    session.totalBytes += data.length;

    // 3. Check for Trigger (Silence after speech or overflow)
    const shouldTranscribe =
      (session.totalBytes > 0 &&
        session.silenceFrames > SILENCE_FRAME_COUNT &&
        session.totalBytes > 16000) || // > 1 sec approx @ 16khz mono
      session.totalBytes > MAX_BUFFER_SIZE;

    if (shouldTranscribe) {
      console.log(
        `[Audio/DEBUG] Triggering transcription! bytes=${session.totalBytes} silenceFrames=${session.silenceFrames}`,
      );
      const audioData = Buffer.concat(session.buffer);
      // Reset buffer immediately to capture next phrase
      session.buffer = [];
      session.totalBytes = 0;
      session.silenceFrames = 0;

      await this.processTranscription(clientId, audioData);
    }
  }

  private calculateRMS(buffer: Buffer): number {
    if (buffer.length === 0) return 0;
    // Assuming 16-bit PCM (2 bytes per sample)
    let sum = 0;
    const sampleCount = Math.floor(buffer.length / 2);
    for (let i = 0; i < sampleCount; i++) {
      const val = buffer.readInt16LE(i * 2) / 32768.0; // Normalize -1.0 to 1.0
      sum += val * val;
    }
    return Math.sqrt(sum / sampleCount);
  }

  private async processTranscription(clientId: string, audio: Buffer) {
    try {
      logAudio.debug(`Starting transcription for client=${clientId} bytes=${audio.length}`);
      const result = await this.transcriptionEngine.transcribe(audio);
      logAudio.info(`Transcription complete client=${clientId} text=${result.text}`);

      // Inject into agent loop
      const config = loadConfig();
      const agentId = resolveDefaultAgentId(config);
      const workspaceDir = resolveAgentWorkspaceDir(config, agentId);
      await ensureAgentWorkspace({ dir: workspaceDir });

      // Resolve model/provider
      const catalog = await loadModelCatalog({ config });
      const { provider, model } = resolveConfiguredModelRef({
        cfg: config,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      });
      const thinkLevel = resolveThinkingDefault({ cfg: config, provider, model, catalog });

      const runResult = await runEmbeddedPiAgent({
        sessionId: `audio-${clientId}`,
        sessionKey: `audio:${clientId}`,
        sessionFile: `${workspaceDir}/sessions/audio-${clientId}.jsonl`,
        workspaceDir,
        config,
        prompt: `[Audio Input]: ${result.text}`,
        lane: "audio",
        provider,
        model,
        thinkLevel,
        verboseLevel: "off",
        timeoutMs: 30000,
        runId: `run-${randomUUID()}`,
        disableMessageTool: true,
      });

      const outputText = runResult.payloads?.[0]?.text;
      if (outputText) {
        logAudio.info(`Agent response for ${clientId}: ${outputText}`);
        // Send back via TTS (mock or real) - For now, we assume the agent tool (tts) handles the push
        // But if the agent purely responds with text, we might want to synthesize it here.
        // For this MVP, we rely on the agent calling the 'tts' tool if it wants to speak.
      }
    } catch (err) {
      logAudio.warn(`Transcription or Agent failed client=${clientId} err=${err}`);
    }
  }

  public flush(clientId: string): Buffer | null {
    const session = this.sessions.get(clientId);
    if (!session || session.buffer.length === 0) return null;

    const fullBuffer = Buffer.concat(session.buffer);
    session.buffer = [];
    session.totalBytes = 0;
    return fullBuffer;
  }

  public registerConnection(clientId: string, socket: WebSocket) {
    const session = this.getSession(clientId);
    session.socket = socket;
    logAudio.debug(`Registered WebSocket for client=${clientId}`);
  }

  public pushAudio(clientId: string, buffer: Buffer) {
    const session = this.getSession(clientId);
    if (!session.socket) {
      logAudio.warn(`Cannot push audio: No socket for client=${clientId}`);
      return;
    }
    if (session.socket.readyState !== session.socket.OPEN) {
      logAudio.warn(`Cannot push audio: Socket not open for client=${clientId}`);
      return;
    }
    // Send raw binary
    session.socket.send(buffer);
    logAudio.debug(`Pushed ${buffer.length} bytes audio to client=${clientId}`);
  }
}

export const audioStreamChannel = new AudioStreamChannel();
