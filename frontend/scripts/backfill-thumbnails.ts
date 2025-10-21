import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

import { query } from '../src/lib/db';
import { ensureBillingSchema } from '../src/lib/schema';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '../server/thumbnails';
import { normalizeMediaUrl } from '../lib/media';

type BackfillRow = {
  job_id: string;
  user_id: string | null;
  video_url: string | null;
  thumb_url: string | null;
  aspect_ratio: string | null;
  visibility: string | null;
  indexable: boolean | null;
};

async function main(): Promise<void> {
  const batchSize = Number(process.env.THUMBNAIL_BACKFILL_BATCH ?? '25');

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.error('Unable to ensure billing schema before thumbnail backfill', error);
    process.exit(1);
  }

  let processed = 0;
  while (true) {
    const rows = await query<BackfillRow>(
      `SELECT job_id, user_id, video_url, thumb_url, aspect_ratio, visibility, indexable
       FROM app_jobs
       WHERE video_url IS NOT NULL
         AND visibility = 'public'
         AND COALESCE(indexable, TRUE)
         AND (
           thumb_url IS NULL
           OR thumb_url = ''
           OR thumb_url LIKE '/assets/frames/%'
         )
       ORDER BY updated_at ASC
       LIMIT $1`,
      [batchSize]
    );

    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      const videoUrl = row.video_url ?? undefined;
      const existingThumb = row.thumb_url ?? undefined;
      if (!videoUrl) {
        console.warn(`[thumb-backfill] Missing video URL for job ${row.job_id}, skipping.`);
        continue;
      }
      if (!/^https?:\/\//i.test(videoUrl)) {
        console.warn(`[thumb-backfill] Video URL for job ${row.job_id} is not absolute (${videoUrl}), skipping.`);
        continue;
      }

      try {
        const newThumb = await ensureJobThumbnail({
          jobId: row.job_id,
          userId: row.user_id ?? undefined,
          videoUrl,
          aspectRatio: row.aspect_ratio ?? undefined,
          existingThumbUrl: existingThumb,
          force: true,
        });

        if (!newThumb || (!isPlaceholderThumbnail(existingThumb) && newThumb === normalizeMediaUrl(existingThumb))) {
          console.log(`[thumb-backfill] No update required for job ${row.job_id}`);
          continue;
        }

        await query(
          `UPDATE app_jobs
           SET thumb_url = $2,
               preview_frame = $2,
               updated_at = NOW()
           WHERE job_id = $1`,
          [row.job_id, newThumb]
        );
        console.log(`[thumb-backfill] Updated thumbnail for job ${row.job_id}`);
        processed += 1;
      } catch (error) {
        console.error(`[thumb-backfill] Failed to process job ${row.job_id}`, error);
      }
    }

    if (rows.length < batchSize) {
      break;
    }
  }

  console.log(`Thumbnail backfill complete. Updated ${processed} job(s).`);
}

void main().catch((error) => {
  console.error('Thumbnail backfill encountered an unrecoverable error', error);
  process.exit(1);
});
