import { randomUUID } from "crypto";
import WebSocket from "ws";

const GATEWAY_URL = "ws://127.0.0.1:19001"; // Default local debug gateway
const AUTH_TOKEN = "7f8c9d0e1a2b3c4d5e6f7a8b9c0d1e2f"; // From openclaw.json

// Mock a "Wearable" client
const clientId = `wearable-${randomUUID().split("-")[0]}`;
const ws = new WebSocket(GATEWAY_URL);

console.log(`[SimMic] Connecting as ${clientId}...`);

ws.on("open", () => {
  console.log("[SimMic] Connected. Authenticating...");

  // 1. Handshake
  ws.send(
    JSON.stringify({
      type: "req",
      method: "connect",
      id: "1",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli" as any, // Cast to any to bypass strict typing locally if needed, but 'cli' is valid
          mode: "cli" as any,
          version: "1.0.0",
          platform: "linux",
          deviceFamily: "virtual",
          displayName: "Simulated Mic",
        },
        auth: {
          token: AUTH_TOKEN,
        },
      },
    }),
  );
});

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    console.log(`\n[SimMic] Received BINARY frame: ${(data as Buffer).length} bytes (Audio Push?)`);
    return;
  }

  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch (err) {
    console.log(`\n[SimMic] Received raw text: ${data}`);
    return;
  }

  if (msg.type === "res" && msg.id === "1") {
    if (msg.ok) {
      console.log("[SimMic] Auth Success! Starting Audio Stream...");
      startStreaming();
    } else {
      console.error("[SimMic] Auth Failed:", msg.error);
      process.exit(1);
    }
  } else if (msg.type === "event" && msg.event === "connect.challenge") {
    // ignore
  } else {
    console.log("[SimMic] Received:", msg);
  }
});

function startStreaming() {
  // Generate a "loud" sine wave (440Hz tone) to trigger VAD (RMS > 0.01)
  // 16kHz sample rate, 16-bit mono
  const SAMPLE_RATE = 16000;
  const CHUNK_SIZE = 3200; // 200ms (3200 samples * 2 bytes/sample = 6400 bytes)
  const FREQUENCY = 440; // Hz
  const AMPLITUDE = 15000; // ~0.5 max amplitude

  let totalChunks = 0;
  let sampleCounter = 0;

  const interval = setInterval(() => {
    const buffer = Buffer.alloc(CHUNK_SIZE * 2); // 16-bit PCM buffer

    // Cycle: Speak for 3s (15 chunks), Silence for 2s (10 chunks)
    const isSpeaking = totalChunks % 25 < 15;

    for (let i = 0; i < CHUNK_SIZE; i++) {
      let val = 0;
      if (isSpeaking) {
        const t = sampleCounter / SAMPLE_RATE;
        val = Math.floor(Math.sin(2 * Math.PI * FREQUENCY * t) * AMPLITUDE);
      }
      buffer.writeInt16LE(val, i * 2);
      sampleCounter++;
    }

    ws.send(buffer);
    process.stdout.write(isSpeaking ? "S" : "_"); // S=Speaking, _=Silence
    totalChunks++;
  }, 200);

  // Stop after 20 seconds to allow for speech + silence + response
  setTimeout(() => {
    clearInterval(interval);
    console.log("\n[SimMic] Finished streaming 20s.");
    ws.close();
    process.exit(0);
  }, 20000);
}
