import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

import { query } from '../src/lib/db';
import { detectHasAudioStream } from '../server/media/detect-has-audio';

async function main(): Promise<void> {
  const sampleSize = Number.parseInt(process.env.AUDIO_BACKFILL_SAMPLE ?? '2', 10) || 2;
  const engineFilter = process.env.AUDIO_BACKFILL_ENGINE?.trim() ?? null;
  const onlyMissing = (process.env.AUDIO_BACKFILL_ONLY_MISSING ?? 'true').toLowerCase() !== 'false';

  const conditions: string[] = ['video_url IS NOT NULL'];
  if (onlyMissing) {
    conditions.push('(has_audio IS NULL OR has_audio = FALSE)');
  }
  if (engineFilter) {
    conditions.push('engine_id ILIKE $2');
  }

  const sql = `SELECT job_id, video_url, has_audio
     FROM app_jobs
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT $1`;

  const params = engineFilter ? [sampleSize, engineFilter] : [sampleSize];
  const rows = await query<{ job_id: string; video_url: string | null; has_audio: boolean | null }>(sql, params);

  if (!rows.length) {
    console.log('[audio-backfill] no jobs with video_url found.');
    return;
  }

  for (const row of rows) {
    const videoUrl = row.video_url;
    if (!videoUrl) {
      console.warn(`[audio-backfill] job ${row.job_id} has no video URL, skipping.`);
      continue;
    }

    console.log(`[audio-backfill] probing audio for job ${row.job_id} ...`);
    const detected = await detectHasAudioStream(videoUrl);

    if (detected === null) {
      console.warn(`[audio-backfill] unable to determine audio presence for job ${row.job_id}.`);
      continue;
    }

    if (row.has_audio === detected) {
      console.log(`[audio-backfill] no change for job ${row.job_id} (${detected ? 'audio' : 'no audio'}).`);
      continue;
    }

    await query(
      `UPDATE app_jobs
       SET has_audio = $2,
           updated_at = NOW()
       WHERE job_id = $1`,
      [row.job_id, detected]
    );
    console.log(`[audio-backfill] updated job ${row.job_id} → has_audio=${detected}`);
  }

  console.log('[audio-backfill] completed.');
}

void main().catch((error) => {
  console.error('[audio-backfill] unrecoverable error', error);
  process.exit(1);
});
