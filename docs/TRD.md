# PackCheck AI — TRD

## Architecture

```text
React UI
  ↓
Node.js/TypeScript API
  ├── Auth/RBAC
  ├── Inspection service
  ├── Regulatory service
  ├── Report service
  └── Audit service
         ↓
PostgreSQL + Object Storage

Inspection service → AI/CV/OCR service
Regulatory service → versioned rule database
Rule engine → deterministic validation
```

## Technology

### Frontend
- React
- TypeScript
- Vite
- Tailwind or equivalent design system
- React Router
- TanStack Query

### Backend
- Node.js 20+
- TypeScript
- Express/Fastify
- Zod
- PostgreSQL
- Drizzle ORM or Prisma

### AI
Use an independently replaceable service interface:

```text
extractText(image)
detectDeclarations(image, ocr)
classifyPackage(image, metadata)
scoreImageQuality(image)
```

The compliance engine must not know which AI provider was used.

## AI boundary

AI may:
- OCR text;
- detect declaration regions;
- normalize fields;
- classify image quality;
- assist package-context classification.

AI must NOT directly declare a legal violation.

## Rule engine

Inputs:
- inspection/reference date;
- package context;
- extracted fields;
- verified active rules.

Outputs:
- rule code/version;
- PASS/REVIEW/ISSUE;
- explanation;
- evidence references.

## Generic operators

FIELD_REQUIRED
CONDITIONAL_REQUIRED
FIELD_FORMAT
DATE_PARSE
READABILITY
NUMERIC_CONSISTENCY
CROSS_PANEL_CONSISTENCY

## Regulatory versioning

Every rule version stores:
- source;
- clause;
- applicability;
- exceptions;
- effective_from;
- effective_to;
- status;
- verification metadata.

Historical versions are never deleted.

## API groups

/auth
/inspections
/images
/extractions
/findings
/rules
/regulatory-sources
/rule-proposals
/reports

## Security

- hashed passwords;
- RBAC;
- server-side authorization;
- validated image uploads;
- private evidence storage;
- audit logging;
- secrets in environment variables.

## Testing

- unit tests for rule operators;
- integration tests from OCR to engine;
- golden image dataset;
- regression suite for rule changes;
- measured precision/recall/F1 and processing time.
