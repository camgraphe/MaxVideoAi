-- Unlisted, revocable links are created only by the media owner.
CREATE TABLE IF NOT EXISTS video_share_links (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('job_output', 'media_asset', 'user_asset', 'job')),
  source_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS video_share_links_active_source_idx
  ON video_share_links (user_id, source_type, source_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS video_share_links_user_created_idx
  ON video_share_links (user_id, created_at DESC);
