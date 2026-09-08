# PackCheck AI — Implementation Plan

## Phase 1 — Regulatory foundation

- collect official sources;
- create source registry;
- verify P0 rules;
- populate rule matrix;
- seed database.

## Phase 2 — Backend

- auth/RBAC;
- migrations;
- inspection CRUD;
- image records;
- rule APIs;
- findings;
- audit.

## Phase 3 — Frontend

- dashboard;
- inspection;
- upload;
- extraction review;
- context;
- results;
- evidence;
- reports;
- history.

## Phase 4 — AI/CV

```text
image
→ quality
→ OCR
→ bounding boxes
→ structured declarations
→ confidence
```

## Phase 5 — Rule engine

Implement generic validation operators. Keep legal requirements in data, not scattered through code.

## Phase 6 — Evidence

Every finding must point to an image and location.

## Phase 7 — Reviewer

Confirm / Reject / Not Applicable / Edit + note.

## Phase 8 — Report

Inspection metadata + declarations + findings + evidence + rules + review + version data.

## Phase 9 — Evaluation

Create a 20–50 image golden dataset. Measure real metrics; never fabricate them.

## Phase 10 — Rule-version demo

Demonstrate date-based selection of rule versions. Use a verified real amendment or clearly synthetic test data.

## Team allocation

Regulatory researcher → official source/rule matrix.
AI/CV engineer → OCR/extraction/evidence.
Backend engineer → database/APIs/rule service.
Frontend engineer → inspection UI/results.
Team lead → architecture/integration/testing/demo/PPT.

## Feature freeze

P0 first. Only after end-to-end stability:
- advanced multi-piece/combination;
- advanced QR/electronic-product cases;
- automated government-source monitoring;
- multilingual expansion;
- batch analytics.

## Winning demo

Real package → scan → extract → rule evaluation → evidence → reviewer → PDF → history → versioning.

## Definition of Done

A feature needs code + test + error handling + integration + documentation.
