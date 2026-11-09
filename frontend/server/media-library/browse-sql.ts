import { FEATURES } from '@/content/feature-flags';
import { applicationJobSql } from '../app-job-origin';
import { libraryIdentityCtes } from './browse-identity-sql';
/** $1 owner, $2 normalized scope, $3 escaped search. Shared by browse and snapshot creation. */
export function libraryBrowseCtes(toolsEnabled: boolean = FEATURES.workflows.toolsSection): string {
    return `${libraryIdentityCtes()}, browse_candidates AS (
    SELECT i.*,m.id AS display_id,m.public_id,m.url AS display_url,m.thumb_url,m.preview_url,m.mime_type,m.width,m.height,m.size_bytes,
      CASE WHEN m.source='import' AND (m.source_job_id IS NOT NULL OR m.metadata->>'jobId' IS NOT NULL OR m.metadata->>'sourceJobId' IS NOT NULL)
        THEN 'saved_job_output' ELSE m.source END AS source,m.metadata,m.created_at,
      0 AS priority,NULL::integer AS position,NULL::text AS job_prompt,NULL::integer AS job_duration_sec,NULL::text AS job_aspect_ratio
      FROM library_identities i JOIN media_assets m ON i.type='asset' AND m.id=i.id AND m.user_id=$1
      WHERE COALESCE(m.source,'')<>'storyboard_template_reference'
    UNION ALL
    SELECT i.*,u.asset_id,NULL::text,u.url,u.metadata->>'thumbUrl',u.metadata->>'previewUrl',u.mime_type,u.width,u.height,u.size_bytes,
      CASE WHEN u.source IN('upload','storyboard','character','angle','upscale','background-removal') THEN u.source
        WHEN u.source='generated' OR (u.source='import' AND (u.metadata->>'jobId' IS NOT NULL OR u.metadata->>'sourceJobId' IS NOT NULL)) THEN 'saved_job_output' ELSE 'import' END,
      u.metadata,u.created_at,2,NULL::integer,NULL::text,NULL::integer,NULL::text
      FROM library_identities i JOIN user_assets u ON i.type='legacy' AND u.asset_id=i.id AND u.user_id=$1
      WHERE COALESCE(u.source,'')<>'storyboard_template_reference'
    UNION ALL
    SELECT i.*,'output:'||o.id,NULL::text,COALESCE(o.storage_url,o.url),o.thumb_url,o.preview_url,o.mime_type,o.width,o.height,NULL::bigint,
      'saved_job_output',COALESCE(o.metadata,'{}'::jsonb)||jsonb_build_object('durationSec',o.duration_sec,'jobId',o.job_id,'sourceOutputId',o.id),o.created_at,
      1,o.position,j.prompt,j.duration_sec,j.aspect_ratio
      FROM library_identities i JOIN job_outputs o ON i.type='job-output' AND o.id=i.id AND o.user_id=$1
      JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=$1
      WHERE ($2::jsonb->>'jobId' IS NOT NULL OR ${applicationJobSql('j')})
  ), browse_saved AS (
    SELECT organization_key,min(display_id) FILTER(WHERE type='asset') AS saved_asset_id FROM browse_candidates GROUP BY organization_key
  ), browse_source_filtered AS (
    SELECT c.*,saved.saved_asset_id,COALESCE(${['label', 'fileName', 'filename', 'originalName'].map(key => `CASE WHEN jsonb_typeof(c.metadata->'${key}')='string' THEN NULLIF(BTRIM(c.metadata->>'${key}'),'') END`).join(',')},'') AS display_name
    FROM browse_candidates c JOIN browse_saved saved USING(organization_key)
    WHERE ${toolsEnabled ? 'true' : "COALESCE(c.source,'') NOT IN ('storyboard','character','angle')"}
      AND ($2::jsonb->>'kind'='all' OR c.kind=$2::jsonb->>'kind')
      AND ($2::jsonb->>'source' IS NULL OR c.source=$2::jsonb->>'source')
      AND ($2::jsonb->>'view'='all' OR ($2::jsonb->>'view'='saved' AND c.type<>'job-output') OR ($2::jsonb->>'view'='review' AND c.type='job-output'))
      AND ($2::jsonb->>'jobId' IS NULL OR c."jobId"=$2::jsonb->>'jobId')
      AND ($2::jsonb->>'surface' IS NULL OR EXISTS(SELECT 1 FROM app_jobs j WHERE j.user_id=$1 AND j.job_id=c."jobId" AND (j.surface=$2::jsonb->>'surface' OR j.settings_snapshot->>'surface'=$2::jsonb->>'surface')))
      AND ($2::jsonb->>'surface' IS DISTINCT FROM 'storyboard' OR c."jobId" NOT LIKE 'storyboard_kling_first_frame_%')
  ), browse_ranked AS (
    SELECT c.*,row_number() OVER(PARTITION BY organization_key ORDER BY priority,created_at DESC,id DESC) AS rank,
      bool_or($3::text IS NULL OR concat_ws(' ',metadata->>'label',metadata->>'fileName',metadata->>'filename',metadata->>'originalName',"jobId",job_prompt,id) ILIKE $3 ESCAPE '\\') OVER(PARTITION BY organization_key) AS matches_search,
      first_value(NULLIF(metadata->>'originalName','')) OVER(PARTITION BY organization_key ORDER BY (NULLIF(metadata->>'originalName','') IS NULL),priority DESC,created_at DESC,id) AS original_name
      FROM browse_source_filtered c
  ), browse_filtered AS MATERIALIZED (
    SELECT c.*,COALESCE(o.favorite,false) AS favorite,o.trashed_at,
      ARRAY(SELECT m.collection_id FROM library_collection_members m WHERE m.user_id=$1 AND m.organization_key=c.organization_key ORDER BY m.collection_id) AS collection_ids,
      lower(COALESCE(NULLIF(c.display_name,''),c.original_name,'')) COLLATE "C" AS sort_name
    FROM browse_ranked c LEFT JOIN library_organization o ON o.user_id=$1 AND o.key=c.organization_key
    WHERE c.rank=1 AND c.matches_search
      AND (COALESCE(($2::jsonb->>'favorite')::boolean,false)=false OR o.favorite)
      AND ((o.trashed_at IS NOT NULL)=COALESCE(($2::jsonb->>'trash')::boolean,false))
      AND ($2::jsonb->>'collectionId' IS NULL OR EXISTS(SELECT 1 FROM library_collection_members m WHERE m.user_id=$1 AND m.organization_key=c.organization_key AND m.collection_id=$2::jsonb->>'collectionId'))
  )`;
}
export function browseOrder(sort: string) { return sort === 'name' ? 'sort_name COLLATE "C" ASC,created_at ASC,organization_key ASC' : `created_at ${sort === 'oldest' ? 'ASC' : 'DESC'},organization_key ${sort === 'oldest' ? 'ASC' : 'DESC'}`; }
