-- Apply this exact file on a direct connection, outside a transaction block.
-- The ordinary migration runner deliberately does not include concurrent/.
-- Public video readers exclude deleted media by owner and original URL. Existing
-- media indexes exclude deleted rows, causing repeated full scans for this check.
CREATE INDEX CONCURRENTLY IF NOT EXISTS media_assets_deleted_user_url_idx
  ON public.media_assets (user_id, url)
  WHERE deleted_at IS NOT NULL OR status = 'deleted';
