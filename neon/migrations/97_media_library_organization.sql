-- Account-scoped organization only. No original/media/cleanup state is changed.
CREATE TABLE IF NOT EXISTS library_organization (
  user_id text NOT NULL, key text NOT NULL, kind text NOT NULL CHECK (kind IN ('image','video','audio')),
  favorite boolean NOT NULL DEFAULT false, trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,key)
);
CREATE TABLE IF NOT EXISTS library_organization_aliases (
  user_id text NOT NULL, alias_type text NOT NULL CHECK(alias_type IN ('asset','legacy','job-output')),
  alias_id text NOT NULL, source_revision text NOT NULL, organization_key text NOT NULL,
  reference jsonb NOT NULL,
  PRIMARY KEY(user_id,alias_type,alias_id,source_revision),
  FOREIGN KEY(user_id,organization_key) REFERENCES library_organization(user_id,key)
);
CREATE TABLE IF NOT EXISTS library_collections (
  user_id text NOT NULL, id text NOT NULL, name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS library_collection_members (
  user_id text NOT NULL, collection_id text NOT NULL, organization_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,collection_id,organization_key),
  FOREIGN KEY(user_id,collection_id) REFERENCES library_collections(user_id,id) ON DELETE CASCADE,
  FOREIGN KEY(user_id,organization_key) REFERENCES library_organization(user_id,key)
);
CREATE TABLE IF NOT EXISTS library_selection_snapshots (
  user_id text NOT NULL, id text NOT NULL, scope jsonb NOT NULL, total_count integer NOT NULL CHECK(total_count BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS library_selection_snapshot_items (
  user_id text NOT NULL, snapshot_id text NOT NULL, organization_key text NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0),
  reference jsonb NOT NULL, source_revision text NOT NULL, PRIMARY KEY(user_id,snapshot_id,organization_key),
  UNIQUE(user_id,snapshot_id,ordinal),
  FOREIGN KEY(user_id,snapshot_id) REFERENCES library_selection_snapshots(user_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS library_organization_favorite_idx ON library_organization(user_id,favorite,key);
CREATE INDEX IF NOT EXISTS library_organization_trash_idx ON library_organization(user_id,trashed_at,key);
CREATE INDEX IF NOT EXISTS library_collection_reverse_idx ON library_collection_members(user_id,organization_key,collection_id);
CREATE INDEX IF NOT EXISTS library_snapshot_expiry_idx ON library_selection_snapshots(user_id,expires_at);

-- Bounded lookup acceleration only. Exact URL comparisons still establish provenance.
-- Guard standalone organization-schema replay; the full migration chain owns these source tables.
DO $$ BEGIN
  IF to_regclass('user_assets') IS NOT NULL THEN

    CREATE INDEX IF NOT EXISTS user_assets_owner_url_lookup_idx ON user_assets (user_id, md5(url));
    CREATE INDEX IF NOT EXISTS user_assets_owner_origin_lookup_idx ON user_assets (user_id, md5(metadata->>'originUrl'));
  END IF;
  IF to_regclass('media_assets') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS media_assets_owner_url_lookup_idx ON media_assets (user_id, md5(url), kind);
    CREATE INDEX IF NOT EXISTS media_assets_owner_origin_lookup_idx ON media_assets (user_id, md5(metadata->>'originUrl'), kind);
  END IF;
END $$;
