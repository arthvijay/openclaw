import * as fs from "node:fs/promises";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { GovernanceLog, GovernanceLogSchema } from "../types.js";

export class MonitoringService {
  private logsPath: string;

  constructor(dataDir: string) {
    this.logsPath = path.join(dataDir, "governance-logs.jsonl");
  }

  async logEvent(event: Omit<GovernanceLog, "id" | "timestamp">) {
    const logEntry: GovernanceLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    const line = JSON.stringify(logEntry) + "\n";
    try {
      await fs.appendFile(this.logsPath, line, "utf-8");
    } catch (error) {
      console.error("Failed to write governance log:", error);
    }

    console.log(`[Governance] ${logEntry.eventType}:`, JSON.stringify(logEntry.details));
  }

  async getLogs(filter?: Partial<GovernanceLog>, limit: number = 100): Promise<GovernanceLog[]> {
    try {
      const content = await fs.readFile(this.logsPath, "utf-8");
      const lines = content.trim().split("\n");
      const logs: GovernanceLog[] = [];

      // Read from end for latest logs
      for (let i = lines.length - 1; i >= 0; i--) {
        if (logs.length >= limit) {
          break;
        }
        try {
          const log = JSON.parse(lines[i]);
          const parsed = GovernanceLogSchema.safeParse(log);
          if (parsed.success) {
            let matches = true;
            if (filter) {
              for (const key in filter) {
                if (
                  parsed.data[key as keyof GovernanceLog] !== filter[key as keyof GovernanceLog]
                ) {
                  matches = false;
                  break;
                }
              }
            }
            if (matches) {
              logs.push(parsed.data);
            }
          }
        } catch (e) {
          // Ignore malformed lines
        }
      }
      return logs;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return [];
      }
      console.error("Failed to read governance logs:", error);
      return [];
    }
  }

  async recordPerformanceMetric(modelId: string, metric: string, value: number) {
    await this.logEvent({
      eventType: "performance_metric",
      modelId,
      details: { metric, value },
    });
  }
}
