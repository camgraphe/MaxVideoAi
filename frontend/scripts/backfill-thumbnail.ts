import 'dotenv/config';
import { parseArgs } from 'node:util';
import { query } from '@/lib/db';
import { ensureJobThumbnail } from '@/server/thumbnails';

interface JobRow {
  job_id: string;
  user_id: string | null;
  video_url: string | null;
  aspect_ratio: string | null;
  thumb_url: string | null;
}

async function main() {
  const {
    values: { jobs },
  } = parseArgs({ options: { jobs: { type: 'string', multiple: true } } });

  if (!jobs || jobs.length === 0) {
    throw new Error('Specify at least one --jobs job_id');
  }

  const rows = await query<JobRow>(
    `SELECT job_id, user_id, video_url, aspect_ratio, thumb_url FROM app_jobs WHERE job_id = ANY($1)`,
    [jobs]
  );

  for (const job of rows) {
    if (!job.video_url) {
      console.warn(`[backfill] job ${job.job_id} has no video_url, skipping.`);
      continue;
    }

    const url = await ensureJobThumbnail({
      jobId: job.job_id,
      userId: job.user_id,
      videoUrl: job.video_url,
      aspectRatio: job.aspect_ratio,
      existingThumbUrl: job.thumb_url,
      force: true,
    });

    if (url) {
      await query(`UPDATE app_jobs SET thumb_url = $1, updated_at = NOW() WHERE job_id = $2`, [url, job.job_id]);
      console.info(`[backfill] Updated ${job.job_id} -> ${url}`);
    } else {
      console.warn(`[backfill] Failed to generate thumbnail for ${job.job_id}`);
    }
  }
}

main().catch((error) => {
  console.error('[backfill-thumbnail] fatal', error);
  process.exit(1);
});
