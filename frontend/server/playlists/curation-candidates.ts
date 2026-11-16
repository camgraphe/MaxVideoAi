import { marketingVideoReader } from '@/server/marketing-media/public-read';
import { query, type QueryExecutor } from '@/lib/db';
import type { CurationItem } from '@/lib/admin/playlist-curation';
import { videoOutputDimensionSelect } from '../videos-query';
import { CURATION_ELIGIBILITY } from './curation-eligibility';
import { getCurationAliases, CurationError } from './curation-store';
import { getCurationCandidateAliases } from './curation-candidate-aliases';

export async function listCurationCandidates(slug: string, db: QueryExecutor = { query }, aliases = getCurationAliases(slug), retainedOnly = false): Promise<CurationItem[]> {
  if (!aliases) throw new CurationError('Automatic curation is not supported for this destination', 400);
  const rows = await marketingVideoReader(db).query<{
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
       ${retainedOnly ? `AND job_id IN (
         SELECT selected.id FROM playlists p JOIN playlist_curations c ON c.playlist_id=p.id
         CROSS JOIN LATERAL jsonb_array_elements_text(to_jsonb(c.ordered_ids) ||
           CASE WHEN jsonb_typeof(to_jsonb(c)->'opening_ids')='array' THEN to_jsonb(c)->'opening_ids' ELSE '[]'::jsonb END) selected(id)
         WHERE p.slug=$2
       )` : ''}
     ORDER BY created_at DESC, job_id ASC`,
    [aliases.map((alias) => alias.toLowerCase()), ...(retainedOnly ? [slug] : [])],
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

/** Preserve saved family clips that the public reader still admits, without widening new-media discovery. */
export async function listRetainedFamilyCurationCandidates(slug: string, db: QueryExecutor = { query }): Promise<CurationItem[]> {
  if (!slug.startsWith('family-')) return [];
  const discoveryAliases = new Set(getCurationCandidateAliases(slug) ?? []);
  const retainedAliases = (getCurationAliases(slug) ?? []).filter(alias => !discoveryAliases.has(alias.toLowerCase()));
  return retainedAliases.length ? listCurationCandidates(slug, db, retainedAliases, true) : [];
}
