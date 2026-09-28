import { query, type QueryExecutor } from '@/lib/db';
import type { CurationItem } from '@/lib/admin/playlist-curation';
import { videoOutputDimensionSelect } from '../videos-query';
import { CURATION_ELIGIBILITY } from './curation-eligibility';
import { getCurationAliases, CurationError } from './curation-store';

export async function listCurationCandidates(slug: string, db: QueryExecutor = { query }, aliases = getCurationAliases(slug)): Promise<CurationItem[]> {
  if (!aliases) throw new CurationError('Automatic curation is not supported for this destination', 400);
  const rows = await db.query<{
    job_id: string;
    engine_id: string;
    engine_label: string | null;
    prompt: string | null;
    thumb_url: string | null;
    video_url: string;
    created_at: string;
    output_width: number | null; output_height: number | null; aspect_ratio: string | null;
  }>(
    `SELECT job_id,engine_id,engine_label,prompt,thumb_url,video_url,created_at,aspect_ratio,
       (${videoOutputDimensionSelect('app_jobs', 'width')}) AS output_width,
       (${videoOutputDimensionSelect('app_jobs', 'height')}) AS output_height
     FROM app_jobs WHERE ${CURATION_ELIGIBILITY}
       AND LOWER(engine_id)=ANY($1::text[])
     ORDER BY created_at DESC, job_id ASC`,
    [aliases.map((alias) => alias.toLowerCase())],
  );
  return rows.map((row) => ({
    id: row.job_id,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    prompt: row.prompt ?? '',
    thumbUrl: row.thumb_url,
    videoUrl: row.video_url,
    createdAt: new Date(row.created_at).toISOString(),
    outputWidth: row.output_width, outputHeight: row.output_height, aspectRatio: row.aspect_ratio,
  }));
}

