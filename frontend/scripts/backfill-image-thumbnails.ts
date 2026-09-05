import process from 'node:process';
import path from 'node:path';

import {
  getImageThumbnailBackfillExitCode,
  parseImageThumbnailBackfillOptions,
  runImageThumbnailBackfill,
} from './_lib/image-thumbnail-backfill';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  parseImageThumbnailBackfillOptions(args, process.env);

  const { config: loadEnv } = await import('dotenv');
  loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
  loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });
  const options = parseImageThumbnailBackfillOptions(args, process.env);

  await import('tsconfig-paths/lib/register');
  const { query, getDb } = await import('../src/lib/db');

  try {
    const dependencies = {
      query,
      onCandidate: (row: { job_id: string }, reasons: string[]) => {
        const prefix = options.mode === 'dry-run' ? '[image-thumb-backfill][dry-run]' : '[image-thumb-backfill]';
        console.log(`${prefix} ${row.job_id}: ${reasons.join(', ')}`);
      },
      onFailure: (row: { job_id: string }, error: unknown) => {
        console.error(`[image-thumb-backfill] failed for ${row.job_id}`, error);
      },
      ...(options.mode === 'apply'
        ? { createThumbnails: (await import('../server/image-thumbnails')).createImageThumbnailBatch }
        : {}),
    };
    const summary = await runImageThumbnailBackfill(options, dependencies);
    console.log(
      `[image-thumb-backfill] done scanned=${summary.scanned} candidates=${summary.candidates} ` +
        `updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed} ` +
        `lastScannedId=${summary.lastScannedId ?? 'none'} resumeAfterId=${summary.resumeAfterId} mode=${options.mode}`
    );
    process.exitCode = getImageThumbnailBackfillExitCode(options, summary);
  } finally {
    await getDb().end().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error('Image thumbnail backfill failed with unrecoverable error', error);
  process.exitCode = 1;
});
