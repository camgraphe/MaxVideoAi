-- One owned Draft and at most one final reservation. Application callers must
-- use the existing canonical quote/charge path for each distinct job.
CREATE TABLE IF NOT EXISTS seedance_draft_links (
  draft_job_id text PRIMARY KEY REFERENCES app_jobs(job_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  provider_task_id text NOT NULL UNIQUE,
  provider_model_id text NOT NULL,
  validity_started_at timestamptz NOT NULL,
  validity_start_source text NOT NULL
    CHECK (validity_start_source = 'server_request_started'),
  expires_at timestamptz NOT NULL,
  draft_state text NOT NULL DEFAULT 'pending'
    CHECK (draft_state IN ('pending', 'ready', 'failed')),
  final_job_id text UNIQUE,
  final_state text NOT NULL DEFAULT 'none'
    CHECK (final_state IN ('none', 'reserved', 'submitted', 'failed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((final_job_id IS NULL) = (final_state = 'none')),
  CHECK (expires_at > validity_started_at)
);

CREATE INDEX IF NOT EXISTS seedance_draft_links_user_state_idx
  ON seedance_draft_links(user_id, draft_state, expires_at);
