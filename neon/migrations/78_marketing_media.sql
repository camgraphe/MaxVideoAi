-- Site-owned publications deliberately have no FK to personal jobs/assets/users.
-- Removing a personal source must not remove a published video or its recipe.
CREATE TABLE IF NOT EXISTS marketing_media (
  video_id text PRIMARY KEY,
  copy_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('copying','ready','failed','deleting','deleted')),
  source_user_id text,
  source_fingerprint text NOT NULL,
  source_snapshot jsonb NOT NULL,
  source_record jsonb NOT NULL,
  publication jsonb NOT NULL DEFAULT '{}'::jsonb,
  recreation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  attempt_id uuid NOT NULL,
  lease_until timestamptz,
  copied_by text NOT NULL,
  permission_confirmed boolean NOT NULL DEFAULT false,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(publication)='object' AND jsonb_typeof(recreation_snapshot)='object' AND jsonb_typeof(files)='array'),
  CHECK (state <> 'ready' OR (publication->>'job_id'=video_id AND publication->>'video_url' IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS marketing_media_updated_idx ON marketing_media(updated_at DESC,video_id);
