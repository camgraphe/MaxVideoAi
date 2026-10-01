-- Apply explicitly after migration 50, before enabling the metered image pilot.
-- This is provider usage evidence, not the customer charge ledger.
CREATE TABLE IF NOT EXISTS studio_image_model_usage (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  request_id UUID NOT NULL,
  lease_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'started' CHECK (state IN ('started', 'reported', 'unknown')),
  response_id TEXT UNIQUE,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, project_id, request_id, lease_id),
  FOREIGN KEY (user_id, project_id, request_id) REFERENCES studio_image_turns(user_id, project_id, request_id) ON DELETE CASCADE,
  CHECK ((state = 'reported') = (response_id IS NOT NULL AND response_json IS NOT NULL)),
  CHECK (response_json IS NULL OR jsonb_typeof(response_json) = 'object')
);
CREATE INDEX IF NOT EXISTS studio_image_model_usage_project ON studio_image_model_usage(user_id, project_id, created_at);
