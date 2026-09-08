CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  reference_date DATE NOT NULL,
  location_note TEXT,
  overall_outcome VARCHAR(40),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspection_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  panel_label VARCHAR(100),
  quality_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  quality_score REAL,
  quality_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES inspection_images(id),
  full_text TEXT NOT NULL,
  tokens JSONB NOT NULL,
  mean_confidence REAL NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model_version VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  image_id UUID REFERENCES inspection_images(id),
  field_key VARCHAR(120) NOT NULL,
  raw_value TEXT,
  normalized_value TEXT,
  confidence REAL NOT NULL,
  panel VARCHAR(100),
  bounding_box JSONB,
  needs_review BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE package_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL UNIQUE REFERENCES inspections(id),
  context JSONB NOT NULL,
  unknown_applicability BOOLEAN NOT NULL DEFAULT true,
  confirmed_by_user_id UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  capability VARCHAR(80) NOT NULL,
  version VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE regulatory_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  issuing_authority TEXT NOT NULL,
  official_url TEXT NOT NULL,
  document_hash VARCHAR(128),
  publication_date DATE,
  effective_date DATE,
  verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified',
  retrieved_at TIMESTAMPTZ,
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE regulatory_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code VARCHAR(100) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  rule_number VARCHAR(100),
  clause_reference VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES regulatory_rules(id),
  version_number INTEGER NOT NULL,
  source_id UUID NOT NULL REFERENCES regulatory_sources(id),
  clause_reference VARCHAR(150),
  requirement_text TEXT NOT NULL,
  applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  exceptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_type VARCHAR(60) NOT NULL,
  validation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity VARCHAR(40) NOT NULL DEFAULT 'review',
  effective_from DATE NOT NULL,
  effective_to DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version_number)
);

CREATE TABLE rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id UUID NOT NULL REFERENCES rule_versions(id),
  condition_key VARCHAR(120) NOT NULL,
  operator VARCHAR(60) NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rule_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES regulatory_sources(id),
  rule_id UUID REFERENCES regulatory_rules(id),
  proposed_change JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'proposed',
  submitted_by_user_id UUID REFERENCES users(id),
  reviewed_by_user_id UUID REFERENCES users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  rule_version_id UUID NOT NULL REFERENCES rule_versions(id),
  outcome VARCHAR(40) NOT NULL,
  engine_decision VARCHAR(20) NOT NULL,
  detected_value TEXT,
  expected_requirement TEXT NOT NULL,
  explanation TEXT NOT NULL,
  reviewer_state VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finding_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id),
  image_id UUID NOT NULL REFERENCES inspection_images(id),
  bounding_box JSONB,
  extracted_field_key VARCHAR(120),
  ocr_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id),
  reviewer_user_id UUID NOT NULL REFERENCES users(id),
  decision VARCHAR(40) NOT NULL,
  note TEXT,
  edited_outcome VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  storage_key TEXT NOT NULL,
  generated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inspection_images_inspection_id_idx ON inspection_images (inspection_id);
CREATE INDEX ocr_results_image_id_idx ON ocr_results (image_id);
CREATE INDEX extracted_fields_inspection_id_idx ON extracted_fields (inspection_id);
CREATE INDEX findings_inspection_id_idx ON findings (inspection_id);
CREATE INDEX findings_rule_version_id_idx ON findings (rule_version_id);
CREATE INDEX finding_evidence_finding_id_idx ON finding_evidence (finding_id);
CREATE INDEX review_actions_finding_id_idx ON review_actions (finding_id);
CREATE INDEX rule_versions_rule_id_idx ON rule_versions (rule_id);
CREATE INDEX rule_versions_source_id_idx ON rule_versions (source_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
