-- Opt-in only: no existing destination or media selection is migrated.
CREATE TABLE IF NOT EXISTS playlist_curations (
  playlist_id uuid PRIMARY KEY REFERENCES playlists(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('manual', 'hybrid')),
  ordered_ids text[] NOT NULL DEFAULT '{}',
  excluded_ids text[] NOT NULL DEFAULT '{}',
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (cardinality(ordered_ids) <= 2000 AND cardinality(excluded_ids) <= 5000)
);
