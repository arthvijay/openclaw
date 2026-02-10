import { randomUUID } from "node:crypto";
import type { CronJobCreate } from "./types.js";
import { CronService } from "./service.js";

export const PROACTIVE_AGENT_JOB_NAME = "proactive-assistant-loop";

export async function ensureProactiveAgentJob(service: CronService, intervalMs: number = 60000) {
  const jobs = await service.list();
  const existing = jobs.find((j) => j.name === PROACTIVE_AGENT_JOB_NAME);

  if (existing) {
    if (existing.enabled) return existing.id;
    // Enable it if disabled?
    await service.update(existing.id, { state: { lastStatus: "ok" } }); // Just touch
    return existing.id;
  }

  const job: CronJobCreate = {
    name: PROACTIVE_AGENT_JOB_NAME,
    description: "Proactive assistant loop checking for notifications to push via audio.",
    enabled: true,
    schedule: { kind: "every", everyMs: intervalMs },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message:
        "Check your tools (Calendar, Email, etc.) for any urgent notifications. If you find one, describe it briefly and use the `tts` tool with `mode='push'` and `clientId='last'` (or specific ID if known) to announce it. If nothing is urgent, do nothing.",
      bestEffortDeliver: true,
    },
  };

  const id = await service.add(job);
  return id;
}
