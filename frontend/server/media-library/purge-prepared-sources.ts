import { createHash } from 'node:crypto';
import type { QueryExecutor } from '@/lib/db';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import { resolveStudioMedia, type StudioMediaExecutor } from '@/server/studio/media-resolver';
import { creatorSourceFingerprint } from '@/server/tools/creator-sources';
import { organizationSourceGroups } from './organization-identity';
import { readOrganizationSourceBatch, referenceIdentity, sourceIdentity, sourceReference, type OrganizationSource } from './organization-sources';

export type PreparedPurgeEdge = { assetId: string; reference: ToolAssetRef; source: ToolAssetRef; lineage: string; fingerprint: string };
export type RetainedPreparedSource = { id: string; assetId: string; sizeBytes: number | null; reason: string };
type Candidate = { id: string; public_id: string; kind: 'image' | 'video' | 'audio'; size_bytes: string | number | null; source_job_id: string | null; source_output_id: string | null; lineage_name: string; lineage: Record<string, unknown> };
const MAX_PREPARED_SOURCES = 1000;
const MAX_PREPARED_TOTAL = 10000;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
type Fingerprints = { excerpt: string; creator: string };
type ParentRow = Awaited<ReturnType<StudioMediaExecutor>>[number] & { purge_reference: ToolAssetRef };

/** Batch the exact owner/availability checks used by Studio, then reuse its media
 * serialization for producer fingerprints. No per-reference SQL or storage HEAD. */
async function readParentFingerprints(userId: string, references: ToolAssetRef[], executor: QueryExecutor, cache: Map<string, Fingerprints | null>): Promise<void> {
  const wanted = [...new Map(references.map(ref => [referenceIdentity(ref), ref])).entries()].filter(([key]) => !cache.has(key));
  if (!wanted.length) return;
  wanted.forEach(([key]) => cache.set(key, null));
  const requested = `WITH requested AS (SELECT reference FROM jsonb_to_recordset($2::jsonb) AS r(reference jsonb))`;
  const rows: ParentRow[] = [];
  const assets = wanted.flatMap(([, reference]) => reference.type === 'asset' ? [{ reference }] : []);
  if (assets.length) rows.push(...await executor.query<ParentRow>(`${requested}
    SELECT a.*,j.hidden,j.user_id AS job_user_id,r.reference AS purge_reference
    FROM requested r JOIN media_assets a ON a.user_id=$1 AND a.public_id=r.reference->>'assetId' AND a.kind=r.reference->>'kind'
    LEFT JOIN job_outputs source_output ON source_output.id=a.source_output_id
    LEFT JOIN app_jobs j ON j.job_id=COALESCE(a.source_job_id,source_output.job_id)
    WHERE a.status='ready' AND a.deleted_at IS NULL AND j.hidden IS NOT TRUE
      AND (a.source_job_id IS NULL OR j.user_id=$1)
      AND (a.source_output_id IS NULL OR (source_output.user_id=$1 AND source_output.status='ready' AND j.user_id=$1
        AND (a.source_job_id IS NULL OR a.source_job_id=source_output.job_id)))`, [userId, JSON.stringify(assets)]));
  const outputs = wanted.flatMap(([, reference]) => reference.type === 'job-output' ? [{ reference }] : []);
  if (outputs.length) rows.push(...await executor.query<ParentRow>(`${requested}
    SELECT o.*,j.hidden,j.user_id AS job_user_id,r.reference AS purge_reference
    FROM requested r JOIN job_outputs o ON o.user_id=$1 AND o.job_id=r.reference->>'jobId' AND o.id=r.reference->>'outputId' AND o.kind=r.reference->>'kind'
    JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=$1
    WHERE o.status='ready' AND j.hidden IS NOT TRUE`, [userId, JSON.stringify(outputs)]));
  for (const row of rows) {
    try {
      const current = await resolveStudioMedia(userId, row.purge_reference, async () => [row]);
      cache.set(referenceIdentity(row.purge_reference), { excerpt: createHash('sha256').update(JSON.stringify(current)).digest('hex'), creator: creatorSourceFingerprint(current) });
    } catch { /* Unsupported or foreign storage remains unproven. */ }
  }
}

/** Reads only. The planner locks the complete discovered union, then repeats this
 * proof in the same transaction. A typed edge alone never authorizes child deletion. */
export async function discoverPreparedPurgeSources(userId: string, roots: OrganizationSource[], executor: QueryExecutor) {
  const sources = new Map(roots.map(source => [sourceIdentity(source), source]));
  const prepared: PreparedPurgeEdge[] = [];
  const retained = new Map<string, RetainedPreparedSource>();
  const fingerprints = new Map<string, Fingerprints | null>();
  const rootCount = sources.size;
  // The bulk confirmation path may contain 10,000 independent roots. Its bound
  // grows with that exact selection; it is never a global 1,000-media truncation.
  const maxPreparedSources = Math.min(MAX_PREPARED_TOTAL, MAX_PREPARED_SOURCES * Math.max(1, rootCount));
  let frontier = roots;
  for (let depth = 0; frontier.length; depth++) {
    if (depth >= 8) throw new Error('PURGE_SOURCE_GRAPH_LIMIT');
    const references = frontier.flatMap(source => source.type === 'job-output' || (source.type === 'asset' && source.publicId)
      ? [sourceReference(source) as ToolAssetRef] : []);
    if (!references.length) break;
    const candidates = await executor.query<Candidate>(`WITH wanted AS (
      SELECT DISTINCT reference FROM jsonb_to_recordset($2::jsonb) AS r(reference jsonb))
      SELECT m.id,m.public_id,m.kind,m.size_bytes,m.source_job_id,m.source_output_id,lineage.name AS lineage_name,lineage.value AS lineage
      FROM media_assets m CROSS JOIN LATERAL (VALUES
        ('videoExcerpt',m.metadata->'videoExcerpt'),('audioExcerpt',m.metadata->'audioExcerpt'),('creator',m.metadata->'creator')) lineage(name,value)
      JOIN wanted ON lineage.value->'source'=wanted.reference
      WHERE m.user_id=$1 AND m.status='ready' AND m.deleted_at IS NULL AND jsonb_typeof(lineage.value)='object'
        AND lineage.value->'generation' IS NULL
      ORDER BY m.id,lineage.name LIMIT $3`, [userId, JSON.stringify(references.map(reference => ({ reference }))), maxPreparedSources + 1]);
    if (candidates.length > maxPreparedSources) throw new Error('PURGE_SOURCE_GRAPH_LIMIT');
    const accepted: Candidate[] = [];
    await readParentFingerprints(userId, candidates.map(candidate => candidate.lineage.source as ToolAssetRef), executor, fingerprints);
    for (const candidate of candidates) {
      if (sources.has(JSON.stringify(['asset', candidate.id, candidate.kind]))) continue;
      const ref = object(candidate.lineage.source) as ToolAssetRef | null;
      const retain = (reason: string) => {
        const size = Number(candidate.size_bytes);
        retained.set(candidate.id, { id: candidate.id, assetId: candidate.public_id, sizeBytes: candidate.size_bytes !== null && Number.isSafeInteger(size) && size >= 0 ? size : null, reason });
      };
      const range = object(candidate.lineage.range);
      const supported = ref?.kind === candidate.kind && !candidate.source_job_id && !candidate.source_output_id && (
        candidate.lineage_name === 'creator' ? candidate.lineage.version === 1
          : candidate.lineage.version === 3 && candidate.lineage_name === `${candidate.kind}Excerpt` && range
            && typeof range.startSec === 'number' && typeof range.endSec === 'number' && range.startSec >= 0 && range.endSec > range.startSec);
      if (!supported || typeof candidate.lineage.sourceFingerprint !== 'string') { retain('UNVERIFIED_PREPARATION_LINEAGE'); continue; }
      const current = fingerprints.get(referenceIdentity(ref!));
      if (!current || candidate.lineage.sourceFingerprint !== current[candidate.lineage_name === 'creator' ? 'creator' : 'excerpt']) {
        retain('PREPARATION_SOURCE_VERSION_UNPROVEN'); continue;
      }
      accepted.push(candidate);
    }
    if (!accepted.length) break;
    const batch = await readOrganizationSourceBatch(userId, accepted.map(candidate => ({ type: 'asset', assetId: candidate.public_id, kind: candidate.kind })), executor);
    const groups = organizationSourceGroups(batch.sources);
    const blocked = new Set(batch.proofLimitedSourceIds);
    frontier = [];
    for (const candidate of accepted) {
      const key = JSON.stringify(['asset', candidate.id, candidate.kind]);
      const group = groups.get(key);
      if (!group || group.some(source => blocked.has(sourceIdentity(source)) || source.type === 'job-output' || source.jobId)) throw new Error('PURGE_PREPARATION_PROOF_CHANGED');
      prepared.push({ assetId: candidate.public_id, reference: { type: 'asset', assetId: candidate.public_id, kind: candidate.kind }, source: candidate.lineage.source as ToolAssetRef, lineage: candidate.lineage_name, fingerprint: candidate.lineage.sourceFingerprint as string });
      retained.delete(candidate.id);
      for (const source of group) if (!sources.has(sourceIdentity(source))) { sources.set(sourceIdentity(source), source); frontier.push(source); }
      if (sources.size - rootCount > maxPreparedSources) throw new Error('PURGE_SOURCE_GRAPH_LIMIT');
    }
  }
  return { sources: [...sources.values()].sort((a, b) => sourceIdentity(a).localeCompare(sourceIdentity(b))), prepared: prepared.sort((a, b) => a.assetId.localeCompare(b.assetId)), retainedPrepared: [...retained.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
