import { query } from '@/lib/db';
import {
  mapPlaylistCandidateRow,
  type PlaylistCandidateRow,
} from './mappers';
import type { PlaylistCandidateRecord } from './types';

export async function searchPlaylistCandidates(options: {
  q?: string | null;
  engine?: string | null;
  limit?: number;
}): Promise<PlaylistCandidateRecord[]> {
  const q = options.q?.trim() ?? '';
  const engine = options.engine?.trim() ?? '';
  const limit = Number.isFinite(options.limit) ? Math.min(Math.max(Number(options.limit), 1), 40) : 18;
  const params: unknown[] = [];
  const clauses = [
    `COALESCE(hidden, FALSE) = FALSE`,
    `visibility = 'public'`,
    `COALESCE(indexable, TRUE) = TRUE`,
    `COALESCE(thumb_url, '') <> ''`,
    `(
      COALESCE(video_url, '') <> ''
      OR COALESCE(surface, '') = 'image'
      OR COALESCE(render_ids::text, '') <> ''
      OR EXISTS (
        SELECT 1
          FROM job_outputs jo
         WHERE jo.job_id = app_jobs.job_id
           AND jo.kind = 'image'
           AND COALESCE(jo.thumb_url, jo.url, jo.storage_url, '') <> ''
      )
    )`,
  ];

  if (q.length) {
    params.push(`%${q}%`);
    const qIndex = params.length;
    clauses.push(`(
      job_id ILIKE $${qIndex}
      OR prompt ILIKE $${qIndex}
      OR COALESCE(engine_id, '') ILIKE $${qIndex}
      OR COALESCE(engine_label, '') ILIKE $${qIndex}
    )`);
  }

  if (engine.length) {
    params.push(`%${engine}%`);
    const engineIndex = params.length;
    clauses.push(`(
      COALESCE(engine_id, '') ILIKE $${engineIndex}
      OR COALESCE(engine_label, '') ILIKE $${engineIndex}
    )`);
  }

  params.push(limit);
  const limitIndex = params.length;

  const rows = await query<PlaylistCandidateRow>(
    `SELECT job_id, engine_id, engine_label, prompt, created_at,
            COALESCE(
              NULLIF(thumb_url, ''),
              (
                SELECT COALESCE(NULLIF(jo.thumb_url, ''), NULLIF(jo.url, ''), NULLIF(jo.storage_url, ''))
                  FROM job_outputs jo
                 WHERE jo.job_id = app_jobs.job_id
                   AND jo.kind = 'image'
                 ORDER BY jo.created_at ASC
                 LIMIT 1
              )
            ) AS thumb_url,
            video_url,
            aspect_ratio
       FROM app_jobs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}`,
    params
  );

  return rows.map(mapPlaylistCandidateRow);
}
