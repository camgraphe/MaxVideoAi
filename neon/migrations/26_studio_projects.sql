CREATE TABLE IF NOT EXISTS studio_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  canvas_template_id TEXT NOT NULL DEFAULT 'product-ad',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  workspace_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS studio_projects_user_updated_idx
  ON studio_projects (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS studio_projects_user_id_idx
  ON studio_projects (user_id, id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS studio_sequences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main sequence',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeline_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS studio_sequences_project_updated_idx
  ON studio_sequences (project_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS studio_canvas_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS studio_canvas_templates_user_updated_idx
  ON studio_canvas_templates (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS studio_canvas_templates_user_id_idx
  ON studio_canvas_templates (user_id, id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS studio_project_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS studio_project_assets_project_updated_idx
  ON studio_project_assets (project_id, updated_at DESC)
  WHERE deleted_at IS NULL;
