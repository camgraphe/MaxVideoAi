import { query } from '@/lib/db';
import { readMediaFacts } from '@/lib/media-identity';
import { normalizeMetadata, normalizeString, type MediaAssetRecord } from '../media-library-records';

function measuredDuration(metadata: unknown): number | undefined {
  const record = normalizeMetadata(metadata);
  const duration = readMediaFacts(record.mediaFacts)?.durationSec ?? record.measuredDurationSec;
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

/** Read-only compatibility for saved copies predating audio measurement on promotion. */
export async function projectMissingAudioDurations(userId: string, assets: MediaAssetRecord[]): Promise<MediaAssetRecord[]> {
  const requested = assets.filter(asset => asset.userId === userId && asset.kind === 'audio'
    && asset.source === 'saved_job_output' && asset.status === 'ready' && !asset.durationSec)
    .map(asset => ({
      id: asset.id,
      job_id: asset.sourceJobId ?? normalizeString(asset.metadata.jobId) ?? normalizeString(asset.metadata.sourceJobId),
      output_id: asset.sourceOutputId,
      origin_url: typeof asset.metadata.originUrl === 'string' && asset.metadata.originUrl ? asset.metadata.originUrl : asset.url,
    }))
    .filter(asset => asset.job_id);
  if (!requested.length) return assets;
  // Listing caps a page at 100. Exact-origin reads pass one selected asset.
  if (requested.length > 100) throw new Error('AUDIO_DURATION_PROJECTION_LIMIT');
  const rows = await query<{ id: string; output_metadata: unknown; job_metadata: unknown }>(
    `/* media-library:audio-duration-projection */
     WITH requested AS (
       SELECT * FROM jsonb_to_recordset($2::jsonb)
         AS r(id text, job_id text, output_id text, origin_url text)
     )
     SELECT r.id, o.metadata AS output_metadata,
            CASE WHEN j.audio_url = r.origin_url THEN j.settings_snapshot END AS job_metadata
       FROM requested r
       JOIN app_jobs j ON j.job_id = r.job_id AND j.user_id = $1
         AND j.status = 'completed' AND j.hidden IS NOT TRUE
       LEFT JOIN LATERAL (
         SELECT output.id, output.metadata
           FROM job_outputs output
          WHERE output.job_id = j.job_id AND output.user_id = $1
            AND output.kind = 'audio' AND output.status = 'ready'
            AND (output.url = r.origin_url OR output.storage_url = r.origin_url)
            AND (r.output_id IS NULL OR output.id = r.output_id)
          ORDER BY output.id
          LIMIT 1
       ) o ON TRUE
      WHERE o.id IS NOT NULL OR (r.output_id IS NULL AND j.audio_url = r.origin_url)`,
    [userId, JSON.stringify(requested)]
  );
  const durations = new Map(rows.map(row => [row.id, measuredDuration(row.output_metadata) ?? measuredDuration(row.job_metadata)]));
  return assets.map(asset => {
    const durationSec = durations.get(asset.id);
    return durationSec === undefined ? asset : { ...asset, durationSec };
  });
}
