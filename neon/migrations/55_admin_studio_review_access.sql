-- Explicit operator migration after 50. Readers never bootstrap this table.
-- Access metadata only: no copied messages, model outputs, media links or credentials.
CREATE TABLE IF NOT EXISTS admin_studio_review_access (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 128),
  project_id text NOT NULL CHECK (length(project_id) BETWEEN 1 AND 128),
  request_id uuid NOT NULL,
  projection_version text NOT NULL CHECK (projection_version = 'studio-review-v1'),
  accessed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS admin_studio_review_access_time ON admin_studio_review_access(accessed_at DESC);
CREATE INDEX IF NOT EXISTS studio_image_turns_admin_created ON studio_image_turns(created_at DESC, request_id DESC);
COMMENT ON TABLE admin_studio_review_access IS 'Restricted content access audit; source content retention is unchanged. No content copies or bulk exports.';
