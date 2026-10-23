-- Site-owned publications deliberately have no FK to personal jobs/assets/users.
-- Removing a personal source must not remove a published video or its recipe.
CREATE TABLE IF NOT EXISTS marketing_media (
  video_id text PRIMARY KEY,
  copy_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('copying','ready','failed','deleting','deleted')),
  tombstone boolean NOT NULL DEFAULT false,
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

-- A stale admin tab must not attach a deleting/deleted marketing identity.
-- Guards only; these triggers never rewrite membership or editorial facts.
CREATE OR REPLACE FUNCTION guard_marketing_media_placement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_id text; selected_state text; retired boolean; payload jsonb := to_jsonb(NEW);
BEGIN
 IF TG_TABLE_NAME='video_seo_pages' AND payload->>'seo_status'='disabled' THEN RETURN NEW; END IF;
 FOR selected_id IN
  SELECT DISTINCT value FROM jsonb_array_elements_text(
   CASE WHEN payload->>'video_id' IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(payload->>'video_id') END
   || COALESCE(NULLIF(payload->'ordered_ids','null'::jsonb),'[]'::jsonb)
   || COALESCE(NULLIF(payload->'opening_ids','null'::jsonb),'[]'::jsonb))
 LOOP
  SELECT state,tombstone INTO selected_state,retired FROM marketing_media WHERE video_id=selected_id FOR SHARE;
  IF retired AND selected_state IN ('deleting','deleted') THEN RAISE EXCEPTION 'This marketing media is no longer available' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['playlist_items','homepage_sections','playlist_curations','video_seo_pages'] LOOP
  IF to_regclass('public.'||target) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS marketing_media_placement_guard ON %I',target);
   EXECUTE format('CREATE TRIGGER marketing_media_placement_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION guard_marketing_media_placement()',target);
  END IF;
 END LOOP;
END $$;
