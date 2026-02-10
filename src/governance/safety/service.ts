import { SafetyPolicy, ValidationResult, RiskAssessment } from "../types.js";

export class SafetyService {
  private policies: SafetyPolicy[];

  constructor() {
    this.policies = [
      {
        id: "default-safety",
        name: "Default Safety Policy",
        description: "Standard safety checks for corporate environments.",
        rules: [
          {
            id: "pii-email",
            checkType: "pii",
            action: "redact",
          },
          {
            id: "prompt-injection-basic",
            checkType: "prompt_injection",
            action: "block",
          },
        ],
      },
    ];
  }

  async validateContent(content: string, type: "input" | "output"): Promise<ValidationResult> {
    let result: ValidationResult = {
      allowed: true,
      modifications: undefined,
    };

    let processedContent = content;

    for (const policy of this.policies) {
      for (const rule of policy.rules) {
        if (rule.checkType === "pii") {
          // Simple regex for email PII detection
          const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
          if (emailRegex.test(processedContent)) {
            if (rule.action === "redact") {
              processedContent = processedContent.replace(emailRegex, "[REDACTED EMAIL]");
              result.flagged = true;
              result.modifications = processedContent;
              result.riskAssessment = this.createRiskAssessment("medium", ["PII detected"]);
            } else if (rule.action === "block") {
              return {
                allowed: false,
                reason: "PII detected (Email) and blocking is enabled.",
                riskAssessment: this.createRiskAssessment("high", ["PII detected (Blocking)"]),
              };
            }
          }
        } else if (rule.checkType === "prompt_injection" && type === "input") {
          // Very basic prompt injection keywords
          const injectionKeywords = [
            "ignore previous instructions",
            "system prompt",
            "you are now",
          ];
          const foundInjection = injectionKeywords.some((keyword) =>
            processedContent.toLowerCase().includes(keyword),
          );

          if (foundInjection) {
            if (rule.action === "block") {
              return {
                allowed: false,
                reason: "Potential prompt injection detected.",
                riskAssessment: this.createRiskAssessment("critical", [
                  "Prompt injection detected",
                ]),
              };
            } else {
              result.flagged = true;
              result.riskAssessment = this.createRiskAssessment("high", [
                "Prompt injection detected (Flagged)",
              ]);
            }
          }
        }
      }
    }

    return result;
  }

  private createRiskAssessment(
    level: RiskAssessment["riskLevel"],
    factors: string[],
  ): RiskAssessment {
    return {
      riskLevel: level,
      factors,
      mitigationStrategies: ["Automated redaction/blocking"],
      timestamp: new Date().toISOString(),
    };
  }
}
