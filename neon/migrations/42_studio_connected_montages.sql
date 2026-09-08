ALTER TABLE studio_projects
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS persistence_mode TEXT NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'studio_projects_revision_nonnegative' AND conrelid = 'studio_projects'::regclass
  ) THEN
    ALTER TABLE studio_projects
      ADD CONSTRAINT studio_projects_revision_nonnegative CHECK (revision >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'studio_projects_persistence_mode_valid' AND conrelid = 'studio_projects'::regclass
  ) THEN
    ALTER TABLE studio_projects
      ADD CONSTRAINT studio_projects_persistence_mode_valid
      CHECK (persistence_mode IN ('legacy', 'connected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS studio_project_commands (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  command_kind TEXT NOT NULL,
  command_version INTEGER NOT NULL CHECK (command_version > 0),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  project_id TEXT NOT NULL REFERENCES studio_projects(id),
  sequence_id TEXT NOT NULL REFERENCES studio_sequences(id),
  request_payload JSONB NOT NULL,
  safe_result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, command_kind, command_version, idempotency_key)
);

CREATE INDEX IF NOT EXISTS studio_project_commands_project_idx
  ON studio_project_commands (user_id, project_id);
