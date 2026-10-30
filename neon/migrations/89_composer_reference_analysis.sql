-- Explicit migration. Reuse the analysis ledger with an owned composer session;
-- never fabricate a Studio project. Existing project-scoped history stays intact.
ALTER TABLE studio_media_analysis_runs ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE studio_media_analysis_runs ADD COLUMN IF NOT EXISTS composer_session_id uuid;
ALTER TABLE studio_media_analysis_runs ADD CONSTRAINT studio_analysis_one_scope
  CHECK (num_nonnulls(project_id,composer_session_id)=1);
ALTER TABLE studio_media_analysis_runs ADD CONSTRAINT studio_analysis_composer_owner
  FOREIGN KEY(user_id,composer_session_id) REFERENCES prompt_assistance_sessions(user_id,id);
CREATE UNIQUE INDEX studio_analysis_composer_request
  ON studio_media_analysis_runs(user_id,composer_session_id,request_key) WHERE composer_session_id IS NOT NULL;
CREATE INDEX studio_analysis_composer_cache
  ON studio_media_analysis_runs(user_id,source_fingerprint,created_at) WHERE composer_session_id IS NOT NULL;

-- The selected excerpt can be an older cached analysis; do not substitute the latest one.
CREATE TABLE prompt_assistance_analysis_selections (
  user_id text NOT NULL,
  session_id uuid NOT NULL,
  source_fingerprint text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('visual','audio')),
  analysis_id uuid NOT NULL REFERENCES studio_media_analysis_runs(id),
  PRIMARY KEY(user_id,session_id,source_fingerprint,modality),
  FOREIGN KEY(user_id,session_id) REFERENCES prompt_assistance_sessions(user_id,id)
);
