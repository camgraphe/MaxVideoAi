import type {TimelineExportJobRecord} from './repository';
import type {TimelineExportJobResponse} from './contracts';
import {canonicalTimelineExportMediaUrl} from './media-security';
import {query, type QueryExecutor} from '@/lib/db';
import {resolveStudioMedia} from '@/server/studio/media-resolver';
import {extractStorageKeyFromUrl} from '@/server/storage';

function nullableTimelineExportSize(value: string | number | null): number | null {
  if (value === null) return null;
  const size = Number(value);
  return Number.isFinite(size) ? size : null;
}

export function timelineExportJobResponse(job: TimelineExportJobRecord): TimelineExportJobResponse {
  const outputUrl = job.status === 'completed' ? job.output_url : null;
  const amountCents = Number(job.amount_cents);
  const billing = Number.isSafeInteger(amountCents) && amountCents >= 0
    && typeof job.currency === 'string' && /^[A-Z]{3}$/.test(job.currency)
    && (job.billing_kind === 'free' || job.billing_kind === 'paid')
    ? {amountCents,currency: job.currency,billingKind: job.billing_kind} : null;

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    ...(billing ? {billing} : {}),
    artifact: outputUrl
      ? {
        outputUrl,
        outputAssetId: job.output_asset_id,
        sizeBytes: nullableTimelineExportSize(job.output_size_bytes),
        mimeType: job.output_mime_type,
      }
      : null,
  };
}

/** Export rows historically store media_assets.id; Studio refs require public_id. */
async function ownedOutputPublicAssetId(job: TimelineExportJobRecord, userId: string, executor: QueryExecutor): Promise<string | null> {
  if (!job.output_asset_id || !job.output_url) return null;
  const rows = await executor.query<{public_id: string}>(
    `SELECT public_id FROM media_assets
      WHERE user_id = $1 AND (id = $2 OR public_id = $2) AND url = $3
        AND kind = 'video' AND status = 'ready' AND deleted_at IS NULL LIMIT 1`,
    [userId,job.output_asset_id,job.output_url],
  );
  const publicId = rows[0]?.public_id;
  if (!publicId) return null;
  try {
    const media = await resolveStudioMedia(userId,{type: 'asset',assetId: publicId,kind: 'video'},(sql,values) => executor.query(sql,values));
    return media.url === job.output_url ? publicId : null;
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE') return null;
    throw error;
  }
}

/** Stable projection: neither polling nor session persistence carries expiring grants. */
export async function ownedTimelineExportJobResponse(job: TimelineExportJobRecord, userId: string, executor: QueryExecutor = {query}) {
  if (!userId || job.user_id !== userId) throw new Error('EXPORT_NOT_FOUND');
  const response = timelineExportJobResponse(job);
  if (!response.artifact) return response;
  const canonicalOriginalUrl = canonicalTimelineExportMediaUrl({
    url: response.artifact.outputUrl,userId,requestOrigin: 'https://maxvideoai.com',
  });
  const outputAssetId = await ownedOutputPublicAssetId(job,userId,executor);
  return {...response,artifact: {...response.artifact,canonicalOriginalUrl,outputAssetId,
    outputUrl: extractStorageKeyFromUrl(canonicalOriginalUrl)
      ? `/api/studio/timeline-exports/${encodeURIComponent(job.id)}/media`
      : canonicalOriginalUrl,
  }};
}

/** Delivery reads never bootstrap schema, mutate billing or restart a completed export. */
export async function readOwnedCompletedTimelineExport(params: {userId: string; exportId: string}) {
  const rows = await query<TimelineExportJobRecord>(
    `SELECT * FROM app_timeline_exports WHERE id = $1 AND user_id = $2 AND status = 'completed' LIMIT 1`,
    [params.exportId,params.userId],
  );
  const job = rows[0];
  return job?.user_id === params.userId && job.status === 'completed' && job.output_url ? job : null;
}
