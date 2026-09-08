import type { EngineDecision, RuleEngineInput } from '@packcheck/shared';

export type SelectedRuleVersion = RuleEngineInput['selectedRuleVersions'][number];
export type ExtractedField = RuleEngineInput['extractedFields'][number];

export type OperatorResult = {
  decision: EngineDecision;
  explanation: string;
  detectedValue: string | null;
};

export type Operator = (
  rule: SelectedRuleVersion,
  fields: ExtractedField[],
  context: Record<string, unknown>,
) => OperatorResult;
