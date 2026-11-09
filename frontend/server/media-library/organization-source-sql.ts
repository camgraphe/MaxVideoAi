// All discovery is account scoped. Candidate limits apply per provenance lookup,
// never to a request-wide set of independently proven sources.
export const sourceSeedColumns = `type text,id text,"publicId" text,kind text,url text,original text,provenance text,"jobId" text,"outputId" text`;
export const assetProjection = ` 'asset'::text AS type,m.id,m.public_id AS "publicId",m.kind,m.url,
  CASE WHEN m.source_output_id IS NOT NULL THEN COALESCE(NULLIF(m.metadata->>'originUrl',''),m.url) ELSE m.url END AS original,
  m.metadata->>'originUrl' AS provenance,m.source_job_id AS "jobId",m.source_output_id AS "outputId",to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  (m.deleted_at IS NULL AND m.status='ready') AS available`;
/** Preserve legacy list inference when early uploads have no MIME metadata. */
export function legacyKindSql(): string {
    return `CASE WHEN COALESCE(u.mime_type,'') LIKE 'video/%' OR u.url ~* '[.](mp4|webm|mov|m4v|avi|mkv)([?#].*)?$' THEN 'video'
    WHEN COALESCE(u.mime_type,'') LIKE 'audio/%' OR u.url ~* '[.](mp3|wav|ogg|m4a|aac|flac)([?#].*)?$' THEN 'audio' ELSE 'image' END`;
}
export const legacyProjection = ` 'legacy'::text AS type,u.asset_id AS id,NULL::text AS "publicId",
  ${legacyKindSql()} AS kind,
  u.url,CASE WHEN u.metadata->>'sourceOutputId' IS NOT NULL THEN COALESCE(NULLIF(u.metadata->>'originUrl',''),u.url) ELSE u.url END AS original,
  u.metadata->>'originUrl' AS provenance,NULLIF(u.metadata->>'jobId','') AS "jobId",NULLIF(u.metadata->>'sourceOutputId','') AS "outputId",to_char(u.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",true AS available`;
export const outputProjection = ` 'job-output'::text AS type,o.id,NULL::text AS "publicId",o.kind,COALESCE(o.storage_url,o.url) AS url,
  COALESCE(o.storage_url,o.url) AS original,NULL::text AS provenance,o.job_id AS "jobId",o.id AS "outputId",to_char(o.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",o.status='ready' AS available`;
/** Equality lookup branches use bounded hash indexes; exact strings and ancestry still prove correspondence.
 * Materialize the lookup before availability/kind residuals: cold statistics otherwise prefer a broad
 * partial created-at index over the hash lookup. Each branch retains shared ID first and two candidates,
 * sufficient for the unchanged exact/unique/ambiguous decision after pair deduplication. */
export function canonicalLegacyPairsSql(relation = 'user_assets u', scope = 'u.user_id=$1', owner = '$1'): string {
    return [['m.url', 'u.url'], ['m.url', "u.metadata->>'originUrl'"], ["m.metadata->>'originUrl'", 'u.url'], ["m.metadata->>'originUrl'", "u.metadata->>'originUrl'"]].map(([left, right]) => `
    SELECT u.asset_id AS legacy_id,m.id AS canonical_id FROM ${relation} CROSS JOIN LATERAL (
      WITH lookup AS MATERIALIZED (
        SELECT m.id,m.kind,m.url,m.metadata,m.source_job_id,m.source_output_id,m.deleted_at,m.status
        FROM media_assets m WHERE m.user_id=${owner} AND md5(${left})=md5(${right})
      ) SELECT m.id FROM lookup m WHERE ${left}=${right} AND CASE WHEN m.kind=u.inferred_kind THEN true ELSE false END AND m.deleted_at IS NULL AND m.status='ready'
        AND (m.source_job_id IS NULL OR u.metadata->>'jobId' IS NULL OR m.source_job_id=u.metadata->>'jobId')
        AND (m.source_output_id IS NULL OR u.metadata->>'sourceOutputId' IS NULL OR m.source_output_id=u.metadata->>'sourceOutputId')
      ORDER BY (m.id=u.asset_id) DESC,m.id LIMIT 2
    ) m WHERE ${scope}`).join(' UNION ');
}
export function canonicalLegacyMatchesSql(pairs = 'canonical_pairs'): string {
    return `SELECT legacy_id,CASE WHEN bool_or(canonical_id=legacy_id) THEN min(canonical_id) FILTER(WHERE canonical_id=legacy_id)
    WHEN count(*)=1 THEN min(canonical_id) END AS canonical_id FROM ${pairs} GROUP BY legacy_id`;
}
// Exact IDs lead the join. Kind/job authorization remains a residual check, avoiding kind-only merge scans.
export function initialSourceSql(): string {
    return `WITH requested AS (SELECT DISTINCT * FROM jsonb_to_recordset($2::jsonb) AS r(type text,"assetId" text,kind text,"jobId" text,"outputId" text))
    SELECT ${assetProjection} FROM requested r JOIN media_assets m ON m.public_id=r."assetId" AND m.user_id=$1 WHERE r.type='asset' AND CASE WHEN m.kind=r.kind THEN true ELSE false END
    UNION ALL SELECT ${legacyProjection} FROM requested r JOIN user_assets u ON u.asset_id=r."assetId" AND u.user_id=$1 WHERE r.type='legacy' AND CASE WHEN ${legacyKindSql()}=r.kind THEN true ELSE false END
    UNION ALL SELECT ${outputProjection} FROM requested r JOIN job_outputs o ON o.id=r."outputId" AND o.user_id=$1 WHERE r.type='job-output' AND CASE WHEN o.job_id=r."jobId" AND o.kind=r.kind THEN true ELSE false END`;
}
export function canonicalSourceSql(lock: boolean): string {
    return `WITH seeds AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS s(${sourceSeedColumns})), candidates AS (
    SELECT id FROM seeds WHERE type='asset'
    UNION ALL SELECT candidate.id FROM seeds s CROSS JOIN LATERAL (
      SELECT m.id FROM media_assets m WHERE m.user_id=$1 AND m.kind=s.kind AND (
        (s.type='job-output' AND m.source_output_id=s.id AND m.source_job_id=s."jobId" AND m.deleted_at IS NULL AND m.status='ready')
        OR (s.type='legacy' AND m.deleted_at IS NULL AND m.status='ready'
          AND (m.source_job_id IS NULL OR s."jobId" IS NULL OR m.source_job_id=s."jobId")
          AND (m.source_output_id IS NULL OR s."outputId" IS NULL OR m.source_output_id=s."outputId")
          AND ((md5(m.url) IN(md5(s.url),md5(s.original),md5(s.provenance)) AND m.url IN (s.url,s.original,s.provenance)) OR (md5(m.metadata->>'originUrl') IN(md5(s.url),md5(s.original),md5(s.provenance)) AND m.metadata->>'originUrl' IN (s.url,s.original,s.provenance)))))
      ORDER BY (m.id=s.id) DESC,m.id LIMIT 2
    ) candidate WHERE s.type<>'asset')
    SELECT ${assetProjection} FROM media_assets m WHERE m.user_id=$1 AND m.id IN (SELECT id FROM candidates) ORDER BY m.id${lock ? ' FOR UPDATE OF m' : ''}`;
}
/** Exact and materialized proof is collected before the similarity cap.
 * Return no partial IDs on overflow: the caller must mark that group unresolved. */
export function legacyIdentityProofSql(): string {
    return `WITH seeds AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS s(${sourceSeedColumns}))
    SELECT s.type,s.id,s.kind, count(*)>1000 AS overflow,
      CASE WHEN count(*)>1000 THEN ARRAY[]::text[] ELSE array_agg(candidate.asset_id ORDER BY candidate.asset_id) END AS ids
    FROM seeds s CROSS JOIN LATERAL (
      SELECT u.asset_id FROM user_assets u WHERE u.user_id=$1 AND ${legacyKindSql()}=s.kind AND (
        ((s.type='legacy' OR s.type='asset') AND u.asset_id=s.id)
        OR ((s.type='asset' OR s."jobId" IS NOT NULL)
          AND (s."jobId" IS NULL OR u.metadata->>'jobId' IS NULL OR u.metadata->>'jobId'=s."jobId")
          AND (s."outputId" IS NULL OR u.metadata->>'sourceOutputId' IS NULL OR u.metadata->>'sourceOutputId'=s."outputId")
          AND ((md5(u.url) IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.url IN(s.url,s.original,s.provenance)) OR (md5(u.metadata->>'originUrl') IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.metadata->>'originUrl' IN(s.url,s.original,s.provenance)))
          AND ((s."outputId" IS NOT NULL AND u.metadata->>'sourceOutputId'=s."outputId" AND u.metadata->>'jobId'=s."jobId")
            OR EXISTS(SELECT 1 FROM library_organization_aliases a WHERE a.user_id=$1 AND a.alias_type='legacy'
              AND a.reference->>'assetId'=u.asset_id AND a.reference->>'kind'=s.kind))))
      ORDER BY u.asset_id LIMIT 1001
    ) candidate GROUP BY s.type,s.id,s.kind`;
}
export function legacySourceSql(lock: boolean): string {
    return `WITH seeds AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS s(${sourceSeedColumns})), candidates AS (
    SELECT candidate.asset_id, count(*) OVER (PARTITION BY s.type,s.id) AS neighborhood_size
    FROM seeds s CROSS JOIN LATERAL (
      SELECT u.asset_id,u.metadata FROM user_assets u WHERE u.user_id=$1 AND ${legacyKindSql()}=s.kind AND (
        (s.type='legacy' AND u.asset_id=s.id) OR (s.type='asset' AND u.asset_id=s.id)
        OR ((s.type='asset' OR s."jobId" IS NOT NULL)
          AND (s."jobId" IS NULL OR u.metadata->>'jobId' IS NULL OR u.metadata->>'jobId'=s."jobId")
          AND (s."outputId" IS NULL OR u.metadata->>'sourceOutputId' IS NULL OR u.metadata->>'sourceOutputId'=s."outputId")
          AND ((md5(u.url) IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.url IN(s.url,s.original,s.provenance)) OR (md5(u.metadata->>'originUrl') IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.metadata->>'originUrl' IN(s.url,s.original,s.provenance)))))
      ORDER BY (u.asset_id=s.id) DESC,u.asset_id LIMIT 1001
    ) candidate), retained AS MATERIALIZED (
      SELECT u.*,${legacyKindSql()} AS inferred_kind FROM user_assets u WHERE u.user_id=$1 AND (u.asset_id=ANY($3::text[]) OR u.asset_id IN (SELECT asset_id FROM candidates WHERE neighborhood_size<=1000))
    ), canonical_pairs AS (${canonicalLegacyPairsSql('retained u', 'TRUE')}), canonical_matches AS (${canonicalLegacyMatchesSql()})
    SELECT ${legacyProjection},matches.canonical_id AS "canonicalId"
    FROM user_assets u LEFT JOIN canonical_matches matches ON matches.legacy_id=u.asset_id
    WHERE u.user_id=$1 AND u.asset_id IN(SELECT asset_id FROM retained)
    ORDER BY u.asset_id${lock ? ' FOR UPDATE OF u' : ''}`;
}
export function outputSourceSql(lock: boolean): string {
    return `WITH seeds AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS s(${sourceSeedColumns})), candidates AS (
    SELECT candidate.id FROM seeds s CROSS JOIN LATERAL (
      SELECT o.id FROM job_outputs o WHERE o.user_id=$1 AND o.kind=s.kind AND (
        (s."outputId" IS NOT NULL AND o.id=s."outputId" AND o.job_id=s."jobId")
        OR (s.type='legacy' AND s."jobId" IS NOT NULL AND s."outputId" IS NULL AND o.job_id=s."jobId" AND COALESCE(o.storage_url,o.url)=s.original))
      ORDER BY o.id LIMIT 2
    ) candidate)
    SELECT ${outputProjection} FROM job_outputs o WHERE o.user_id=$1 AND o.id IN (SELECT id FROM candidates) ORDER BY o.id${lock ? ' FOR UPDATE OF o' : ''}`;
}
/** Similarity overflow is distinct from exact/materialized proof overflow. */
export function legacySimilarityLimitsSql(): string {
    return `WITH seeds AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS s(${sourceSeedColumns}))
    SELECT s.type,s.id,s.kind FROM seeds s WHERE (SELECT count(*) FROM (
      SELECT u.asset_id FROM user_assets u WHERE u.user_id=$1 AND ${legacyKindSql()}=s.kind AND (
        (s.type='legacy' AND u.asset_id=s.id) OR (s.type='asset' AND u.asset_id=s.id)
        OR ((s.type='asset' OR s."jobId" IS NOT NULL)
          AND (s."jobId" IS NULL OR u.metadata->>'jobId' IS NULL OR u.metadata->>'jobId'=s."jobId")
          AND (s."outputId" IS NULL OR u.metadata->>'sourceOutputId' IS NULL OR u.metadata->>'sourceOutputId'=s."outputId")
          AND ((md5(u.url) IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.url IN(s.url,s.original,s.provenance)) OR (md5(u.metadata->>'originUrl') IN(md5(s.url),md5(s.original),md5(s.provenance)) AND u.metadata->>'originUrl' IN(s.url,s.original,s.provenance)))))
      LIMIT 1001) neighborhood)>1000`;
}
