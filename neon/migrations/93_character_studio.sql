-- Explicit migration only. Request-time reads and writes never create schema.
CREATE TABLE IF NOT EXISTS character_studio_characters (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
  source_job_id text NOT NULL,
  image_url text NOT NULL,
  thumb_url text NOT NULL,
  settings_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, source_job_id, image_url)
);
CREATE INDEX IF NOT EXISTS character_studio_characters_owner_idx ON character_studio_characters(user_id, id DESC);
CREATE TABLE IF NOT EXISTS character_studio_looks (
  id bigserial PRIMARY KEY,
  character_id bigint NOT NULL,
  user_id uuid NOT NULL,
  name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
  source_job_id text NOT NULL,
  image_url text NOT NULL,
  thumb_url text NOT NULL,
  settings_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (character_id, user_id) REFERENCES character_studio_characters(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, source_job_id, image_url)
);
CREATE INDEX IF NOT EXISTS character_studio_looks_owner_idx ON character_studio_looks(user_id, character_id, id DESC);
