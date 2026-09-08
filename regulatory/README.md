# Regulatory data (not application code)

Legal rule records live here and in PostgreSQL. Application code must not hard-code legal requirements.

## Invariants

- Never invent a legal requirement.
- Never activate an unverified rule.
- Never treat a draft amendment as effective.
- Never delete historical rule versions.
- Every active rule needs source, clause, and effective dates.
- Catalog entries in this folder are **not** ACTIVE.

## Layout

- `sources/registry.json` — official-source placeholders pending retrieval and human verification
- `rules/p0-catalog.json` — P0 check identifiers from the product matrix; clause/effective dates are empty until verified

Populate database rows from verified official material only. Status remains `draft` or `proposed` until a human reviewer verifies the source.
