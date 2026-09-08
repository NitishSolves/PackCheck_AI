# PackCheck AI — Backend Schema

## Core tables

users
inspections
inspection_images
ocr_results
extracted_fields
package_contexts
regulatory_sources
regulatory_rules
rule_versions
rule_conditions
rule_proposals
findings
finding_evidence
review_actions
reports
model_versions
audit_logs

## Relationships

inspections → images
inspections → extracted_fields
inspections → package_context
findings → inspections
findings → rule_versions
findings → evidence
evidence → images
review_actions → findings
rule_versions → regulatory_rules
rule_versions → regulatory_sources

## Regulatory source fields

Store title, type, issuing authority, official URL, document hash, publication/effective dates, verification status and retrieval timestamp.

## Rule version fields

Store logical rule, version number, source, clause, requirement, applicability, conditions, exceptions, validation type/config, severity, effective_from, effective_to and verification status.

## Historical invariant

Historical inspections retain the exact rule version used for evaluation. Superseded rules are never deleted.

## Minimal SQL shape

```sql
CREATE TABLE regulatory_rules (
  id UUID PRIMARY KEY,
  rule_code VARCHAR(100) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  rule_number VARCHAR(100),
  clause_reference VARCHAR(150)
);

CREATE TABLE rule_versions (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES regulatory_rules(id),
  version_number INTEGER NOT NULL,
  source_id UUID NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status VARCHAR(30) NOT NULL,
  requirement_text TEXT NOT NULL,
  validation_type VARCHAR(60) NOT NULL,
  validation_config JSONB NOT NULL DEFAULT '{}',
  UNIQUE(rule_id, version_number)
);
```
