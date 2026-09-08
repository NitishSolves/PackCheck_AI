# PackCheck AI — SIH 2026 PS26034

AI-assisted packaged-commodity inspection platform.

**AI extracts evidence; the verified rule engine evaluates compliance.**

## Core architecture

```text
Package image
→ image quality
→ OCR/CV
→ structured declarations
→ package context
→ verified rule selection
→ deterministic rule engine
→ evidence
→ human review
→ final result
→ report
→ history/audit
```

Legal safety:

- AI never directly decides legal compliance.
- Unverified legal information never becomes ACTIVE.
- Findings use “potential non-compliance”, not legal verdicts.

## Repository layout

```text
apps/web          React + Vite inspector UI (proxies /api → API)
apps/api          Node.js/TypeScript inspection API
apps/ai-service   Replaceable OCR/CV/quality interface (no fake detections)
packages/shared   Domain types, Zod contracts, env validation
packages/db       Drizzle schema + SQL migrations
packages/rule-engine  Deterministic operators (legal text stays in data)
regulatory/       Source registry and P0 catalog (unverified, not ACTIVE)
```

## Local development

```bash
cp .env.example .env
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Start API, AI service, and web (Vite is the preview entry; `/api` is reverse-proxied):

```bash
npm run dev
```

Individual services:

```bash
npm run dev:api
npm run dev:ai
npm run dev:web
```

Apply migrations when PostgreSQL is available:

```bash
npm run db:migrate
```

## Documents

- `docs/PRD.md` — product requirements and winning MVP
- `docs/TRD.md` — technical architecture and APIs
- `docs/APPFLOW.md` — user and system workflows
- `docs/UIUXDESIGNBRIEF.md` — screen/UX specification
- `docs/BackendSchema.md` — PostgreSQL schema
- `docs/REGULATORY_RULE_MATRIX.md` — P0 legal-to-code rule contract
- `docs/ImplementationPlan.md` — exact build order and team execution
- `AGENTS.md` — rules for AI coding agents

## Regulatory sources

Primary sources:

- India Code — Legal Metrology Act, 2009
- India Code — Legal Metrology (Packaged Commodities) Rules, 2011
- Department of Consumer Affairs — Packaged Commodities rules/amendments
- Official Gazette/amendment notifications
- Official DCA FAQs/advisories where relevant

Never use an LLM's memory or a blog as the legal source of truth.
P0 catalog identifiers in `regulatory/rules/p0-catalog.json` are not ACTIVE.
