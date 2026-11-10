/** Explicit migration/bootstrap only. No reads initialize deletion infrastructure. */
export const MEDIA_LIBRARY_PURGE_SCHEMA = String.raw`
ALTER TABLE library_organization ADD COLUMN IF NOT EXISTS purge_requested_at timestamptz;
CREATE TABLE IF NOT EXISTS library_storage_object_fences (
  object_key text PRIMARY KEY CHECK(length(object_key) BETWEEN 1 AND 1024 AND object_key=btrim(object_key)),
  state text NOT NULL DEFAULT 'available' CHECK(state IN ('available','producing','referenced','orphaned','deleting','deleted')),
  producer_claim_id uuid, producer_lease_expires_at timestamptz,
  delete_claim_id uuid, delete_lease_expires_at timestamptz,
  created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS library_purge_requests (
  user_id text NOT NULL, organization_key text NOT NULL, kind text NOT NULL,
  reference jsonb NOT NULL, source_revision text NOT NULL, sources jsonb NOT NULL, admission_sources jsonb NOT NULL DEFAULT '[]'::jsonb, source_plan jsonb,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','deleting','completed','failed')),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  not_before timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
  completed_at timestamptz, last_error text,
  PRIMARY KEY(user_id,organization_key),
  FOREIGN KEY(user_id,organization_key) REFERENCES library_organization(user_id,key)
);
ALTER TABLE library_purge_requests ADD COLUMN IF NOT EXISTS admission_sources jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS library_purge_pending_idx ON library_purge_requests(state,not_before,user_id);
CREATE TABLE IF NOT EXISTS library_purge_tokens (
  user_id text NOT NULL, organization_key text NOT NULL, token_hash text NOT NULL,
  PRIMARY KEY(user_id,organization_key,token_hash),
  FOREIGN KEY(user_id,organization_key) REFERENCES library_purge_requests(user_id,organization_key)
);
CREATE INDEX IF NOT EXISTS library_purge_token_lookup_idx ON library_purge_tokens(user_id,token_hash);
CREATE TABLE IF NOT EXISTS library_purge_objects (
  user_id text NOT NULL, organization_key text NOT NULL, object_key text NOT NULL,
  url text NOT NULL, size_bytes bigint, size_conflict boolean NOT NULL DEFAULT false, role text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','deleting','deleted','shared','retained')),
  reason text, lease_id uuid, lease_expires_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,organization_key,object_key),
  FOREIGN KEY(user_id,organization_key) REFERENCES library_purge_requests(user_id,organization_key)
);
CREATE INDEX IF NOT EXISTS library_purge_object_key_idx ON library_purge_objects(object_key);
CREATE INDEX IF NOT EXISTS library_purge_object_queue_idx ON library_purge_objects(state,user_id);
CREATE INDEX IF NOT EXISTS library_purge_object_url_idx ON library_purge_objects(md5(split_part(url,'?',1)),object_key);
-- This conservative path identity can only RETAIN/fence an object. It never grants
-- delete authority: the worker separately proves the exact host and owner prefix.
CREATE OR REPLACE FUNCTION library_possible_storage_key(candidate_url text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN candidate_url ~* '^https://[^/?#]+/'
    THEN regexp_replace(split_part(split_part(candidate_url,'?',1),'#',1),'^https://[^/]+/','','i') ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION library_purge_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data jsonb; candidate record; fence_state text; keys text[]; fence_table text; lineage jsonb; field_name text; projection_value jsonb; cleaned jsonb; encoded boolean;
BEGIN
  data:=to_jsonb(NEW);
  PERFORM pg_advisory_xact_lock_shared(hashtextextended(data->>'user_id',98));
  IF TG_TABLE_NAME IN ('media_assets','user_assets','job_outputs')
    AND COALESCE(data->>'status','ready')<>'deleted' AND data->>'deleted_at' IS NULL AND EXISTS(
    SELECT 1 FROM library_purge_requests r
    CROSS JOIN LATERAL jsonb_array_elements(r.sources||COALESCE(r.source_plan->'sources','[]'::jsonb)) source
    WHERE r.user_id=data->>'user_id' AND r.state IN ('deleting','completed')
      AND source->>'type'=CASE TG_TABLE_NAME WHEN 'media_assets' THEN 'asset' WHEN 'user_assets' THEN 'legacy' ELSE 'job-output' END
      AND source->>'id'=COALESCE(data->>'id',data->>'asset_id')) THEN
    -- Provider/background replays cannot resurrect a purged identity. A new import uses a new ID.
    IF TG_OP='UPDATE' THEN RETURN OLD; ELSE RETURN NULL; END IF;
  END IF;
  IF TG_TABLE_NAME IN ('media_assets','user_assets') AND COALESCE(data->>'status','ready')<>'deleted' AND data->>'deleted_at' IS NULL AND EXISTS(
    SELECT 1 FROM library_purge_requests r
    CROSS JOIN LATERAL jsonb_array_elements(r.sources||COALESCE(r.source_plan->'sources','[]'::jsonb)) source
    WHERE r.user_id=data->>'user_id' AND r.state IN ('deleting','completed') AND (
      (TG_TABLE_NAME='user_assets' AND source->>'type'='asset' AND source->>'id'=COALESCE(data->'metadata'->>'canonicalAssetId',data->>'asset_id'))
      OR (source->>'type'='job-output' AND source->>'id'=COALESCE(data->>'source_output_id',data->'metadata'->>'sourceOutputId')))) THEN
    IF TG_OP='UPDATE' THEN RETURN OLD; ELSE RETURN NULL; END IF;
  END IF;
  IF TG_TABLE_NAME='app_jobs' AND EXISTS(SELECT 1 FROM library_purge_requests WHERE user_id=data->>'user_id' AND state IN ('deleting','completed')) THEN
    FOREACH field_name IN ARRAY ARRAY['video_url','audio_url','thumb_url','hero_render_id','preview_video_url','preview_frame','keyframe_urls','render_ids'] LOOP
      projection_value:=data->field_name; encoded:=false;
      IF field_name='render_ids' AND jsonb_typeof(projection_value)='string' AND pg_input_is_valid(projection_value#>>'{}','jsonb') THEN
        projection_value:=(projection_value#>>'{}')::jsonb; encoded:=true;
      END IF;
      IF field_name='render_ids' AND jsonb_typeof(projection_value)='array' THEN
        SELECT COALESCE(jsonb_agg(entry ORDER BY ordinal),'[]'::jsonb) INTO cleaned
          FROM jsonb_array_elements(projection_value) WITH ORDINALITY entries(entry,ordinal)
          WHERE NOT library_deleted_projection(data->>'user_id',entry);
        data:=jsonb_set(data,ARRAY[field_name],CASE WHEN encoded THEN to_jsonb(cleaned::text) ELSE cleaned END);
      ELSIF field_name='keyframe_urls' AND jsonb_typeof(projection_value)='object' THEN
        SELECT COALESCE(jsonb_object_agg(key,item),'{}'::jsonb) INTO cleaned FROM jsonb_each(projection_value) entries(key,item)
          WHERE NOT library_deleted_projection(data->>'user_id',item);
        data:=jsonb_set(data,ARRAY[field_name],cleaned);
      ELSIF library_deleted_projection(data->>'user_id',projection_value) THEN
        data:=jsonb_set(data,ARRAY[field_name],CASE WHEN field_name='thumb_url' THEN to_jsonb('/assets/frames/thumb-1x1.svg'::text) ELSE 'null'::jsonb END);
      END IF;
    END LOOP;
    NEW:=jsonb_populate_record(NEW,data);
  END IF;

  IF TG_TABLE_NAME='media_assets' AND data->>'status'<>'deleted' AND data->>'deleted_at' IS NULL AND data->>'source_job_id' IS NULL AND data->>'source_output_id' IS NULL
      AND data->'metadata'->'libraryPurgeRetained' IS NULL THEN
    lineage:=jsonb_build_array(data->'metadata'->'videoExcerpt'->'source',data->'metadata'->'audioExcerpt'->'source',
      CASE WHEN data->'metadata'->'creator'->'generation' IS NULL THEN data->'metadata'->'creator'->'source' END);
    IF EXISTS(SELECT 1 FROM library_purge_requests WHERE user_id=data->>'user_id' AND state<>'failed')
      AND library_deleted_input(data->>'user_id',lineage,ARRAY[]::text[]) THEN
      RAISE EXCEPTION 'MEDIA_DELETED: cannot prepare a deleted source' USING ERRCODE='P0001';
    END IF;
  END IF;
  keys:=ARRAY(SELECT library_possible_storage_key(strings.projection_value) FROM library_input_strings(jsonb_build_array(
    data->'url',data->'storage_url',data->'thumb_url',data->'preview_url',data->'image_url',
    data->'video_url',data->'audio_url',data->'hero_render_id',data->'preview_video_url',data->'preview_frame',data->'keyframe_urls',
    CASE WHEN jsonb_typeof(data->'render_ids')='string' AND pg_input_is_valid(data->>'render_ids','jsonb')
      THEN (data->>'render_ids')::jsonb ELSE data->'render_ids' END,
    data->'metadata'->'thumbUrl',data->'metadata'->'previewUrl',data->'metadata'->'imageDisplay'->'url')) strings(projection_value));
  FOR candidate IN SELECT DISTINCT key_entry.key AS object_key FROM unnest(keys) key_entry(key)
    WHERE length(key_entry.key) BETWEEN 1 AND 1024 AND key_entry.key=btrim(key_entry.key)
      AND key_entry.key ~ '^(mcp-reference-staging/)?(renders|storyboard-template-references|normalized-references|background-removal|timeline-exports|user-asset-thumbs|media-assets|user-assets|inline|upscale|angle|files)/'
    ORDER BY object_key LOOP
    fence_table:=CASE WHEN candidate.object_key ~ '^(mcp-reference-staging/)?(user-assets/by-content/|user-asset-thumbs/)' THEN 'mcp_reference_upload_object_fences' ELSE 'library_storage_object_fences' END;
    EXECUTE format('INSERT INTO %I(object_key,state,created_at,updated_at) VALUES($1,''available'',clock_timestamp(),clock_timestamp())
      ON CONFLICT(object_key) DO UPDATE SET updated_at=%I.updated_at RETURNING state',fence_table,fence_table)
      INTO fence_state USING candidate.object_key;
    IF fence_state IN ('deleting','deleted') THEN
      RAISE EXCEPTION 'storage object is deleted or being deleted; retry persistence' USING ERRCODE='40001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS library_purge_source_guard ON media_assets;
CREATE TRIGGER library_purge_source_guard BEFORE INSERT OR UPDATE OF url,thumb_url,preview_url,metadata,status,deleted_at ON media_assets FOR EACH ROW EXECUTE FUNCTION library_purge_source_guard();
DROP TRIGGER IF EXISTS library_purge_source_guard ON user_assets;
CREATE TRIGGER library_purge_source_guard BEFORE INSERT OR UPDATE OF url,metadata ON user_assets FOR EACH ROW EXECUTE FUNCTION library_purge_source_guard();
DROP TRIGGER IF EXISTS library_purge_source_guard ON job_outputs;
CREATE TRIGGER library_purge_source_guard BEFORE INSERT OR UPDATE OF url,storage_url,thumb_url,preview_url,metadata,status ON job_outputs FOR EACH ROW EXECUTE FUNCTION library_purge_source_guard();
CREATE OR REPLACE FUNCTION library_creator_is_accepted(owner_id text, operation_id text) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE accepted boolean;
BEGIN
  IF to_regclass('mcp_generation_quotes') IS NULL OR operation_id !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM mcp_generation_quotes q JOIN app_jobs j ON j.job_id=q.job_id AND j.user_id=q.user_id
    WHERE q.user_id=$1 AND q.quote_id=$2::uuid AND lower(btrim(j.status)) NOT IN (''failed'',''cancelled'',''canceled'',''error'',''errored'',''aborted''))'
    INTO accepted USING owner_id,operation_id;
  RETURN accepted;
END $$;
CREATE OR REPLACE FUNCTION library_work_is_active(relation_name text, row_data jsonb) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT CASE relation_name
  WHEN 'studio_image_turns' THEN row_data->>'state'='thinking' AND (row_data->>'lease_expires_at')::timestamptz>clock_timestamp()
  WHEN 'studio_media_analysis_runs' THEN row_data->>'state' IN ('queued','running','unknown')
  WHEN 'studio_tasks' THEN row_data->>'state' IN ('queued','running','unknown')
  WHEN 'creator_operations' THEN CASE WHEN row_data->>'status'='prepared' THEN library_creator_is_accepted(row_data->>'user_id',row_data->>'id')
    ELSE lower(btrim(COALESCE(row_data->>'status','unknown'))) NOT IN ('completed','finished','success','succeeded','failed','cancelled','canceled','error','errored','aborted') END
  WHEN 'subtitle_operations' THEN COALESCE(row_data->>'state','unknown') NOT IN ('prepared','completed','failed','cancelled','canceled')
  ELSE lower(btrim(COALESCE(row_data->>'status','unknown'))) NOT IN ('completed','finished','success','succeeded','failed','cancelled','canceled','error','errored','aborted') END $$;
CREATE OR REPLACE FUNCTION library_input_strings(input jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE values_tree(value) AS (
    SELECT input UNION ALL
    SELECT child.value FROM values_tree parent CROSS JOIN LATERAL (
      SELECT entry.value FROM jsonb_each(CASE WHEN jsonb_typeof(parent.value)='object' THEN parent.value ELSE '{}'::jsonb END) entry
        WHERE entry.key NOT IN ('prompt','text','message','instructions','label','name','title','description','originalName')
      UNION ALL SELECT entry.value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(parent.value)='array' THEN parent.value ELSE '[]'::jsonb END) entry
    ) child
  ) SELECT DISTINCT CASE WHEN value#>>'{}' ILIKE 'https://%' THEN split_part(split_part(value#>>'{}','?',1),'#',1) ELSE value#>>'{}' END
    FROM values_tree WHERE jsonb_typeof(value)='string'
$$;
CREATE OR REPLACE FUNCTION library_purge_url_has_live_source(owner_id text, candidate_url text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM (
    SELECT 'asset' AS source_type,id AS source_id,url FROM media_assets
      WHERE user_id=owner_id AND deleted_at IS NULL AND status='ready'
    UNION ALL SELECT 'legacy',asset_id,url FROM user_assets WHERE user_id=owner_id
    UNION ALL SELECT 'job-output',id,COALESCE(storage_url,url) FROM job_outputs WHERE user_id=owner_id AND status='ready'
  ) media WHERE (split_part(media.url,'?',1)=candidate_url OR
      library_possible_storage_key(media.url)=library_possible_storage_key(candidate_url))
    AND NOT EXISTS(SELECT 1 FROM library_purge_requests r CROSS JOIN LATERAL jsonb_array_elements(r.sources||r.admission_sources||COALESCE(r.source_plan->'sources','[]'::jsonb)) source
      WHERE r.user_id=owner_id AND r.state<>'failed' AND source->>'type'=media.source_type AND source->>'id'=media.source_id))
$$;
CREATE OR REPLACE FUNCTION library_deleted_projection(owner_id text,input jsonb) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM library_input_strings(input) input(value)
    JOIN library_purge_tokens token ON token.user_id=owner_id AND token.token_hash=ANY(ARRAY[
      encode(sha256(convert_to(input.value,'UTF8')),'hex'),
      encode(sha256(convert_to('storage-path:'||library_possible_storage_key(input.value),'UTF8')),'hex')])
    JOIN library_purge_requests request USING(user_id,organization_key)
    WHERE request.state IN ('deleting','completed')
      AND (input.value NOT ILIKE 'https://%' OR NOT library_purge_url_has_live_source(owner_id,input.value)))
$$;
CREATE OR REPLACE FUNCTION library_admission_strings(owner_id text, input jsonb) RETURNS SETOF text
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE inputs(value,depth) AS (
    SELECT value,0 FROM library_input_strings(input) strings(value)
    UNION
    SELECT child.value,parent.depth+1 FROM inputs parent JOIN media_assets asset
      ON asset.user_id=owner_id AND (asset.id=parent.value OR asset.public_id=parent.value)
    CROSS JOIN LATERAL library_input_strings(jsonb_build_array(
      asset.metadata->'videoExcerpt'->'source',asset.metadata->'audioExcerpt'->'source',
      CASE WHEN asset.metadata->'creator'->'generation' IS NULL THEN asset.metadata->'creator'->'source' END)) child(value)
    WHERE parent.depth<8 AND asset.source_job_id IS NULL AND asset.source_output_id IS NULL
      AND asset.metadata->'libraryPurgeRetained' IS NULL
  ) SELECT DISTINCT value FROM inputs
$$;
CREATE OR REPLACE FUNCTION library_deleted_input(owner_id text,input jsonb,accepted_inputs text[]) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM library_admission_strings(owner_id,input) input(value)
    JOIN library_purge_tokens token ON token.user_id=owner_id AND token.token_hash=ANY(ARRAY[
      encode(sha256(convert_to(input.value,'UTF8')),'hex'),
      encode(sha256(convert_to('storage-path:'||library_possible_storage_key(input.value),'UTF8')),'hex')])
    JOIN library_purge_requests request USING(user_id,organization_key)
    WHERE request.state<>'failed' AND NOT (input.value=ANY(accepted_inputs))
      AND (input.value NOT ILIKE 'https://%' OR NOT library_purge_url_has_live_source(owner_id,input.value)))
$$;
CREATE OR REPLACE FUNCTION library_purge_work_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text; data jsonb; creator_snapshot jsonb; accepted_inputs text[]:=ARRAY[]::text[];
BEGIN
  data:=to_jsonb(NEW); owner_id:=data->>'user_id';
  IF owner_id IS NULL OR NOT library_work_is_active(TG_TABLE_NAME,data) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended(owner_id,98));
  IF NOT EXISTS(SELECT 1 FROM library_purge_requests WHERE user_id=owner_id AND state<>'failed') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND library_work_is_active(TG_TABLE_NAME,to_jsonb(OLD)) THEN
    accepted_inputs:=ARRAY(SELECT library_admission_strings(owner_id,to_jsonb(OLD)));
  END IF;
  IF TG_TABLE_NAME='app_jobs' AND data->'settings_snapshot'->>'creatorOperationId' IS NOT NULL AND to_regclass('creator_operations') IS NOT NULL THEN
    EXECUTE 'SELECT snapshot FROM creator_operations WHERE user_id=$1 AND id=$2::uuid' INTO creator_snapshot
      USING owner_id,data->'settings_snapshot'->>'creatorOperationId';
    data:=data||jsonb_build_object('creator_source_snapshot',creator_snapshot);
    IF TG_OP='UPDATE' AND library_work_is_active(TG_TABLE_NAME,to_jsonb(OLD))
      AND to_jsonb(OLD)->'settings_snapshot'->>'creatorOperationId'=data->'settings_snapshot'->>'creatorOperationId' THEN
      accepted_inputs:=accepted_inputs||ARRAY(SELECT library_admission_strings(owner_id,creator_snapshot));
    END IF;
  END IF;
  IF library_deleted_input(owner_id,data,accepted_inputs) THEN
    RAISE EXCEPTION 'MEDIA_DELETED: replace the deleted source before starting work' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['app_jobs','app_timeline_exports','creator_operations','studio_media_analysis_runs','studio_tasks','studio_image_turns','subtitle_operations'] LOOP
    IF to_regclass(relation_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS library_purge_work_guard ON %I',relation_name);
      EXECUTE format('CREATE TRIGGER library_purge_work_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION library_purge_work_guard()',relation_name);
    END IF;
  END LOOP;
END $$;
DO $$ DECLARE relation_name text; fields text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['app_jobs','character_studio_characters','character_studio_looks'] LOOP
    SELECT string_agg(quote_ident(attname),',' ORDER BY attname) INTO fields FROM pg_attribute
      WHERE attrelid=to_regclass(relation_name) AND attnum>0 AND NOT attisdropped
      AND attname=ANY(ARRAY['image_url','thumb_url','video_url','audio_url','hero_render_id','preview_video_url','preview_frame','keyframe_urls','render_ids']);
    IF fields IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS library_purge_source_guard ON %I',relation_name);
      EXECUTE format('CREATE TRIGGER library_purge_source_guard BEFORE INSERT OR UPDATE OF %s ON %I FOR EACH ROW EXECUTE FUNCTION library_purge_source_guard()',fields,relation_name);
    END IF;
  END LOOP;
END $$;

`;
