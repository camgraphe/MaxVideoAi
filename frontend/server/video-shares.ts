import { randomBytes } from 'node:crypto';
import { query } from '@/lib/db';
import { isStablePublicMediaUrl } from '@/lib/media';

type VideoShareSourceType = 'job_output' | 'media_asset' | 'user_asset' | 'job';
type QueryFn = typeof query;
type VideoShareSource = { sourceType: VideoShareSourceType; sourceId: string; url: string; thumbUrl: string | null };
type VideoSourceRow = { id: string; url: string; thumb_url: string | null };
type VideoShareRow = { token: string; user_id: string; source_type: VideoShareSourceType; source_id: string };

export type CreateVideoShareInput = {
  userId: string;
  url: string;
  assetId?: string | null;
  sourceOutputId?: string | null;
  jobId?: string | null;
};

const first = <T,>(rows: T[]): T | null => rows[0] ?? null;

export function publicExampleDownloadSource(value: string): URL | null {
  if (!isStablePublicMediaUrl(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'media.maxvideoai.com' && !url.port && !url.username && !url.password ? url : null;
  } catch { return null; }
}

async function findOwnedVideoSource(input: CreateVideoShareInput, dbQuery: QueryFn): Promise<VideoShareSource | null> {
  const { userId, url } = input;
  if (input.sourceOutputId) {
    const row = first(await dbQuery<VideoSourceRow>(
      `SELECT o.id, o.url, o.thumb_url FROM job_outputs o
         JOIN app_jobs j ON j.job_id = o.job_id
        WHERE o.id = $1 AND j.user_id = $2 AND o.kind = 'video' AND o.url = $3
          AND o.status NOT IN ('deleted', 'failed') LIMIT 1`,
      [input.sourceOutputId, userId, url]
    ));
    if (row) return { sourceType: 'job_output', sourceId: row.id, url: row.url, thumbUrl: row.thumb_url };
  }

  if (input.assetId) {
    const row = first(await dbQuery<VideoSourceRow>(
      `SELECT id, url, thumb_url FROM media_assets
        WHERE id = $1 AND user_id = $2 AND kind = 'video' AND url = $3
          AND deleted_at IS NULL AND status = 'ready' LIMIT 1`,
      [input.assetId, userId, url]
    ));
    if (row) return { sourceType: 'media_asset', sourceId: row.id, url: row.url, thumbUrl: row.thumb_url };
  }

  if (input.jobId) {
    const output = first(await dbQuery<VideoSourceRow>(
      `SELECT o.id, o.url, o.thumb_url FROM job_outputs o
         JOIN app_jobs j ON j.job_id = o.job_id
        WHERE o.job_id = $1 AND j.user_id = $2 AND o.kind = 'video' AND o.url = $3
          AND o.status NOT IN ('deleted', 'failed') LIMIT 1`,
      [input.jobId, userId, url]
    ));
    if (output) return { sourceType: 'job_output', sourceId: output.id, url: output.url, thumbUrl: output.thumb_url };

    const job = first(await dbQuery<VideoSourceRow>(
      `SELECT job_id AS id, video_url AS url, thumb_url
         FROM app_jobs WHERE job_id = $1 AND user_id = $2 AND video_url = $3
          AND status = 'completed' LIMIT 1`,
      [input.jobId, userId, url]
    ));
    if (job) return { sourceType: 'job', sourceId: job.id, url: job.url, thumbUrl: job.thumb_url };
  }

  if (input.assetId) {
    const row = first(await dbQuery<VideoSourceRow>(
      `SELECT asset_id AS id, url, metadata->>'thumbUrl' AS thumb_url
         FROM user_assets WHERE asset_id = $1 AND user_id = $2 AND url = $3
          AND (mime_type LIKE 'video/%' OR url ~* '\\.(mp4|webm|mov|m4v)([?#].*)?$') LIMIT 1`,
      [input.assetId, userId, url]
    ));
    if (row) return { sourceType: 'user_asset', sourceId: row.id, url: row.url, thumbUrl: row.thumb_url };
  }
  return null;
}

export async function createOrGetVideoShareLink(input: CreateVideoShareInput, dbQuery: QueryFn = query): Promise<string | null> {
  const source = await findOwnedVideoSource(input, dbQuery);
  if (!source || !isStablePublicMediaUrl(source.url)) return null;
  const token = randomBytes(24).toString('base64url');
  const row = first(await dbQuery<{ token: string }>(
    `INSERT INTO video_share_links (token, user_id, source_type, source_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, source_type, source_id) WHERE revoked_at IS NULL
     DO UPDATE SET source_id = EXCLUDED.source_id
     RETURNING token`,
    [token, input.userId, source.sourceType, source.sourceId]
  ));
  return row?.token ?? null;
}

async function readCurrentVideoSource(link: VideoShareRow, dbQuery: QueryFn): Promise<VideoSourceRow | null> {
  const { source_id: sourceId, user_id: userId } = link;
  if (link.source_type === 'job_output') {
    return first(await dbQuery<VideoSourceRow>(
      `SELECT o.id, o.url, o.thumb_url FROM job_outputs o
         JOIN app_jobs j ON j.job_id = o.job_id
        WHERE o.id = $1 AND j.user_id = $2 AND o.kind = 'video'
          AND o.status NOT IN ('deleted', 'failed') LIMIT 1`,
      [sourceId, userId]
    ));
  }
  if (link.source_type === 'media_asset') {
    return first(await dbQuery<VideoSourceRow>(
      `SELECT id, url, thumb_url FROM media_assets
        WHERE id = $1 AND user_id = $2 AND kind = 'video'
          AND deleted_at IS NULL AND status = 'ready' LIMIT 1`,
      [sourceId, userId]
    ));
  }
  if (link.source_type === 'user_asset') {
    return first(await dbQuery<VideoSourceRow>(
      `SELECT asset_id AS id, url, metadata->>'thumbUrl' AS thumb_url FROM user_assets
        WHERE asset_id = $1 AND user_id = $2
          AND (mime_type LIKE 'video/%' OR url ~* '\\.(mp4|webm|mov|m4v)([?#].*)?$') LIMIT 1`,
      [sourceId, userId]
    ));
  }
  return first(await dbQuery<VideoSourceRow>(
    `SELECT job_id AS id, video_url AS url, thumb_url FROM app_jobs
      WHERE job_id = $1 AND user_id = $2 AND status = 'completed' LIMIT 1`,
    [sourceId, userId]
  ));
}

export async function getSharedVideo(token: string, dbQuery: QueryFn = query): Promise<{ url: string; thumbUrl: string | null } | null> {
  if (!/^[a-zA-Z0-9_-]{32}$/.test(token)) return null;
  const link = first(await dbQuery<VideoShareRow>(
    `SELECT token, user_id, source_type, source_id FROM video_share_links
      WHERE token = $1 AND revoked_at IS NULL LIMIT 1`,
    [token]
  ));
  if (!link) return null;
  const source = await readCurrentVideoSource(link, dbQuery);
  if (!source || !isStablePublicMediaUrl(source.url)) return null;
  return { url: source.url, thumbUrl: isStablePublicMediaUrl(source.thumb_url) ? source.thumb_url : null };
}

export async function revokeVideoShareLink(token: string, userId: string, dbQuery: QueryFn = query): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{32}$/.test(token)) return false;
  const rows = await dbQuery<{ token: string }>(
    `UPDATE video_share_links SET revoked_at = NOW()
      WHERE token = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING token`,
    [token, userId]
  );
  return rows.length > 0;
}
