import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

type BackfillRow = {
  id: number;
  job_id: string;
  user_id: string | null;
  thumb_url: string | null;
  render_ids: unknown;
  updated_at: string;
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const batchSize = Math.max(1, Number.parseInt(process.env.IMAGE_THUMB_BACKFILL_BATCH ?? '25', 10));

  const { query } = await import('../src/lib/db');
  const { ensureBillingSchema } = await import('../src/lib/schema');
  const { normalizeMediaUrl } = await import('../lib/media');
  const {
    buildStoredImageRenderEntries,
    parseStoredImageRenders,
    resolveHeroThumbFromRenders,
  } = await import('../lib/image-renders');
  const { createImageThumbnailBatch } = await import('../server/image-thumbnails');

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.error('Unable to ensure billing schema before image thumbnail backfill', error);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;
  let cursorUpdatedAt: string | null = null;
  let cursorId = 0;

  while (true) {
    const rows: BackfillRow[] = await query<BackfillRow>(
      `SELECT id, job_id, user_id, thumb_url, render_ids, updated_at
       FROM app_jobs
       WHERE video_url IS NULL
         AND render_ids IS NOT NULL
         AND hidden IS NOT TRUE
         AND (
           $2::timestamptz IS NULL
           OR (updated_at, id) > ($2::timestamptz, $3::bigint)
         )
       ORDER BY updated_at ASC, id ASC
       LIMIT $1`,
      [batchSize, cursorUpdatedAt, cursorId]
    );

    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      scanned += 1;
      const parsed = parseStoredImageRenders(row.render_ids);
      if (!parsed.entries.length) {
        skipped += 1;
        continue;
      }

      const needsFormatUpgrade = !parsed.hasStructuredEntries;
      const needsMissingThumb = parsed.entries.some((entry) => !entry.thumbUrl || entry.thumbUrl === entry.url);
      const normalizedHeroThumb = normalizeMediaUrl(row.thumb_url);
      const normalizedHeroSource = normalizeMediaUrl(parsed.entries[0]?.url) ?? parsed.entries[0]?.url ?? null;
      const needsHeroThumb =
        !normalizedHeroThumb || (normalizedHeroSource ? normalizedHeroThumb === normalizedHeroSource : false);

      if (!needsFormatUpgrade && !needsMissingThumb && !needsHeroThumb) {
        skipped += 1;
        continue;
      }

      try {
        const generatedThumbs = await createImageThumbnailBatch({
          jobId: row.job_id,
          userId: row.user_id ?? null,
          imageUrls: parsed.entries.map((entry) => entry.url),
        });
        const mergedEntries = parsed.entries.map((entry, index) => ({
          ...entry,
          thumbUrl: generatedThumbs[index] ?? entry.thumbUrl ?? null,
        }));
        const storedEntries = buildStoredImageRenderEntries(mergedEntries);
        const heroThumb = resolveHeroThumbFromRenders(mergedEntries);

        if (dryRun) {
          console.log(
            `[image-thumb-backfill][dry-run] ${row.job_id}: entries=${storedEntries.length} heroThumb=${heroThumb ?? 'null'}`
          );
          updated += 1;
          continue;
        }

        await query(
          `UPDATE app_jobs
           SET render_ids = $2::jsonb,
               thumb_url = COALESCE($3, thumb_url),
               preview_frame = COALESCE(preview_frame, $3),
               updated_at = NOW()
           WHERE job_id = $1`,
          [row.job_id, JSON.stringify(storedEntries), heroThumb]
        );
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`[image-thumb-backfill] failed for ${row.job_id}`, error);
      }
    }

    const last = rows[rows.length - 1];
    cursorUpdatedAt = last.updated_at;
    cursorId = last.id;
  }

  console.log(
    `[image-thumb-backfill] done scanned=${scanned} updated=${updated} skipped=${skipped} failed=${failed} dryRun=${dryRun}`
  );
}

void main().catch((error) => {
  console.error('Image thumbnail backfill failed with unrecoverable error', error);
  process.exit(1);
});
