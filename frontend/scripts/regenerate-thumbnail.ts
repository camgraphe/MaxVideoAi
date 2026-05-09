import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

type JobRow = {
  job_id: string;
  user_id: string | null;
  surface: string | null;
  video_url: string | null;
  audio_url: string | null;
  preview_video_url: string | null;
  aspect_ratio: string | null;
  thumb_url: string | null;
  render_ids: unknown;
  duration_sec: number | null;
  status: string | null;
};

async function main(): Promise<void> {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: pnpm ts-node --transpile-only scripts/regenerate-thumbnail.ts <job_id>');
    process.exit(1);
  }

  const { query } = await import('../src/lib/db');
  const { ensureBillingSchema } = await import('../src/lib/schema');
  const { upsertLegacyJobOutputs } = await import('../server/media-library');
  const { ensureJobThumbnail } = await import('../server/thumbnails');

  await ensureBillingSchema();
  const rows = await query<JobRow>(
    `SELECT job_id, user_id, surface, video_url, audio_url, preview_video_url, aspect_ratio, thumb_url, render_ids, duration_sec, status
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
  await upsertLegacyJobOutputs({
    job_id: job.job_id,
    user_id: job.user_id,
    surface: job.surface,
    video_url: job.video_url,
    audio_url: job.audio_url,
    thumb_url: newThumb,
    preview_frame: newThumb,
    preview_video_url: job.preview_video_url,
    render_ids: job.render_ids,
    duration_sec: job.duration_sec,
    status: job.status,
  });

  console.log(`Job ${jobId}: thumbnail updated to ${newThumb}`);
}

void main().catch((error) => {
  console.error('[regenerate-thumbnail] failed', error);
  process.exit(1);
});
