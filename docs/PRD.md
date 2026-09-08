# PackCheck AI — PRD

## 1. Problem

Manual packaged-commodity inspection requires locating mandatory declarations, checking context-dependent requirements, checking readability/presentation, comparing values, documenting evidence, and producing reports.

## 2. Product

AI-assisted inspection platform for packaged commodities.

## 3. Users

- Inspector
- Reviewer/Senior Officer
- Administrator

## 4. P0 Features

1. Login/RBAC
2. Create inspection
3. Multi-image package intake
4. Image quality check
5. OCR + CV extraction
6. Structured declaration extraction
7. Package-context confirmation
8. Versioned rule selection
9. Deterministic compliance evaluation
10. Evidence-linked findings
11. Human review
12. PDF report
13. Inspection history
14. Audit trail

## 5. P0 Rules

R01 Manufacturer/Packer/Importer
R02 Common/Generic Commodity Name
R03 Net Quantity/Number
R04 Manufacture/Pre-pack/Import Date
R05 Country of Origin where applicable
R06 MRP/Retail Sale Price
R07 Unit Sale Price where applicable
R08 Quantity ↔ Unit-Sale-Price Consistency
R09 Best Before/Use By where applicable
R10 Consumer Care Details
R11 Declaration Readability
R12 Declaration Visibility/Placement
R13 Font-Size/Legibility where a verified measurable threshold exists
R14 Cross-Panel Conflict Detection
R15 Package Context + Applicability + Exceptions

## 6. Outcome states

- PASS
- NEEDS_VERIFICATION
- POTENTIAL_NON_COMPLIANCE
- NOT_APPLICABLE

## 7. Winning differentiators

- evidence-first findings;
- context-aware rules;
- cross-field and cross-panel reasoning;
- rule versions/effective dates;
- human-in-the-loop;
- audit-ready reports.

## 8. Non-goals

Do not claim legally binding decisions, perfect legal interpretation, complete legal coverage, automatic criminal liability, or automatic rule activation.

## 9. Acceptance

A real package image must flow through image quality → OCR/CV → structured fields → applicable rules → findings → evidence → reviewer → report.
