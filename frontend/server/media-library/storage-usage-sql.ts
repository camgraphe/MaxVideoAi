import { hashSql, revisionSql } from './browse-identity-sql';
import { legacyKindSql } from './organization-source-sql';

const referenceSql = (type: 'asset' | 'legacy', id: string, kind: string) =>
  `('{"type":"${type}","assetId":'||to_json(${id})::text||',"kind":'||to_json(${kind})::text||'}')`;

/** One MVCC snapshot: ready projections and the purge ledger are overlapping evidence,
 * not additive inventories. Only proven object keys merge signed URL variants. */
export const LIBRARY_STORAGE_USAGE_SQL = `
WITH raw_sources AS MATERIALIZED (
  SELECT 'asset'::text AS type,m.id,m.kind,m.url,m.size_bytes,
    CASE WHEN m.source_output_id IS NOT NULL THEN COALESCE(NULLIF(m.metadata->>'originUrl',''),m.url) ELSE m.url END AS original,
    ${referenceSql('asset', 'COALESCE(m.public_id,m.id)', 'm.kind')} AS reference,
    m.deleted_at IS NULL AND m.status='ready' AS live
  FROM media_assets m WHERE m.user_id=$1
  UNION ALL
  SELECT 'legacy',u.asset_id,${legacyKindSql()},u.url,u.size_bytes,
    CASE WHEN u.metadata->>'sourceOutputId' IS NOT NULL THEN COALESCE(NULLIF(u.metadata->>'originUrl',''),u.url) ELSE u.url END,
    ${referenceSql('legacy', 'u.asset_id', legacyKindSql())},true
  FROM user_assets u WHERE u.user_id=$1
  UNION ALL
  SELECT 'job-output',o.id,o.kind,COALESCE(o.storage_url,o.url),NULL::bigint,COALESCE(o.storage_url,o.url),
    ('{"type":"job-output","jobId":'||to_json(o.job_id)::text||',"outputId":'||to_json(o.id)::text||',"kind":'||to_json(o.kind)::text||'}'),o.status='ready'
  FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id WHERE o.user_id=$1
), requests AS MATERIALIZED (
  SELECT * FROM library_purge_requests WHERE user_id=$1
), owned_objects AS MATERIALIZED (
  SELECT o.*,r.state AS request_state,r.last_error FROM library_purge_objects o
  JOIN requests r USING(user_id,organization_key) WHERE o.user_id=$1
), object_urls AS (
  SELECT split_part(url,'?',1) AS base_url,min(object_key) AS object_key
  FROM owned_objects GROUP BY split_part(url,'?',1) HAVING count(DISTINCT object_key)=1
), object_states AS (
  SELECT object_key,bool_and(state='deleted') AS deleted,
    -- Outstanding cleanup outranks earlier retention for the same physical object.
    -- Size conflicts stay independent; the confirmed physical fence still wins below.
    bool_or(role='original' AND state='shared')
      AND NOT bool_or(role='original' AND state IN ('pending','deleting','retained')) AS shared,
    bool_or(role='original' AND state='retained')
      AND NOT bool_or(role='original' AND state IN ('pending','deleting')) AS retained,
    bool_or(role='original' AND state<>'deleted' AND size_conflict) AS size_conflict
  FROM owned_objects GROUP BY object_key
), request_sources AS (
  SELECT r.state,r.last_error,s.* FROM requests r
  CROSS JOIN LATERAL jsonb_to_recordset(r.sources) AS s(type text,id text,kind text,url text,original text)
  WHERE r.state IN ('pending','deleting','failed')
), evidence AS (
  SELECT s.url,s.size_bytes,true AS live,
    o.trashed_at IS NOT NULL AND o.purge_requested_at IS NULL AS trashed,
    false AS pending,false AS failed
  FROM raw_sources s
  LEFT JOIN library_organization_aliases a ON a.user_id=$1 AND a.alias_type=s.type
    AND a.alias_id=${hashSql('s.reference')} AND a.source_revision=${revisionSql('s.kind', 's.original')}
  LEFT JOIN library_organization o ON o.user_id=$1 AND o.key=a.organization_key
  WHERE s.live
  UNION ALL
  -- Preserve the frozen source when proof fails or the logical record was tombstoned.
  -- A matching retained row can supply size; a missing size stays unknown.
  SELECT s.url,raw.size_bytes,false,false,s.state IN ('pending','deleting'),
    s.state='failed' OR s.last_error IS NOT NULL
  FROM request_sources s LEFT JOIN raw_sources raw
    ON raw.type=s.type AND raw.id=s.id AND raw.kind=s.kind AND raw.url=s.url AND raw.original=s.original
  UNION ALL
  SELECT url,size_bytes,false,false,state IN ('pending','deleting'),
    reason='STORAGE_RETRY' OR request_state='failed' OR last_error IS NOT NULL
  FROM owned_objects WHERE role='original' AND state<>'deleted'
), object_evidence AS (
  SELECT e.*,COALESCE(u.object_key,CASE WHEN reference_storage_authority_is_recognized(e.url)
    THEN library_possible_storage_key(e.url) END) AS object_key
  FROM evidence e LEFT JOIN object_urls u ON u.base_url=split_part(e.url,'?',1)
  WHERE NULLIF(e.url,'') IS NOT NULL
), identified AS (
  SELECT e.*,COALESCE('object:'||e.object_key,'url:'||e.url) AS identity,
    COALESCE(o.shared,false) AS shared,COALESCE(o.retained,false) AS retained,
    COALESCE(o.size_conflict,false) AS size_conflict
  FROM object_evidence e LEFT JOIN object_states o ON o.object_key=e.object_key
  LEFT JOIN library_storage_object_fences f ON f.object_key=e.object_key
    AND e.object_key !~ '^(mcp-reference-staging/)?(user-assets/by-content/|user-asset-thumbs/)'
  LEFT JOIN mcp_reference_upload_object_fences mcp ON mcp.object_key=e.object_key
    AND e.object_key ~ '^(mcp-reference-staging/)?(user-assets/by-content/|user-asset-thumbs/)'
  WHERE COALESCE(f.state='deleted',mcp.state='deleted',o.deleted,false)=false
), files AS (
  SELECT identity,
    CASE WHEN NOT bool_or(size_conflict) AND count(DISTINCT size_bytes) FILTER(WHERE size_bytes>=0)=1
      THEN max(size_bytes) FILTER(WHERE size_bytes>=0) END AS bytes,
    bool_or(live) OR NOT bool_or(shared) AS recorded,
    bool_or(trashed) AS trashed,
    bool_or(pending) AND NOT bool_or(shared OR retained) AS pending,
    bool_or(failed) AND NOT bool_or(shared) AS failed,bool_or(shared) AS shared
  FROM identified GROUP BY identity
)
SELECT COALESCE(sum(bytes) FILTER(WHERE recorded),0)::text AS bytes,
  count(bytes) FILTER(WHERE recorded)::text AS measured,count(*) FILTER(WHERE recorded)::text AS files,
  count(*) FILTER(WHERE pending)::text AS pending_files,COALESCE(sum(bytes) FILTER(WHERE pending),0)::text AS pending_bytes,
  count(*) FILTER(WHERE failed)::text AS failed_files,
  count(*) FILTER(WHERE trashed)::text AS trashed_files,COALESCE(sum(bytes) FILTER(WHERE trashed),0)::text AS trashed_bytes,
  count(*) FILTER(WHERE shared)::text AS shared_files,COALESCE(sum(bytes) FILTER(WHERE shared),0)::text AS shared_bytes
FROM files`;
