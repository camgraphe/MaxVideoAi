import { isStablePublicMediaUrl, normalizeMediaUrl } from '@/lib/media';
import { query as defaultQuery } from '@/lib/db';
import type { GalleryVideo } from '@/server/videos';
import type { WatchPageSourceImage } from '@/server/watch-page-signals';
import { asArray, asRecord, asString } from '@/server/watch-page-signals/normalization';

type SourceInput = {
  assetId: string;
  url: string;
};

type SourceImageOutputRow = {
  job_id?: string | null;
  url?: string | null;
  storage_url?: string | null;
  thumb_url?: string | null;
  position?: number | null;
};

type SourceImageQuery = (sql: string, params?: readonly unknown[]) => Promise<SourceImageOutputRow[]>;

export type ResolveWatchSourceImageOriginalUrlsOptions = {
  video: GalleryVideo;
  sourceImages: WatchPageSourceImage[];
  query?: SourceImageQuery;
};

function normalizeLookupUrl(value?: string | null): string | null {
  const normalized = normalizeMediaUrl(value);
  return normalized && isStablePublicMediaUrl(normalized) ? normalized : null;
}

function collectSourceInputs(video: GalleryVideo, sourceImages: WatchPageSourceImage[]): SourceInput[] {
  const sourceUrls = new Set(sourceImages.map((image) => normalizeLookupUrl(image.url)).filter((url): url is string => Boolean(url)));
  if (!sourceUrls.size) return [];

  const snapshot = asRecord(video.settingsSnapshot);
  const refs = asRecord(snapshot?.refs);
  const inputs = asArray(refs?.inputs);
  const seen = new Set<string>();

  return inputs.flatMap((input) => {
    const record = asRecord(input);
    const assetId = asString(record?.assetId) ?? asString(record?.jobId);
    const url = normalizeLookupUrl(asString(record?.url) ?? asString(record?.imageUrl));
    if (!assetId || assetId.length > 160 || !url || !sourceUrls.has(url)) return [];

    const key = `${assetId}\n${url}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ assetId, url }];
  });
}

function pickOriginalUrl(row: SourceImageOutputRow): string | null {
  const url = normalizeMediaUrl(row.storage_url) ?? normalizeMediaUrl(row.url);
  return url && isStablePublicMediaUrl(url) ? url : null;
}

function buildOutputQuery(jobIds: string[]): { sql: string; params: string[] } {
  const placeholders = jobIds.map((_, index) => `$${index + 1}`).join(', ');
  return {
    sql: `
      SELECT job_id, url, storage_url, thumb_url, position
        FROM job_outputs
       WHERE job_id IN (${placeholders})
         AND kind = 'image'
         AND status <> 'deleted'
       ORDER BY job_id ASC, position ASC, created_at ASC
    `,
    params: jobIds,
  };
}

export async function resolveWatchSourceImageOriginalUrls({
  video,
  sourceImages,
  query,
}: ResolveWatchSourceImageOriginalUrlsOptions): Promise<WatchPageSourceImage[]> {
  if (!sourceImages.length) return sourceImages;

  const sourceInputs = collectSourceInputs(video, sourceImages);
  if (!sourceInputs.length) return sourceImages;

  const jobIds = Array.from(new Set(sourceInputs.map((input) => input.assetId)));
  const outputQuery = buildOutputQuery(jobIds);
  const runQuery: SourceImageQuery =
    query ?? ((sql, params) => defaultQuery<SourceImageOutputRow>(sql, params));
  const rows = await runQuery(outputQuery.sql, outputQuery.params);
  if (!rows.length) return sourceImages;

  const originalByJobId = new Map<string, string>();
  const originalByThumbUrl = new Map<string, string>();
  rows.forEach((row) => {
    const jobId = asString(row.job_id);
    const originalUrl = pickOriginalUrl(row);
    if (!jobId || !originalUrl) return;

    if (!originalByJobId.has(jobId)) {
      originalByJobId.set(jobId, originalUrl);
    }
    const thumbUrl = normalizeLookupUrl(row.thumb_url);
    if (thumbUrl && !originalByThumbUrl.has(thumbUrl)) {
      originalByThumbUrl.set(thumbUrl, originalUrl);
    }
  });

  const replacementBySourceUrl = new Map<string, string>();
  sourceInputs.forEach((input) => {
    const originalUrl = originalByThumbUrl.get(input.url) ?? originalByJobId.get(input.assetId);
    if (originalUrl && originalUrl !== input.url) {
      replacementBySourceUrl.set(input.url, originalUrl);
    }
  });
  if (!replacementBySourceUrl.size) return sourceImages;

  let changed = false;
  const resolved = sourceImages.map((image) => {
    const sourceUrl = normalizeLookupUrl(image.url);
    const originalUrl = sourceUrl ? replacementBySourceUrl.get(sourceUrl) : null;
    if (!originalUrl) return image;

    changed = true;
    return {
      ...image,
      url: originalUrl,
    };
  });

  return changed ? resolved : sourceImages;
}
