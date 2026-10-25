import { query, type QueryExecutor } from '@/lib/db';
import type { MarketingMediaFile, MarketingMediaItem } from '@/lib/marketing-media';
import { imageThumbFallbackSelect, PUBLIC_VIDEO_SOURCE_ELIGIBILITY } from '@/server/videos-query';
import { record, type MarketingSource } from './snapshot';

export type MarketingRow = {
  video_id: string;
  copy_id: string;
  state: MarketingMediaItem['state'];
  tombstone: boolean;
  source_user_id: string | null;
  source_fingerprint: string;
  source_snapshot: Record<string, unknown>;
  source_record: MarketingSource;
  publication: Record<string, unknown>;
  recreation_snapshot: Record<string, unknown>;
  files: MarketingMediaFile[];
  size_bytes: string | number;
  attempt_id: string;
  lease_until: Date | string | null;
  copied_by: string;
  permission_confirmed: boolean;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};
export function marketingMediaEnabled() {
  return process.env.MARKETING_MEDIA_ENABLED === '1';
}
export async function readMarketingRow(
  videoId: string,
  db: QueryExecutor = { query },
  lock = false,
): Promise<MarketingRow | null> {
  const rows = await db.query<MarketingRow>(
    `SELECT * FROM marketing_media WHERE video_id=$1${lock ? ' FOR UPDATE' : ''}`,
    [videoId],
  );
  return rows[0] ?? null;
}
export async function readMarketingSource(videoId: string, db: QueryExecutor): Promise<MarketingSource | null> {
  const rows = await db.query<MarketingSource>(
    `SELECT to_jsonb(app_jobs) AS job,
   COALESCE(NULLIF(app_jobs.thumb_url,''), (${imageThumbFallbackSelect('app_jobs')})) AS poster_url,
   (SELECT to_jsonb(o) FROM job_outputs o WHERE o.job_id=app_jobs.job_id AND o.kind='video'
    AND COALESCE(o.url,o.storage_url)=app_jobs.video_url AND o.status NOT IN ('deleted','failed') ORDER BY o.position,o.created_at LIMIT 1) AS output
   FROM app_jobs WHERE job_id=$1 AND ${PUBLIC_VIDEO_SOURCE_ELIGIBILITY} LIMIT 1`,
    [videoId],
  );
  return rows[0] ?? null;
}
export function marketingItem(row: MarketingRow): MarketingMediaItem {
  const publication = record(row.publication);
  const source = record(row.source_record?.job);
  return {
    videoId: row.video_id,
    state: row.state,
    visibility: publication.visibility === 'public' ? 'public' : 'private',
    prompt: String(publication.prompt ?? source.prompt ?? ''),
    engineLabel: String(publication.engine_label ?? source.engine_label ?? ''),
    ...(row.state === 'ready'
      ? {
          videoUrl: String(publication.video_url),
          thumbUrl: typeof publication.thumb_url === 'string' ? publication.thumb_url : undefined,
          recreationSnapshot: row.recreation_snapshot,
        }
      : {}),
    copyActive: row.state === 'copying' && Boolean(row.lease_until && new Date(row.lease_until).getTime() > Date.now()),
    sizeBytes: Number(row.size_bytes),
    createdAt: new Date(row.created_at).toISOString(),
    error: row.last_error ?? undefined,
    placements: [],
  };
}
