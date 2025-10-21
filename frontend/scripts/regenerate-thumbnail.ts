import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

import { query } from '../src/lib/db';
import { ensureBillingSchema } from '../src/lib/schema';
import { ensureJobThumbnail } from '../server/thumbnails';

async function main(): Promise<void> {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: pnpm ts-node --transpile-only scripts/regenerate-thumbnail.ts <job_id>');
    process.exit(1);
  }

  await ensureBillingSchema();
  const rows = await query<{ job_id: string; user_id: string | null; video_url: string | null; aspect_ratio: string | null; thumb_url: string | null }>(
    `SELECT job_id, user_id, video_url, aspect_ratio, thumb_url
       FROM app_jobs
      WHERE job_id = $1
      LIMIT 1`,
    [jobId]
  );

  if (!rows.length) {
    console.error(`Job ${jobId} not found`);
    process.exit(1);
  }

  const job = rows[0];
  if (!job.video_url) {
    console.error(`Job ${jobId} has no video_url; cannot regenerate thumbnail.`);
    process.exit(1);
  }

  const newThumb = await ensureJobThumbnail({
    jobId: job.job_id,
    userId: job.user_id ?? undefined,
    videoUrl: job.video_url,
    aspectRatio: job.aspect_ratio ?? undefined,
    existingThumbUrl: job.thumb_url ?? undefined,
    force: true,
  });

  if (!newThumb) {
    console.warn(`Job ${jobId}: ensureJobThumbnail returned null (possibly disabled).`);
    return;
  }

  await query(
    `UPDATE app_jobs
       SET thumb_url = $2,
           preview_frame = $2,
           updated_at = NOW()
     WHERE job_id = $1`,
    [jobId, newThumb]
  );

  console.log(`Job ${jobId}: thumbnail updated to ${newThumb}`);
}

void main().catch((error) => {
  console.error('[regenerate-thumbnail] failed', error);
  process.exit(1);
});
