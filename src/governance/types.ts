import { z } from "zod";

export const ModelInventorySchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      provider: z.string(),
      version: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
      trainingDataLineage: z.string().optional(),
      deploymentDate: z.string().optional(),
    }),
  ),
  ensembles: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        modelIds: z.array(z.string()),
      }),
    )
    .optional(),
});

export type ModelInventory = z.infer<typeof ModelInventorySchema>;

export const RiskAssessmentSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  factors: z.array(z.string()),
  mitigationStrategies: z.array(z.string()),
  timestamp: z.string(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const SafetyPolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rules: z.array(
    z.object({
      id: z.string(),
      checkType: z.enum(["prompt_injection", "pii", "toxicity", "bias", "custom"]),
      threshold: z.number().optional(),
      action: z.enum(["block", "flag", "redact", "log_only"]),
    }),
  ),
});

export type SafetyPolicy = z.infer<typeof SafetyPolicySchema>;

export const GovernanceLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.enum(["model_access", "risk_detection", "policy_violation", "performance_metric"]),
  details: z.any(),
  actorId: z.string().optional(),
  modelId: z.string().optional(),
});

export type GovernanceLog = z.infer<typeof GovernanceLogSchema>;

export interface IGovernanceService {
  validateInput(input: string, context?: Record<string, unknown>): Promise<ValidationResult>;
  validateOutput(output: string, context?: Record<string, unknown>): Promise<ValidationResult>;
  trackModelUsage(
    modelId: string,
    tokens: number,
    context?: Record<string, unknown>,
  ): Promise<void>;
  logEvent(event: Omit<GovernanceLog, "id" | "timestamp">): Promise<void>;
}

export type ValidationResult = {
  allowed: boolean;
  flagged?: boolean;
  reason?: string;
  modifications?: string; // e.g. redacted PII
  riskAssessment?: RiskAssessment;
};
