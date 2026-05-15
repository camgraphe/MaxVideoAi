CREATE TABLE IF NOT EXISTS video_seo_pages (
  video_id TEXT PRIMARY KEY,
  seo_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (seo_status IN ('candidate', 'draft', 'needs_edits', 'approved', 'disabled')),
  seo_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  h1 TEXT NOT NULL DEFAULT '',
  video_object_name TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  target_keyword TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT 'prompt-example'
    CHECK (intent IN ('prompt-example', 'model-demo', 'product-ad', 'camera-motion', 'image-to-video', 'audio-enabled')),
  model_slug TEXT NOT NULL DEFAULT '',
  examples_slug TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS video_seo_pages_status_idx ON video_seo_pages (seo_status);
CREATE INDEX IF NOT EXISTS video_seo_pages_updated_idx ON video_seo_pages (updated_at DESC);
