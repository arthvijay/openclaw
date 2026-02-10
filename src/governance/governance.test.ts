import * as fs from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GovernanceService } from "./service.js";

describe("GovernanceService Integration", () => {
  let tmpDir: string;
  let service: GovernanceService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "governance-test-"));
    service = new GovernanceService(tmpDir);
    await service.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should initialize with default inventory", async () => {
    const inventory = await service.getInventory();
    expect(inventory.models.length).toBeGreaterThan(0);
    expect(inventory.models[0].id).toBe("gpt-4o");
  });

  it("should log events and retrieve them", async () => {
    const event = {
      eventType: "risk_detection" as const,
      modelId: "test-model-1",
      details: { risk: "high", reason: "test" },
    };

    await service.logEvent(event);

    // Wait a bit for file I/O if necessary, though it's awaited
    const logs = await service.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].eventType).toBe("risk_detection");
    expect(logs[0].modelId).toBe("test-model-1");
    // ID and timestamp should be generated
    expect(logs[0].id).toBeDefined();
    expect(logs[0].timestamp).toBeDefined();
  });

  it("should filter logs correctly", async () => {
    await service.logEvent({
      eventType: "risk_detection",
      modelId: "model-a",
      details: {},
    });
    await service.logEvent({
      eventType: "model_access",
      modelId: "model-b",
      details: {},
    });

    const logsA = await service.getLogs({ modelId: "model-a" });
    expect(logsA.length).toBe(1);
    expect(logsA[0].modelId).toBe("model-a");

    const logsB = await service.getLogs({ eventType: "model_access" });
    expect(logsB.length).toBe(1);
    expect(logsB[0].eventType).toBe("model_access");
  });
});
