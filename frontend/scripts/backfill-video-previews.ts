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
  preview_video_url: string | null;
  created_at: string;
};

type BackfillResult = {
  jobId: string;
  host: string | null;
  result: 'dry_run' | 'updated' | 'preview_failed' | 'skipped';
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
  const { ensureJobPreviewVideo } = await import('../server/video-preview');

  const dryRun = boolEnv('DRY_RUN', true);
  const limit = intEnv('LIMIT', 50, 1, 1000);
  const concurrency = intEnv('CONCURRENCY', 2, 1, 6);

  const rows = await query<BackfillRow>(
    `SELECT job_id, user_id, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, created_at
       FROM app_jobs
      WHERE status = 'completed'
        AND COALESCE(video_url, '') <> ''
        AND (to_jsonb(app_jobs)->>'preview_video_url' IS NULL OR to_jsonb(app_jobs)->>'preview_video_url' = '')
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit]
  );

  const summary = {
    dryRun,
    found: rows.length,
    updated: 0,
    previewFailed: 0,
    skipped: 0,
  };
  const results: BackfillResult[] = [];

  await runLimited(rows, concurrency, async (row) => {
    const host = getHost(row.video_url);
    if (!/^https?:\/\//i.test(row.video_url) || row.preview_video_url) {
      summary.skipped += 1;
      results.push({ jobId: row.job_id, host, result: 'skipped' });
      return;
    }

    if (dryRun) {
      results.push({ jobId: row.job_id, host, result: 'dry_run' });
      return;
    }

    const previewUrl = await ensureJobPreviewVideo({
      jobId: row.job_id,
      userId: row.user_id,
      videoUrl: row.video_url,
      existingPreviewVideoUrl: row.preview_video_url,
    });

    if (!previewUrl) {
      summary.previewFailed += 1;
      results.push({ jobId: row.job_id, host, result: 'preview_failed' });
      return;
    }

    await query(
      `UPDATE app_jobs
          SET preview_video_url = $2,
              updated_at = NOW()
        WHERE job_id = $1
          AND status = 'completed'
          AND (preview_video_url IS NULL OR preview_video_url = '')`,
      [row.job_id, previewUrl]
    );

    summary.updated += 1;
    results.push({ jobId: row.job_id, host, result: 'updated' });
  });

  for (const result of results) {
    console.log(`[video-preview-backfill] job=${result.jobId} host=${result.host ?? 'unknown'} result=${result.result}`);
  }
  console.log(`[video-preview-backfill] summary=${JSON.stringify(summary)}`);
}

void main().catch((error) => {
  console.error('[video-preview-backfill] unrecoverable error', error);
  process.exit(1);
});
