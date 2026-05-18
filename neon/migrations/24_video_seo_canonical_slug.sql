ALTER TABLE video_seo_pages
  ADD COLUMN IF NOT EXISTS canonical_slug TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS video_seo_pages_canonical_slug_unique_idx
  ON video_seo_pages (canonical_slug)
  WHERE canonical_slug <> '';
