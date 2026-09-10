ALTER TABLE finding_evidence
  ADD COLUMN IF NOT EXISTS crop_storage_key TEXT;

ALTER TABLE findings
  DROP CONSTRAINT IF EXISTS findings_outcome_check;
ALTER TABLE findings
  ADD CONSTRAINT findings_outcome_check
  CHECK (outcome IN ('PASS', 'NEEDS_VERIFICATION', 'POTENTIAL_NON_COMPLIANCE', 'NOT_APPLICABLE'));

ALTER TABLE findings
  DROP CONSTRAINT IF EXISTS findings_engine_decision_check;
ALTER TABLE findings
  ADD CONSTRAINT findings_engine_decision_check
  CHECK (engine_decision IN ('PASS', 'REVIEW', 'ISSUE'));

ALTER TABLE findings
  DROP CONSTRAINT IF EXISTS findings_reviewer_state_check;
ALTER TABLE findings
  ADD CONSTRAINT findings_reviewer_state_check
  CHECK (reviewer_state IN ('pending', 'confirmed', 'rejected', 'not_applicable', 'edited'));

ALTER TABLE review_actions
  DROP CONSTRAINT IF EXISTS review_actions_decision_check;
ALTER TABLE review_actions
  ADD CONSTRAINT review_actions_decision_check
  CHECK (decision IN ('confirm', 'reject', 'not_applicable', 'edit'));

ALTER TABLE review_actions
  DROP CONSTRAINT IF EXISTS review_actions_edited_outcome_check;
ALTER TABLE review_actions
  ADD CONSTRAINT review_actions_edited_outcome_check
  CHECK (
    edited_outcome IS NULL
    OR edited_outcome IN ('PASS', 'NEEDS_VERIFICATION', 'POTENTIAL_NON_COMPLIANCE', 'NOT_APPLICABLE')
  );

CREATE INDEX IF NOT EXISTS reports_inspection_id_idx ON reports (inspection_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS inspections_overall_outcome_idx ON inspections (overall_outcome);
CREATE INDEX IF NOT EXISTS findings_reviewer_state_idx ON findings (reviewer_state);
CREATE INDEX IF NOT EXISTS finding_evidence_finding_id_idx ON finding_evidence (finding_id);
CREATE INDEX IF NOT EXISTS review_actions_finding_id_idx ON review_actions (finding_id);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
