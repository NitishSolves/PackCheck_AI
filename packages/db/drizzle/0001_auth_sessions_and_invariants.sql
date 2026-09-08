CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);

ALTER TABLE inspection_images ADD COLUMN IF NOT EXISTS byte_size INTEGER;

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS inspections_created_by_user_id_idx ON inspections (created_by_user_id);
CREATE INDEX IF NOT EXISTS inspections_status_idx ON inspections (status);
CREATE INDEX IF NOT EXISTS inspections_created_at_idx ON inspections (created_at);
CREATE INDEX IF NOT EXISTS regulatory_sources_verification_status_idx ON regulatory_sources (verification_status);
CREATE INDEX IF NOT EXISTS rule_conditions_rule_version_id_idx ON rule_conditions (rule_version_id);
CREATE INDEX IF NOT EXISTS rule_proposals_source_id_idx ON rule_proposals (source_id);

CREATE OR REPLACE FUNCTION prevent_rule_version_destructive_overwrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Historical rule versions must never be deleted';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.rule_id IS DISTINCT FROM OLD.rule_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.clause_reference IS DISTINCT FROM OLD.clause_reference
     OR NEW.requirement_text IS DISTINCT FROM OLD.requirement_text
     OR NEW.applicability IS DISTINCT FROM OLD.applicability
     OR NEW.conditions IS DISTINCT FROM OLD.conditions
     OR NEW.exceptions IS DISTINCT FROM OLD.exceptions
     OR NEW.validation_type IS DISTINCT FROM OLD.validation_type
     OR NEW.validation_config IS DISTINCT FROM OLD.validation_config
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
    RAISE EXCEPTION 'Historical rule versions must never be destructively overwritten; create a new version';
  END IF;

  IF OLD.status IN ('superseded', 'withdrawn', 'active', 'verified', 'scheduled')
     AND NEW.status IN ('draft', 'proposed') THEN
    RAISE EXCEPTION 'Verified or historical rule versions cannot be reverted to draft';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rule_versions_immutable_history ON rule_versions;
CREATE TRIGGER rule_versions_immutable_history
  BEFORE UPDATE OR DELETE ON rule_versions
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_rule_version_destructive_overwrite();
