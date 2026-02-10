import type { AudioTranscriptionResult } from "./types.js";

export interface TranscriptionEngine {
  transcribe(buffer: Buffer): Promise<AudioTranscriptionResult>;
}

export class MockTranscriptionEngine implements TranscriptionEngine {
  async transcribe(buffer: Buffer): Promise<AudioTranscriptionResult> {
    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      text: "[MOCK TRANSCRIPTION] This is simulated speech from the audio buffer.",
      model: "mock-whisper",
    };
  }
}

export const defaultTranscriptionEngine = new MockTranscriptionEngine();
