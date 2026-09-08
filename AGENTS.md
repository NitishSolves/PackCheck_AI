# PackCheck AI — Instructions for AI Coding Agents

## Read first

Before changing code, read all files in `/docs` and this file.

## Non-negotiable rules

1. Never invent a legal requirement.
2. Never use LLM memory as legal authority.
3. Never activate an unverified rule.
4. Never treat a draft amendment as effective.
5. Never delete historical rule versions.
6. Unknown applicability must produce REVIEW.
7. Low OCR confidence must not automatically produce a legal violation.
8. Every finding must store evidence and rule version.
9. AI extracts evidence; deterministic rule engine evaluates it.
10. Use “potential non-compliance” instead of legally conclusive wording.
11. Every regulatory rule needs source + clause + effective dates.
12. When documentation and legal source conflict, flag the conflict instead of guessing.
13. Keep legal rule data separate from application code.
14. Every schema change uses a migration.
15. Every feature needs tests.
16. Do not add unrelated features without updating the PRD.

## Preferred build order

Regulatory schema → database → backend → OCR/CV → rule engine → evidence → frontend → report → tests → polish.

## Do not

- build a chatbot instead of the compliance engine;
- make an LLM output “LEGAL_VIOLATION=true”;
- hard-code one universal checklist for all package types;
- fabricate accuracy/performance results;
- silently classify unknown context as false;
- silently turn draft regulatory content into active rules.
