import { ModelInventoryService } from "./inventory/service.js";
import { MonitoringService } from "./monitoring/service.js";
import { SafetyService } from "./safety/service.js";
import { IGovernanceService, ValidationResult, GovernanceLog } from "./types.js";

export class GovernanceService implements IGovernanceService {
  private inventoryService: ModelInventoryService;
  private safetyService: SafetyService;
  private monitoringService: MonitoringService;

  constructor(dataDir: string) {
    this.inventoryService = new ModelInventoryService(dataDir);
    this.safetyService = new SafetyService();
    this.monitoringService = new MonitoringService(dataDir);
  }

  async init() {
    await this.inventoryService.init();
    // Add default models if empty for demonstration
    if (this.inventoryService.getAllModels().length === 0) {
      await this.inventoryService.addModel({
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        deploymentDate: new Date().toISOString(),
        capabilities: ["reasoning", "vision"],
      });
    }
  }

  async validateInput(input: string, context?: Record<string, unknown>): Promise<ValidationResult> {
    const result = await this.safetyService.validateContent(input, "input");
    if (!result.allowed || result.flagged) {
      await this.monitoringService.logEvent({
        eventType: "risk_detection",
        details: { type: "input", result, context },
        modelId: context?.modelId as string,
      });
    }
    return result;
  }

  async validateOutput(
    output: string,
    context?: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const result = await this.safetyService.validateContent(output, "output");
    if (!result.allowed || result.flagged) {
      await this.monitoringService.logEvent({
        eventType: "risk_detection",
        details: { type: "output", result, context },
        modelId: context?.modelId as string,
      });
    }
    return result;
  }

  async trackModelUsage(
    modelId: string,
    tokens: number,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.monitoringService.recordPerformanceMetric(modelId, "tokens", tokens);
    await this.monitoringService.logEvent({
      eventType: "model_access",
      modelId,
      details: { tokens, context },
    });
  }

  async logEvent(event: Omit<GovernanceLog, "id" | "timestamp">): Promise<void> {
    await this.monitoringService.logEvent(event);
  }

  async getInventory() {
    return this.inventoryService.getInventoryState();
  }

  async getLogs(filter?: Partial<GovernanceLog>, limit?: number) {
    return this.monitoringService.getLogs(filter, limit);
  }
}
