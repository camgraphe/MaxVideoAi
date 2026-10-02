import type {TimelineExportJobRecord} from './repository';
import type {TimelineExportJobResponse} from './contracts';
import {canonicalTimelineExportMediaUrl} from './media-security';
import {query} from '@/lib/db';
import {extractStorageKeyFromUrl} from '@/server/storage';

function nullableTimelineExportSize(value: string | number | null): number | null {
  if (value === null) return null;
  const size = Number(value);
  return Number.isFinite(size) ? size : null;
}

export function timelineExportJobResponse(job: TimelineExportJobRecord): TimelineExportJobResponse {
  const outputUrl = job.status === 'completed' ? job.output_url : null;

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
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

/** Stable projection: neither polling nor session persistence carries expiring grants. */
export async function ownedTimelineExportJobResponse(job: TimelineExportJobRecord, userId: string) {
  if (!userId || job.user_id !== userId) throw new Error('EXPORT_NOT_FOUND');
  const response = timelineExportJobResponse(job);
  if (!response.artifact) return response;
  const canonicalOriginalUrl = canonicalTimelineExportMediaUrl({
    url: response.artifact.outputUrl,userId,requestOrigin: 'https://maxvideoai.com',
  });
  return {...response,artifact: {...response.artifact,canonicalOriginalUrl,
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
