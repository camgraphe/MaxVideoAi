import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

type UploadAssetRow = {
  id: string;
  user_id: string | null;
  kind: 'image' | 'video';
  url: string;
};

function parseArgInt(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseArgString(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  return raw?.length ? raw : null;
}

function parseArgList(name: string): string[] {
  return (
    parseArgString(name)
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  );
}

async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error('source image is empty');
  }
  return buffer;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limit = parseArgInt('limit', Number.parseInt(process.env.UPLOAD_THUMB_BACKFILL_LIMIT ?? '100', 10));
  const batchSize = parseArgInt('batch', Number.parseInt(process.env.UPLOAD_THUMB_BACKFILL_BATCH ?? '25', 10));
  const concurrency = parseArgInt('concurrency', Number.parseInt(process.env.UPLOAD_THUMB_BACKFILL_CONCURRENCY ?? '3', 10));
  const userId = parseArgString('user');
  const ids = parseArgList('ids');

  const { query, getDb } = await import('../src/lib/db');
  const { createUploadImageThumbnail, createUploadVideoThumbnail } = await import('../server/upload-thumbnails');

  async function markBackfillFailure(row: UploadAssetRow, reason: string): Promise<void> {
    const safeReason = reason.slice(0, 500);
    await query(
      `UPDATE media_assets
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('thumbnailBackfillFailedAt', NOW(), 'thumbnailBackfillError', $2::text)
       WHERE id = $1
         AND thumb_url IS NULL`,
      [row.id, safeReason]
    );
    await query(
      `UPDATE user_assets
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object('thumbnailBackfillFailedAt', NOW(), 'thumbnailBackfillError', $2::text)
       WHERE url = $1`,
      [row.url, safeReason]
    );
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const runLimited = pLimit(concurrency);

  try {
    while (scanned < limit) {
      const remaining = limit - scanned;
      const rows = await query<UploadAssetRow>(
        `SELECT id, user_id, kind, url
         FROM media_assets
         WHERE (
             source = 'upload'
             OR kind = 'video'
           )
           AND kind IN ('image', 'video')
           AND status = 'ready'
           AND deleted_at IS NULL
           AND thumb_url IS NULL
           AND metadata->>'thumbnailBackfillFailedAt' IS NULL
           AND ($2::text IS NULL OR user_id = $2::text)
           AND (COALESCE(array_length($3::text[], 1), 0) = 0 OR id = ANY($3::text[]))
         ORDER BY created_at ASC, id ASC
         LIMIT $1`,
        [Math.min(batchSize, remaining), userId, ids]
      );

      if (!rows.length) break;

      await Promise.all(rows.map((row) => runLimited(async () => {
        scanned += 1;
        try {
          if (dryRun) {
            console.log(`[upload-thumb-backfill][dry-run] ${row.id}: ${row.kind} would receive a thumbnail`);
            updated += 1;
            return;
          }

          const source = await fetchImage(row.url);
          const thumbUrl =
            row.kind === 'video'
              ? await createUploadVideoThumbnail({
                  data: source,
                  userId: row.user_id,
                  fileName: `${row.id}.mp4`,
                })
              : await createUploadImageThumbnail({
                  data: source,
                  userId: row.user_id,
                  fileName: `${row.id}.webp`,
                });

          if (!thumbUrl) {
            await markBackfillFailure(row, 'thumbnail creation returned null');
            skipped += 1;
            return;
          }

          await query(
            `UPDATE media_assets
             SET thumb_url = $2::text,
                 metadata = COALESCE(metadata, '{}'::jsonb)
                   || jsonb_build_object('thumbUrl', $2::text, 'thumbnailBackfilledAt', NOW())
             WHERE id = $1
               AND thumb_url IS NULL`,
            [row.id, thumbUrl]
          );

          await query(
            `UPDATE user_assets
             SET metadata = COALESCE(metadata, '{}'::jsonb)
               || jsonb_build_object('thumbUrl', $2::text, 'thumbnailBackfilledAt', NOW())
             WHERE url = $1`,
            [row.url, thumbUrl]
          );

          updated += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await markBackfillFailure(row, reason).catch(() => {});
          failed += 1;
          console.error(`[upload-thumb-backfill] failed for ${row.id}`, error);
        }
      })));
    }

    console.log(
      `[upload-thumb-backfill] done scanned=${scanned} updated=${updated} skipped=${skipped} failed=${failed} dryRun=${dryRun}`
    );
  } finally {
    await getDb().end().catch(() => {});
  }
}

void main().catch((error) => {
  console.error('Upload thumbnail backfill failed with unrecoverable error', error);
  process.exit(1);
});
