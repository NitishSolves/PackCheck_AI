import { z } from 'zod';
import { ENGINE_DECISIONS, FINDING_OUTCOMES } from '../domain/outcomes.js';
import { VALIDATION_OPERATORS } from '../domain/regulatory.js';
import { boundingBoxSchema } from './ai.js';

export const evidenceRefSchema = z.object({
  imageId: z.string().uuid(),
  box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  extractedFieldKey: z.string().nullable(),
  ocrSnippet: z.string().nullable(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const ruleEngineFindingSchema = z.object({
  ruleCode: z.string(),
  ruleVersionId: z.string().uuid(),
  decision: z.enum(ENGINE_DECISIONS),
  outcome: z.enum(FINDING_OUTCOMES),
  explanation: z.string(),
  detectedValue: z.string().nullable(),
  expectedRequirement: z.string(),
  evidence: z.array(evidenceRefSchema),
});
export type RuleEngineFinding = z.infer<typeof ruleEngineFindingSchema>;

export const ruleEngineInputSchema = z.object({
  inspectionId: z.string().uuid().optional(),
  referenceDate: z.string(),
  packageContext: z.record(z.unknown()),
  extractedFields: z.array(
    z.object({
      fieldKey: z.string(),
      rawValue: z.string().nullable(),
      normalizedValue: z.string().nullable(),
      confidence: z.number(),
      panel: z.string().nullable(),
      imageId: z.string().uuid().nullable(),
      box: boundingBoxSchema.nullable().optional(),
      needsReview: z.boolean(),
    }),
  ),
  selectedRuleVersions: z.array(
    z.object({
      id: z.string().uuid(),
      ruleCode: z.string(),
      versionNumber: z.number().int(),
      requirementText: z.string(),
      validationType: z.enum(VALIDATION_OPERATORS),
      validationConfig: z.record(z.unknown()),
      applicability: z.record(z.unknown()),
      exceptions: z.record(z.unknown()),
      status: z.string(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable(),
    }),
  ),
});
export type RuleEngineInput = z.infer<typeof ruleEngineInputSchema>;

export const ruleEngineResultSchema = z.object({
  findings: z.array(ruleEngineFindingSchema),
  skippedUnverifiedRules: z.array(z.string()),
});
export type RuleEngineResult = z.infer<typeof ruleEngineResultSchema>;

export interface RuleEngine {
  evaluate(input: RuleEngineInput): RuleEngineResult;
}
