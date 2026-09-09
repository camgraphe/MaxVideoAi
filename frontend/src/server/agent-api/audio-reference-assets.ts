import { query, type QueryExecutor } from '@/lib/db';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { isAllowedAssetHost } from '@/server/storage';

import { AgentApiError } from './errors';
import type { CanonicalAudioRequest } from './audio-normalization';
import type { ResolvedAudioReference } from './audio-quote-snapshot';
import type { AgentPrincipal } from './principal';

type AudioReferenceRow = {
  original_url: unknown;
  kind: unknown;
  mime_type: unknown;
  duration_sec: unknown;
  width: unknown;
  height: unknown;
  size_bytes: unknown;
  metadata: unknown;
};

function invalidReference(code: 'REFERENCE_NOT_FOUND' | 'REFERENCE_INVALID' = 'REFERENCE_INVALID'): never {
  throw new AgentApiError(code, code === 'REFERENCE_NOT_FOUND'
    ? 'Reference media not found.'
    : 'Reference media is not usable.');
}

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function metadataDuration(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return finitePositive((value as Record<string, unknown>).durationSec);
}

function safeOriginalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4_096 || !isAllowedAssetHost(value)) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && (!parsed.port || parsed.port === '443')
      ? value
      : null;
  } catch {
    return null;
  }
}

export async function resolveOwnedAudioReference(
  principal: AgentPrincipal,
  reference: CanonicalAudioRequest['references'][number],
  dependencies: { executor?: QueryExecutor } = {},
): Promise<ResolvedAudioReference> {
  if (!principal || principal.authMethod !== 'oauth' || !principal.userId?.trim()) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before using reference media.');
  }
  const parsed = toolAssetRefSchema.safeParse(reference.asset);
  if (!parsed.success) invalidReference();
  const expectedKind = reference.role === 'source_video' ? 'video' : 'audio';
  if (parsed.data.kind !== expectedKind) invalidReference();
  const executor = dependencies.executor ?? { query };
  const rows = parsed.data.type === 'asset'
    ? await executor.query<AudioReferenceRow>(
      `SELECT a.url AS original_url, a.kind, a.mime_type,
              NULL::double precision AS duration_sec, a.width, a.height,
              a.size_bytes, a.metadata
         FROM media_assets a
         LEFT JOIN app_jobs source_job ON source_job.job_id = a.source_job_id
        WHERE a.public_id = $1
          AND a.user_id = $2
          AND a.kind = $3
          AND a.status = 'ready'
          AND a.deleted_at IS NULL
          AND (a.source_job_id IS NULL OR (
            source_job.user_id = $2
            AND source_job.status = 'completed'
            AND source_job.hidden IS NOT TRUE
          ))
        LIMIT 1`,
      [parsed.data.assetId, principal.userId, expectedKind],
    )
    : await executor.query<AudioReferenceRow>(
      `SELECT COALESCE(o.storage_url, o.url) AS original_url, o.kind, o.mime_type,
              o.duration_sec, o.width, o.height, NULL::bigint AS size_bytes, o.metadata
         FROM job_outputs o
         JOIN app_jobs j ON j.job_id = o.job_id
        WHERE o.id = $1
          AND o.job_id = $2
          AND o.user_id = $3
          AND o.kind = $4
          AND o.status = 'ready'
          AND j.user_id = $3
          AND j.status = 'completed'
          AND j.hidden IS NOT TRUE
        LIMIT 1`,
      [parsed.data.outputId, parsed.data.jobId, principal.userId, expectedKind],
    );
  const row = rows[0];
  if (!row) invalidReference('REFERENCE_NOT_FOUND');
  const originalUrl = safeOriginalUrl(row.original_url);
  if (!originalUrl || row.kind !== expectedKind) invalidReference();
  const dimension = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
  const sizeBytes = finitePositive(row.size_bytes);
  return {
    role: reference.role,
    asset: parsed.data,
    originalUrl,
    mimeType: typeof row.mime_type === 'string' && row.mime_type.trim() ? row.mime_type.trim().toLowerCase() : null,
    durationSec: metadataDuration(row.metadata) ?? finitePositive(row.duration_sec),
    width: dimension(row.width),
    height: dimension(row.height),
    sizeBytes: sizeBytes && Number.isSafeInteger(sizeBytes) ? sizeBytes : null,
  };
}
