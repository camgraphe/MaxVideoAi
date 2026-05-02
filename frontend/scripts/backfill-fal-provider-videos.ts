import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

type BackfillRow = {
  job_id: string;
  user_id: string | null;
  video_url: string;
  created_at: string;
};

type BackfillResult = {
  jobId: string;
  host: string | null;
  result: 'dry_run' | 'updated' | 'copy_failed' | 'skipped';
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === 'true' || raw.trim() === '1';
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function runLimited<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const { query } = await import('../src/lib/db');
  const { ensureFastStartVideo } = await import('../server/video-faststart');
  const { isManagedStorageUrl } = await import('../server/provider-output-policy');

  const dryRun = boolEnv('DRY_RUN', true);
  const limit = intEnv('LIMIT', 50, 1, 1000);
  const concurrency = intEnv('CONCURRENCY', 2, 1, 10);

  const rows = await query<BackfillRow>(
    `SELECT job_id, user_id, video_url, created_at
       FROM app_jobs
      WHERE provider = 'fal'
        AND status = 'completed'
        AND video_url ILIKE '%fal.media%'
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit]
  );

  const summary = {
    dryRun,
    found: rows.length,
    updated: 0,
    copyFailed: 0,
    skipped: 0,
  };

  const results: BackfillResult[] = [];

  await runLimited(rows, concurrency, async (row) => {
    const host = getHost(row.video_url);
    if (!/^https?:\/\//i.test(row.video_url) || isManagedStorageUrl(row.video_url)) {
      summary.skipped += 1;
      results.push({ jobId: row.job_id, host, result: 'skipped' });
      return;
    }

    if (dryRun) {
      results.push({ jobId: row.job_id, host, result: 'dry_run' });
      return;
    }

    const copiedUrl = await ensureFastStartVideo({
      jobId: row.job_id,
      userId: row.user_id,
      videoUrl: row.video_url,
    });

    if (!copiedUrl) {
      summary.copyFailed += 1;
      results.push({ jobId: row.job_id, host, result: 'copy_failed' });
      return;
    }

    await query(
      `UPDATE app_jobs
          SET video_url = $2,
              updated_at = NOW()
        WHERE job_id = $1
          AND provider = 'fal'
          AND status = 'completed'
          AND video_url ILIKE '%fal.media%'`,
      [row.job_id, copiedUrl]
    );

    summary.updated += 1;
    results.push({ jobId: row.job_id, host, result: 'updated' });
  });

  for (const result of results) {
    console.log(
      `[fal-video-backfill] job=${result.jobId} host=${result.host ?? 'unknown'} result=${result.result}`
    );
  }
  console.log(`[fal-video-backfill] summary=${JSON.stringify(summary)}`);
}

void main().catch((error) => {
  console.error('[fal-video-backfill] unrecoverable error', error);
  process.exit(1);
});
