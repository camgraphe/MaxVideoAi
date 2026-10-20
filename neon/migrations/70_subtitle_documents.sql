-- Subtitle documents are account-owned and independent of Studio project deletion.
CREATE TABLE IF NOT EXISTS subtitle_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  source_fingerprint TEXT NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  transcription_job_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, transcription_job_id)
);
CREATE TABLE IF NOT EXISTS subtitle_document_revisions (
  document_id TEXT NOT NULL REFERENCES subtitle_documents(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  document JSONB NOT NULL,
  request_id TEXT,
  request_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(document_id, revision),
  UNIQUE(document_id, request_id),
  CHECK ((request_id IS NULL) = (request_hash IS NULL)),
  CHECK (jsonb_typeof(document) = 'object')
);
CREATE INDEX IF NOT EXISTS subtitle_documents_user_updated_idx
  ON subtitle_documents(user_id, updated_at DESC, id);
