export const RULE_STATUSES = [
  'draft',
  'proposed',
  'verified',
  'scheduled',
  'active',
  'superseded',
  'withdrawn',
] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const SOURCE_VERIFICATION_STATUSES = [
  'unverified',
  'retrieved',
  'human_verified',
  'rejected',
] as const;
export type SourceVerificationStatus = (typeof SOURCE_VERIFICATION_STATUSES)[number];

export const VALIDATION_OPERATORS = [
  'FIELD_REQUIRED',
  'CONDITIONAL_REQUIRED',
  'FIELD_FORMAT',
  'DATE_PARSE',
  'READABILITY',
  'NUMERIC_CONSISTENCY',
  'CROSS_PANEL_CONSISTENCY',
] as const;
export type ValidationOperator = (typeof VALIDATION_OPERATORS)[number];

export const P0_RULE_CODES = [
  'R01',
  'R02',
  'R03',
  'R04',
  'R05',
  'R06',
  'R07',
  'R08',
  'R09',
  'R10',
  'R11',
  'R12',
  'R13',
  'R14',
  'R15',
] as const;
export type P0RuleCode = (typeof P0_RULE_CODES)[number];

export const P0_RULE_TITLES: Record<P0RuleCode, string> = {
  R01: 'Manufacturer/Packer/Importer',
  R02: 'Common/Generic Commodity Name',
  R03: 'Net Quantity/Number',
  R04: 'Manufacture/Pre-pack/Import Date',
  R05: 'Country of Origin where applicable',
  R06: 'MRP/Retail Sale Price',
  R07: 'Unit Sale Price where applicable',
  R08: 'Quantity ↔ Unit-Sale-Price Consistency',
  R09: 'Best Before/Use By where applicable',
  R10: 'Consumer Care Details',
  R11: 'Declaration Readability',
  R12: 'Declaration Visibility/Placement',
  R13: 'Font-Size/Legibility where a verified measurable threshold exists',
  R14: 'Cross-Panel Conflict Detection',
  R15: 'Package Context + Applicability + Exceptions',
};

export function canActivateRule(status: RuleStatus, verified: boolean): boolean {
  return verified && (status === 'verified' || status === 'scheduled' || status === 'active');
}
