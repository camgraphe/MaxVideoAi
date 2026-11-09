import { assetProjection, legacyProjection, outputProjection, canonicalLegacyPairsSql, canonicalLegacyMatchesSql, legacyKindSql } from './organization-source-sql';
/** PostgreSQL JSON (not jsonb text) with explicit separators matches JSON.stringify's versioned payload. */
export const jsonArraySql = (...values: string[]) => `('[' || ${values.map(v => `COALESCE(to_json(${v})::text,'null')`).join(" || ',' || ")} || ']')`;
export const hashSql = (value: string) => `encode(sha256(convert_to(${value},'UTF8')),'hex')`;
export const revisionSql = (kind: string, original: string) => `('sr_' || ${hashSql(jsonArraySql("'v1'::text", kind, original))})`;
/** Read-only provenance relation. Organization remains independent of source/display URL equality.
 * The relation includes hidden-from-browse sources for identity proof, just as the mutation resolver does. */
export function libraryIdentityCtes(owner = '$1'): string {
    return `li_raw AS MATERIALIZED (
    SELECT ${assetProjection} FROM media_assets m WHERE m.user_id=${owner} AND m.deleted_at IS NULL AND m.status='ready'
    UNION ALL SELECT ${legacyProjection} FROM user_assets u WHERE u.user_id=${owner}
    UNION ALL SELECT ${outputProjection} FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id
      WHERE o.user_id=${owner} AND o.status='ready' AND j.hidden IS NOT TRUE
  ), li_output_proofs AS MATERIALIZED (
    SELECT ${outputProjection} FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id WHERE o.user_id=${owner}
  ), li_legacy_rows AS MATERIALIZED (SELECT u.*,${legacyKindSql()} AS inferred_kind FROM user_assets u WHERE u.user_id=${owner}),
  li_canonical_pairs AS (${canonicalLegacyPairsSql('li_legacy_rows u', 'TRUE', owner)}),
  li_canonical_matches AS (${canonicalLegacyMatchesSql('li_canonical_pairs')}), li_legacy_links AS MATERIALIZED (
    SELECT u.*,canonical.canonical_id FROM li_raw u LEFT JOIN li_canonical_matches canonical ON canonical.legacy_id=u.id WHERE u.type='legacy'
  ), li_neighborhoods AS (
    SELECT canonical_id,kind,count(*) AS neighborhood_size,bool_or(id=canonical_id) AS has_shared_id
    FROM li_legacy_links WHERE canonical_id IS NOT NULL GROUP BY canonical_id,kind
  ), li_link_ids AS MATERIALIZED (
    SELECT r.*,CASE WHEN r.type='asset' THEN r.id ELSE l.canonical_id END AS canonical_id
      FROM li_raw r LEFT JOIN li_legacy_links l ON r.type='legacy' AND l.id=r.id AND l.kind=r.kind
  ), li_linked AS MATERIALIZED (
    SELECT r.*,COALESCE(n.neighborhood_size,0) AS neighborhood_size,COALESCE(n.has_shared_id,false) AS has_shared_id
    FROM li_link_ids r LEFT JOIN li_neighborhoods n ON n.canonical_id=r.canonical_id AND n.kind=r.kind
  ), li_anchor_basis AS MATERIALIZED (
    SELECT r.*,COALESCE(a."jobId",r."jobId") AS anchor_job,COALESCE(a."outputId",r."outputId") AS reference_output,COALESCE(a.original,r.original) AS anchor_original
    FROM li_linked r LEFT JOIN li_raw a ON a.type='asset' AND a.id=r.canonical_id AND a.kind=r.kind
  ), li_anchors AS (
    SELECT r.*,CASE WHEN r.type='job-output' THEN r.id WHEN exact_output.id IS NOT NULL THEN exact_output.id
        WHEN r.type='legacy' AND r.canonical_id IS NULL THEN unique_output.id END AS anchor_output
    FROM li_anchor_basis r LEFT JOIN li_output_proofs exact_output ON exact_output.type='job-output' AND exact_output.kind=r.kind
      AND exact_output.id=r.reference_output AND exact_output."jobId"=r.anchor_job
    LEFT JOIN LATERAL (SELECT CASE WHEN count(*)=1 THEN min(o.id) END AS id FROM li_raw o
      WHERE r.type='legacy' AND r.canonical_id IS NULL AND r."jobId" IS NOT NULL AND o.type='job-output' AND o.kind=r.kind AND o."jobId"=r."jobId" AND o.original=r.original
      AND (r."outputId" IS NULL OR r."outputId"=o.id)) unique_output ON r.type='legacy' AND r.canonical_id IS NULL
  ), li_components AS (
    -- Shared record IDs are a component only through proven canonical correspondence.
    SELECT *,${revisionSql('kind', 'original')} AS revision,
      CASE WHEN anchor_output IS NOT NULL THEN ${jsonArraySql("'job-output'::text", 'anchor_job', 'anchor_output', revisionSql('kind', 'anchor_original'))}
        ELSE ${jsonArraySql("'record'::text", "CASE WHEN canonical_id IS NOT NULL THEN 'asset' ELSE type END", 'COALESCE(canonical_id,id)')} END AS component
    FROM li_anchors
  ), li_proofs AS (
    SELECT *, (type<>'legacy' OR id=canonical_id OR ("outputId" IS NOT NULL AND "outputId"=anchor_output AND "jobId"=anchor_job)
      OR EXISTS(SELECT 1 FROM library_organization_aliases a WHERE a.user_id=${owner} AND a.alias_type='legacy' AND a.alias_id=${hashSql(`('{\"type\":\"legacy\",\"assetId\":'||to_json(li_components.id)::text||',\"kind\":'||to_json(li_components.kind)::text||'}')`)})) AS identity_proof
    FROM li_components
  ), li_grouped AS (
    SELECT *,first_value(id) OVER w AS oldest_id,first_value(revision) OVER w AS oldest_revision,
      count(*) FILTER(WHERE type='legacy' AND identity_proof) OVER(PARTITION BY kind,component) AS legacy_count
    FROM li_proofs WINDOW w AS(PARTITION BY kind,component ORDER BY (neighborhood_size>1000 AND NOT identity_proof),"createdAt"::timestamptz,id COLLATE "C" ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
  ), li_keyed AS (
    SELECT *,('lo_' || ${hashSql(`('[' || to_json('v1'::text)::text || ',' || to_json(${owner}::text)::text || ',' || to_json(kind)::text || ',' || CASE WHEN anchor_output IS NOT NULL THEN component ELSE ${jsonArraySql("'record'::text", 'oldest_id', 'oldest_revision')} END || ']')`)}) AS derived_key
    FROM li_grouped
  ), li_alias_requests AS (
    SELECT r.kind,r.component,r.revision,r.type AS alias_type,
      ${hashSql(`CASE WHEN r.type='job-output' THEN ('{"type":"job-output","jobId":'||to_json(r."jobId")::text||',"outputId":'||to_json(r.id)::text||',"kind":'||to_json(r.kind)::text||'}')
        ELSE ('{"type":'||to_json(r.type)::text||',"assetId":'||to_json(COALESCE(r."publicId",r.id))::text||',"kind":'||to_json(r.kind)::text||'}') END`)} AS alias_id FROM li_keyed r
    UNION ALL
    SELECT r.kind,r.component,${revisionSql('r.kind', 'r.anchor_original')},'job-output',
      ${hashSql(`('{"type":"job-output","jobId":'||to_json(r.anchor_job)::text||',"outputId":'||to_json(r.anchor_output)::text||',"kind":'||to_json(r.kind)::text||'}')`)} FROM li_keyed r WHERE r.anchor_output IS NOT NULL
  ), li_persisted AS (
    SELECT r.kind,r.component,a.organization_key AS persisted_key FROM li_alias_requests r LEFT JOIN library_organization_aliases a
      ON a.user_id=${owner} AND a.source_revision=r.revision AND a.alias_type=r.alias_type AND a.alias_id=r.alias_id
  ), li_states AS (
    SELECT kind,component,min(persisted_key) AS persisted_key,count(DISTINCT persisted_key)>1 AS conflict FROM li_persisted GROUP BY kind,component
  ), library_identities AS MATERIALIZED (
    SELECT r.*,COALESCE(s.persisted_key,r.derived_key) AS organization_key,
      CASE WHEN s.conflict THEN 'ORGANIZATION_IDENTITY_CONFLICT' WHEN r.legacy_count>1000 THEN 'IDENTITY_PROOF_LIMIT'
        WHEN r.neighborhood_size>1000 AND r.anchor_output IS NULL AND s.persisted_key IS NULL
          AND (NOT r.has_shared_id OR (r.type='legacy' AND r.id<>r.canonical_id)) THEN 'IDENTITY_PROOF_LIMIT' END AS identity_error
    FROM li_keyed r JOIN li_states s USING(kind,component)
  )`;
}
