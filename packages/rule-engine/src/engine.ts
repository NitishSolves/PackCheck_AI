import {
  engineDecisionToFindingOutcome,
  type RuleEngine,
  type RuleEngineInput,
  type RuleEngineResult,
} from '@packcheck/shared';
import { operators } from './operators/index.js';

const ACTIVE_STATUSES = new Set(['active']);

function isEffective(rule: RuleEngineInput['selectedRuleVersions'][number], referenceDate: string): boolean {
  if (rule.effectiveFrom > referenceDate) {
    return false;
  }
  if (rule.effectiveTo && rule.effectiveTo < referenceDate) {
    return false;
  }
  return true;
}

export class DeterministicRuleEngine implements RuleEngine {
  evaluate(input: RuleEngineInput): RuleEngineResult {
    const skippedUnverifiedRules: string[] = [];
    const findings: RuleEngineResult['findings'] = [];

    for (const rule of input.selectedRuleVersions) {
      if (!ACTIVE_STATUSES.has(rule.status) || !isEffective(rule, input.referenceDate)) {
        skippedUnverifiedRules.push(rule.ruleCode);
        findings.push({
          ruleCode: rule.ruleCode,
          ruleVersionId: rule.id,
          decision: 'REVIEW',
          outcome: 'NEEDS_VERIFICATION',
          explanation:
            'No verified active rule version is selected for this inspection date. Unknown applicability must produce REVIEW.',
          detectedValue: null,
          expectedRequirement: rule.requirementText,
          evidence: [],
        });
        continue;
      }

      const operator = operators[rule.validationType];
      const result = operator(rule, input.extractedFields, input.packageContext);
      
      const targetKey = (rule.validationConfig['fieldKey'] || rule.validationConfig['leftFieldKey']) as string | undefined;
      const relevantFields = targetKey
        ? input.extractedFields.filter((f) => f.fieldKey === targetKey)
        : input.extractedFields;

      const evidenceFields = relevantFields.length > 0 ? relevantFields : input.extractedFields;
      const evidence = evidenceFields
        .filter((field) => field.imageId)
        .map((field) => ({
          imageId: field.imageId as string,
          box: field.box ?? null,
          extractedFieldKey: field.fieldKey,
          ocrSnippet: field.rawValue,
        }));

      findings.push({
        ruleCode: rule.ruleCode,
        ruleVersionId: rule.id,
        decision: result.decision,
        outcome: engineDecisionToFindingOutcome(result.decision),
        explanation: result.explanation,
        detectedValue: result.detectedValue,
        expectedRequirement: rule.requirementText,
        evidence,
      });
    }

    return { findings, skippedUnverifiedRules };
  }
}
