export const FINDING_OUTCOMES = [
  'PASS',
  'NEEDS_VERIFICATION',
  'POTENTIAL_NON_COMPLIANCE',
  'NOT_APPLICABLE',
] as const;
export type FindingOutcome = (typeof FINDING_OUTCOMES)[number];

export const ENGINE_DECISIONS = ['PASS', 'REVIEW', 'ISSUE'] as const;
export type EngineDecision = (typeof ENGINE_DECISIONS)[number];

export function engineDecisionToFindingOutcome(decision: EngineDecision): FindingOutcome {
  switch (decision) {
    case 'PASS':
      return 'PASS';
    case 'REVIEW':
      return 'NEEDS_VERIFICATION';
    case 'ISSUE':
      return 'POTENTIAL_NON_COMPLIANCE';
  }
}
