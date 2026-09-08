# PackCheck AI — Regulatory Rule Matrix v1.0

## Purpose

This is the legal-to-code implementation contract for the P0 prototype. It is **not** a claim to reproduce every provision of Indian Legal Metrology law.

Every concrete rule must be verified against the current official source before it can become ACTIVE.

## Authority hierarchy

1. Official Gazette / effective notification
2. India Code / official legislation
3. Department of Consumer Affairs
4. Official DCA FAQ/advisory/guideline
5. Verified internal structured rule

## P0 checks

| ID | Check | Core detection | Validation | Applicability |
|---|---|---|---|---|
| R01 | Manufacturer/Packer/Importer | names, addresses, role | required + context | package-dependent |
| R02 | Common/Generic Commodity Name | commodity name | required/readability | applicable context |
| R03 | Net Quantity/Number | value + unit/count | presence + normalization | package-dependent |
| R04 | Manufacture/Pre-pack/Import Date | date/month/year | conditional + parse | package-dependent |
| R05 | Country of Origin | country | conditional required | imported context |
| R06 | MRP/Retail Sale Price | MRP/value | presence + format + conflict | package-dependent |
| R07 | Unit Sale Price | unit-price value | applicability + format | package-dependent |
| R08 | Quantity ↔ Unit Price | normalized values | arithmetic consistency | where applicable |
| R09 | Best Before/Use By | date/period | conditional + parse | commodity/context dependent |
| R10 | Consumer Care | phone/email/contact | presence + basic format | applicable context |
| R11 | Declaration Readability | blur/glare/OCR confidence | review gate | all |
| R12 | Visibility/Placement | region/panel/occlusion | visual check | declaration-specific |
| R13 | Font-Size/Legibility | estimated character size | verified threshold | only when measurable |
| R14 | Cross-Panel Conflict | duplicate/conflicting values | consistency | multi-image |
| R15 | Context/Applicability/Exceptions | package context | rule selection | before dependent checks |

## Rule record requirements

Every active rule record must store:

```text
rule_code
rule_version
official_source_url
source_document
source_hash
rule_number
clause_reference
requirement_text
applicability
conditions
exceptions
validation_type
validation_config
severity
effective_from
effective_to
status
verified_by
verified_at
```

## Safety behavior

- Unknown applicability → `REVIEW`
- Poor evidence → `REVIEW`
- Draft amendment → never `ACTIVE`
- Legal ambiguity → `REVIEW`
- AI confidence ≠ legal certainty
- Do not call a field “illegal”; report potential non-compliance with evidence

## Important implementation note

R01–R10 are primarily declaration checks; R11–R13 are visual checks; R14 is a consistency check; R15 is the contextual rule-selection gate.

The exact clause, exception and effective date for each rule must be populated from the current verified official material before production use.

## Current-source verification

Before the SIH final freeze, the regulatory reviewer must re-check the official DCA/India Code sources for later effective amendments and distinguish final/effective notifications from draft proposals.
