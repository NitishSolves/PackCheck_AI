ALTER TABLE inspection_images
  ADD COLUMN IF NOT EXISTS quality_metrics JSONB;

ALTER TABLE ocr_results
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE extracted_fields
  ADD COLUMN IF NOT EXISTS parse_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE extracted_fields
  ADD COLUMN IF NOT EXISTS source_occurrence_id VARCHAR(64);

ALTER TABLE package_contexts
  ADD COLUMN IF NOT EXISTS confidence REAL;

ALTER TABLE package_contexts
  ADD COLUMN IF NOT EXISTS provider VARCHAR(100);

ALTER TABLE package_contexts
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(100);

ALTER TABLE package_contexts
  ADD COLUMN IF NOT EXISTS evidence_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS inspection_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  provider VARCHAR(100) NOT NULL,
  model_version VARCHAR(100),
  confidence JSONB NOT NULL,
  failed_safely BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_extraction_runs_inspection_id_idx
  ON inspection_extraction_runs (inspection_id);

CREATE INDEX IF NOT EXISTS ocr_results_image_id_idx ON ocr_results (image_id);
CREATE INDEX IF NOT EXISTS extracted_fields_inspection_id_idx ON extracted_fields (inspection_id);
