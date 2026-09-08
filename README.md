# PackCheck AI — SIH 2026 PS26034

Final coding-agent documentation baseline.

## Core architecture

Official Government Sources
→ Verified Regulatory Rule Database
→ Effective-date rule selection
→ AI/CV/OCR evidence extraction
→ Deterministic compliance engine
→ Evidence + rule provenance
→ Human verification
→ Inspection report

**AI extracts evidence; the verified rule engine evaluates compliance.**

## Documents

- PRD.md — product requirements and winning MVP
- TRD.md — technical architecture and APIs
- APPFLOW.md — user and system workflows
- UIUXDESIGNBRIEF.md — screen/UX specification
- BackendSchema.md — PostgreSQL schema
- REGULATORY_RULE_MATRIX.md — P0 legal-to-code rule contract
- ImplementationPlan.md — exact build order and team execution
- AGENTS.md — rules for AI coding agents

## Regulatory sources

Primary sources:
- India Code — Legal Metrology Act, 2009
- India Code — Legal Metrology (Packaged Commodities) Rules, 2011
- Department of Consumer Affairs — Packaged Commodities rules/amendments
- Official Gazette/amendment notifications
- Official DCA FAQs/advisories where relevant

Never use an LLM's memory or a blog as the legal source of truth.
