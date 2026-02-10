import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
import { loadConfig } from "../../config/config.js";
import { textToSpeech } from "../../tts/tts.js";
import { readStringParam } from "./common.js";

const TtsToolSchema = Type.Object({
  text: Type.String({ description: "Text to convert to speech." }),
  channel: Type.Optional(
    Type.String({ description: "Optional channel id to pick output format (e.g. telegram)." }),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal("url"), Type.Literal("push")], {
      description: "Output mode. 'url' returns a path (default), 'push' streams to the client.",
    }),
  ),
  clientId: Type.Optional(Type.String({ description: "Target client ID for push mode." })),
});

export function createTtsTool(opts?: {
  config?: OpenClawConfig;
  agentChannel?: GatewayMessageChannel;
}): AnyAgentTool {
  return {
    label: "TTS",
    name: "tts",
    description:
      "Convert text to speech. Can return a file path or push audio directly to a connected client.",
    parameters: TtsToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const text = readStringParam(params, "text", { required: true });
      const channel = readStringParam(params, "channel");
      const mode = readStringParam(params, "mode"); // url or push
      const targetClientId = readStringParam(params, "clientId");

      const cfg = opts?.config ?? loadConfig();
      const result = await textToSpeech({
        text,
        cfg,
        channel: channel ?? opts?.agentChannel,
      });

      if (!result.success || !result.audioPath) {
        return {
          content: [{ type: "text", text: result.error ?? "TTS conversion failed" }],
          details: { error: result.error },
        };
      }

      if (mode === "push") {
        if (!targetClientId) {
          return {
            content: [{ type: "text", text: "Error: clientId required for push mode" }],
            details: { error: "missing_client_id" },
          };
        }
        // Push to client
        // Dynamic import to avoid cycles
        const { audioStreamChannel } = await import("../../channels/audio-stream.js");
        // We need to read the file into specific buffer to push
        const fs = await import("node:fs/promises");
        const buffer = await fs.readFile(result.audioPath);

        audioStreamChannel.pushAudio(targetClientId, buffer);

        return {
          content: [{ type: "text", text: `Audio pushed to client ${targetClientId}` }],
          details: { pushed: true, bytes: buffer.length },
        };
      }

      const lines: string[] = [];
      // Tag Telegram Opus output as a voice bubble instead of a file attachment.
      if (result.voiceCompatible) {
        lines.push("[[audio_as_voice]]");
      }
      lines.push(`MEDIA:${result.audioPath}`);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { audioPath: result.audioPath, provider: result.provider },
      };
    },
  };
}
