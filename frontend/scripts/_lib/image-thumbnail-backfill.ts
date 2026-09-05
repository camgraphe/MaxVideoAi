import { buildStoredImageRenderEntries, parseStoredImageRenders } from '../../lib/image-renders';
import { normalizeMediaUrl } from '../../lib/media';

export type BackfillRow = {
  id: number | string;
  job_id: string;
  user_id: string | null;
  thumb_url: string | null;
  render_ids: unknown;
  updated_at: string;
};

export type ImageThumbnailBackfillOptions = {
  mode: 'dry-run' | 'apply';
  batchSize: number;
  maxRows: number;
  afterId: string;
};

export type ImageThumbnailBackfillSummary = {
  scanned: number;
  candidates: number;
  updated: number;
  skipped: number;
  failed: number;
  lastScannedId: string | null;
  resumeAfterId: string;
};

type ThumbnailBatchInput = { jobId: string; userId: string | null; imageUrls: string[] };

export type ImageThumbnailBackfillDependencies = {
  query<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]>;
  createThumbnails?: (input: ThumbnailBatchInput) => Promise<Array<string | null>>;
  onCandidate?: (row: BackfillRow, reasons: string[]) => void;
  onFailure?: (row: BackfillRow, error: unknown) => void;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ROWS = 100;
const MAX_BATCH_SIZE = 100;
const MAX_TOTAL_ROWS = 10_000;
const POSTGRES_BIGINT_MAX = BigInt('9223372036854775807');

function readOptionValue(args: string[], index: number, name: string): { value: string; consumed: number } | null {
  const argument = args[index];
  if (argument === `--${name}`) return { value: args[index + 1] ?? '', consumed: 2 };
  const prefix = `--${name}=`;
  return argument?.startsWith(prefix) ? { value: argument.slice(prefix.length), consumed: 1 } : null;
}

function parseBoundedInteger(label: string, raw: string | undefined, fallback: number, maximum: number): number {
  const value = raw === undefined ? String(fallback) : raw;
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

function parseAfterId(raw: string | undefined): string {
  const value = raw ?? '0';
  if (!/^\d+$/.test(value)) {
    throw new Error(`after id must be an integer between 0 and ${POSTGRES_BIGINT_MAX}`);
  }
  const parsed = BigInt(value);
  if (parsed > POSTGRES_BIGINT_MAX) {
    throw new Error(`after id must be an integer between 0 and ${POSTGRES_BIGINT_MAX}`);
  }
  return parsed.toString();
}

export function parseImageThumbnailBackfillOptions(
  args: string[],
  env: Readonly<Record<string, string | undefined>>
): ImageThumbnailBackfillOptions {
  let apply = false;
  let dryRun = false;
  let batchRaw: string | undefined;
  let maxRaw: string | undefined;
  let afterIdRaw: string | undefined;

  for (let index = 0; index < args.length; ) {
    const argument = args[index];
    if (argument === '--apply') {
      apply = true;
      index += 1;
      continue;
    }
    if (argument === '--dry-run') {
      dryRun = true;
      index += 1;
      continue;
    }
    const batch = readOptionValue(args, index, 'batch-size');
    if (batch) {
      if (batchRaw !== undefined) throw new Error('--batch-size may only be provided once');
      batchRaw = batch.value;
      index += batch.consumed;
      continue;
    }
    const max = readOptionValue(args, index, 'max');
    if (max) {
      if (maxRaw !== undefined) throw new Error('--max may only be provided once');
      maxRaw = max.value;
      index += max.consumed;
      continue;
    }
    const afterId = readOptionValue(args, index, 'after-id');
    if (afterId) {
      if (afterIdRaw !== undefined) throw new Error('after id may only be provided once');
      afterIdRaw = afterId.value;
      index += afterId.consumed;
      continue;
    }
    throw new Error(`Unknown option: ${argument ?? ''}`);
  }
  if (apply && dryRun) throw new Error('--apply and --dry-run cannot be used together');

  return {
    mode: apply ? 'apply' : 'dry-run',
    batchSize: parseBoundedInteger(
      'batch size',
      batchRaw ?? env.IMAGE_THUMB_BACKFILL_BATCH,
      DEFAULT_BATCH_SIZE,
      MAX_BATCH_SIZE
    ),
    maxRows: parseBoundedInteger(
      'max rows',
      maxRaw ?? env.IMAGE_THUMB_BACKFILL_MAX,
      DEFAULT_MAX_ROWS,
      MAX_TOTAL_ROWS
    ),
    afterId: parseAfterId(afterIdRaw),
  };
}

function isMissingThumbnail(url: string, thumbnail: string | null | undefined): boolean {
  const normalizedUrl = normalizeMediaUrl(url) ?? url;
  const normalizedThumbnail = normalizeMediaUrl(thumbnail);
  return !normalizedThumbnail || normalizedThumbnail === normalizedUrl;
}

function validExistingHero(row: BackfillRow, firstUrl: string): string | null {
  const hero = normalizeMediaUrl(row.thumb_url);
  const source = normalizeMediaUrl(firstUrl) ?? firstUrl;
  return hero && hero !== source ? hero : null;
}

export async function runImageThumbnailBackfill(
  options: ImageThumbnailBackfillOptions,
  dependencies: ImageThumbnailBackfillDependencies
): Promise<ImageThumbnailBackfillSummary> {
  if (options.mode === 'apply' && !dependencies.createThumbnails) {
    throw new Error('Apply mode requires a thumbnail creator');
  }
  const summary: ImageThumbnailBackfillSummary = {
    scanned: 0,
    candidates: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    lastScannedId: null,
    resumeAfterId: options.afterId,
  };
  let cursorId = options.afterId;
  let checkpointCanAdvance = true;

  while (summary.scanned < options.maxRows) {
    const pageSize = Math.min(options.batchSize, options.maxRows - summary.scanned);
    const rows: BackfillRow[] = await dependencies.query<BackfillRow>(
      `SELECT id, job_id, user_id, thumb_url, render_ids, updated_at::text AS updated_at
       FROM app_jobs
       WHERE video_url IS NULL
         AND render_ids IS NOT NULL
         AND hidden IS NOT TRUE
         AND id > $2
       ORDER BY id ASC
       LIMIT $1`,
      [pageSize, cursorId]
    );
    if (!rows.length) break;

    for (const row of rows) {
      summary.scanned += 1;
      const rowId = BigInt(row.id).toString();
      cursorId = rowId;
      summary.lastScannedId = rowId;
      const parsed = parseStoredImageRenders(row.render_ids);
      if (!parsed.entries.length) {
        summary.skipped += 1;
        if (checkpointCanAdvance) summary.resumeAfterId = rowId;
        continue;
      }
      const missingIndexes = parsed.entries.reduce<number[]>((indexes, entry, index) => {
        if (isMissingThumbnail(entry.url, entry.thumbUrl)) indexes.push(index);
        return indexes;
      }, []);
      const existingHero = validExistingHero(row, parsed.entries[0]!.url);
      const reasons = [
        ...(!parsed.hasStructuredEntries ? ['render format'] : []),
        ...(missingIndexes.length ? ['missing thumbnails'] : []),
        ...(!existingHero ? ['hero thumbnail'] : []),
      ];
      if (!reasons.length) {
        summary.skipped += 1;
        if (checkpointCanAdvance) summary.resumeAfterId = rowId;
        continue;
      }

      summary.candidates += 1;
      dependencies.onCandidate?.(row, reasons);
      if (options.mode === 'dry-run') {
        if (checkpointCanAdvance) summary.resumeAfterId = rowId;
        continue;
      }

      let candidateFailed = false;
      try {
        const generated = missingIndexes.length
          ? await dependencies.createThumbnails!({
              jobId: row.job_id,
              userId: row.user_id,
              imageUrls: missingIndexes.map((index) => parsed.entries[index]!.url),
            })
          : [];
        const mergedEntries = parsed.entries.map((entry) => ({ ...entry }));
        let repairedCount = 0;
        missingIndexes.forEach((entryIndex, generatedIndex) => {
          const thumbnail = normalizeMediaUrl(generated[generatedIndex]);
          const original = normalizeMediaUrl(mergedEntries[entryIndex]!.url) ?? mergedEntries[entryIndex]!.url;
          if (thumbnail && thumbnail !== original) {
            mergedEntries[entryIndex]!.thumbUrl = thumbnail;
            repairedCount += 1;
          } else {
            candidateFailed = true;
          }
        });
        if (missingIndexes.length && repairedCount === 0) {
          summary.failed += 1;
          checkpointCanAdvance = false;
          continue;
        }

        const firstEntry = mergedEntries[0];
        const heroThumb =
          existingHero ?? normalizeMediaUrl(firstEntry?.thumbUrl) ?? normalizeMediaUrl(firstEntry?.url) ?? null;
        const updatedRows = await dependencies.query<{ id: number | string }>(
          `UPDATE app_jobs
           SET render_ids = $2::jsonb,
               thumb_url = COALESCE($3, thumb_url),
               preview_frame = COALESCE(preview_frame, $3),
               updated_at = NOW()
           WHERE id = $1
             AND updated_at IS NOT DISTINCT FROM $4::timestamptz
             AND render_ids IS NOT DISTINCT FROM $5::jsonb
             AND thumb_url IS NOT DISTINCT FROM $6::text
           RETURNING id`,
          [
            row.id,
            JSON.stringify(buildStoredImageRenderEntries(mergedEntries)),
            heroThumb,
            row.updated_at,
            JSON.stringify(row.render_ids),
            row.thumb_url,
          ]
        );
        if (!updatedRows.length) {
          summary.failed += 1;
          checkpointCanAdvance = false;
          dependencies.onFailure?.(row, new Error('row changed during repair'));
          continue;
        }
        summary.updated += 1;
        if (candidateFailed) {
          summary.failed += 1;
          checkpointCanAdvance = false;
        } else if (checkpointCanAdvance) {
          summary.resumeAfterId = rowId;
        }
      } catch (error) {
        summary.failed += 1;
        checkpointCanAdvance = false;
        dependencies.onFailure?.(row, error);
      }
    }
    if (rows.length < pageSize) break;
  }
  return summary;
}

export function getImageThumbnailBackfillExitCode(
  options: ImageThumbnailBackfillOptions,
  summary: ImageThumbnailBackfillSummary
): number {
  return options.mode === 'apply' && summary.failed > 0 ? 1 : 0;
}
