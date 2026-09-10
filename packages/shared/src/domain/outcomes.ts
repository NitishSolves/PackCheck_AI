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

export const REPORT_DISCLAIMER =
  'This report is an inspection aid. It records potential non-compliance and items that need verification. It is not a legally binding determination and does not decide legal liability.';

export function findingOutcomeWording(outcome: FindingOutcome): string {
  switch (outcome) {
    case 'POTENTIAL_NON_COMPLIANCE':
      return 'Potential non-compliance detected.';
    case 'NEEDS_VERIFICATION':
      return 'Needs verification.';
    case 'NOT_APPLICABLE':
      return 'Not applicable for the confirmed package context.';
    case 'PASS':
      return 'No potential issue detected for this rule version.';
  }
}

export function overallOutcomeFrom(
  findings: readonly { outcome: FindingOutcome }[],
): FindingOutcome | null {
  if (findings.length === 0) {
    return null;
  }
  if (findings.some((finding) => finding.outcome === 'POTENTIAL_NON_COMPLIANCE')) {
    return 'POTENTIAL_NON_COMPLIANCE';
  }
  if (findings.some((finding) => finding.outcome === 'NEEDS_VERIFICATION')) {
    return 'NEEDS_VERIFICATION';
  }
  if (findings.every((finding) => finding.outcome === 'NOT_APPLICABLE')) {
    return 'NOT_APPLICABLE';
  }
  return 'PASS';
}
