import { createHash } from 'node:crypto';
import { query, type QueryExecutor } from '@/lib/db';
import { LUMA_AGENTS_DIRECT_PROVIDER } from '@/server/video-providers/luma-agents/model-map';
import { AgentApiError } from './errors';

export type OwnedLumaGenerationSource = Readonly<{
  sourceJobId: string;
  sourceOutputIdentity: string;
  provider: typeof LUMA_AGENTS_DIRECT_PROVIDER;
  providerGenerationId: string;
  providerModel: 'ray-3.2';
  fingerprint: string;
}>;
type SourceRow = {
  owner_id: string; source_job_id: string; engine_id: string; surface: string; status: string;
  provider: string; provider_job_id: string; attempt_id: number; attempt_provider: string;
  attempt_model: string; attempt_status: string; attempt_provider_job_id: string;
  output_id: string; output_owner: string; output_status: string; original_url: string; output_url: string;
  source_hdr?: string; source_exr?: string; hidden?: boolean;
  asset_id?: string; asset_owner?: string; asset_status?: string; asset_deleted_at?: unknown;
};
function unavailable(): never {
  throw new AgentApiError('REFERENCE_INVALID', 'The source generation is not available.');
}
/** Read-only relational authority. No administrator bypass, provider calls, URL grants or schema bootstrap. */
export async function resolveOwnedLumaGenerationSource(input: {
  actor: { userId: string }; sourceJobId: string; expectedOutputAssetId?: string; expectedOutputId?: string; executor?: QueryExecutor;
}): Promise<OwnedLumaGenerationSource> {
  if (!input.actor.userId || typeof input.sourceJobId !== 'string' || !/^\S{1,255}$/u.test(input.sourceJobId)) unavailable();
  const executor = input.executor ?? { query };
  const rows = await executor.query<SourceRow>(`
    SELECT j.user_id AS owner_id, j.job_id AS source_job_id, j.engine_id, j.surface, j.status,
           j.provider, j.provider_job_id, j.video_url AS original_url, j.hidden,
           a.request_snapshot->>'hdr' AS source_hdr, a.request_snapshot->>'exrExport' AS source_exr,
           a.id AS attempt_id, a.provider AS attempt_provider, a.provider_model AS attempt_model,
           a.status AS attempt_status, a.provider_job_id AS attempt_provider_job_id,
           o.id AS output_id, o.user_id AS output_owner, o.status AS output_status,
           COALESCE(o.storage_url, o.url) AS output_url,
           m.public_id AS asset_id, m.user_id AS asset_owner, m.status AS asset_status, m.deleted_at AS asset_deleted_at
      FROM app_jobs j
      LEFT JOIN provider_attempts a ON a.job_id = j.id AND a.provider_job_id = j.provider_job_id
        AND a.provider = j.provider
      LEFT JOIN job_outputs o ON o.job_id = j.job_id AND o.user_id = j.user_id AND o.kind = 'video' AND o.position = 0
      LEFT JOIN media_assets m ON m.source_output_id = o.id AND m.source_job_id = j.job_id
        AND m.user_id = j.user_id AND m.public_id = $3
     WHERE j.job_id = $1 AND j.user_id = $2 LIMIT 2`,
  [input.sourceJobId, input.actor.userId, input.expectedOutputAssetId ?? null]);
  const row = rows[0];
  if (rows.length !== 1 || !row || row.owner_id !== input.actor.userId || row.source_job_id !== input.sourceJobId
    || row.hidden === true || row.source_hdr === 'true' || row.source_exr === 'true'
    || row.engine_id !== 'luma-ray-3-2' || row.surface !== 'video' || row.status !== 'completed'
    || row.provider !== LUMA_AGENTS_DIRECT_PROVIDER || !row.provider_job_id?.trim()
    || row.attempt_provider !== LUMA_AGENTS_DIRECT_PROVIDER || row.attempt_model !== 'ray-3.2'
    || row.attempt_status !== 'completed' || row.attempt_provider_job_id !== row.provider_job_id || !row.attempt_id
    || !row.output_id || row.output_owner !== input.actor.userId || row.output_status !== 'ready'
    || !row.original_url || row.original_url !== row.output_url
    || (input.expectedOutputId && row.output_id !== input.expectedOutputId)
    || (input.expectedOutputAssetId && (row.asset_id !== input.expectedOutputAssetId || row.asset_owner !== input.actor.userId
      || row.asset_status !== 'ready' || row.asset_deleted_at))) unavailable();
  const identity = [row.owner_id, row.source_job_id, row.output_id, row.engine_id, row.provider, row.provider_job_id, row.attempt_id];
  return { sourceJobId: row.source_job_id, sourceOutputIdentity: row.output_id, provider: LUMA_AGENTS_DIRECT_PROVIDER,
    providerGenerationId: row.provider_job_id, providerModel: 'ray-3.2', fingerprint: createHash('sha256').update(JSON.stringify(identity)).digest('hex') };
}

export async function resolveCanonicalLumaLineage(request: import('./generation-types').CanonicalGenerationRequest,
  actor: { userId: string }, executor?: QueryExecutor) {
  if (request.engineId !== 'luma-ray-3-2' || request.mode !== 'extend') return undefined;
  if (!request.sourceJobId || request.references.some(ref => ref.role !== 'source' || ref.kind !== 'asset') || request.references.length > 1) unavailable();
  return resolveOwnedLumaGenerationSource({ actor, sourceJobId: request.sourceJobId,
    expectedOutputId: request.sourceOutputId,
    expectedOutputAssetId: request.references[0]?.kind === 'asset' ? request.references[0].assetId : undefined, executor });
}
export function lumaLineageQuoteBinding(source: OwnedLumaGenerationSource | undefined, direction: unknown) {
  return source ? { lumaSource: { sourceJobId: source.sourceJobId, outputId: source.sourceOutputIdentity,
    fingerprint: source.fingerprint, direction: direction ?? 'forward', durationSec: 5, transport: source.provider } } : {};
}
