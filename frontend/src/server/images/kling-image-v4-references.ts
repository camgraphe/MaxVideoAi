import pLimit from 'p-limit';
import sharp from 'sharp';
import { query } from '@/lib/db';
import { klingImageV4ReferenceFailure, KLING_IMAGE_V4_MAX_IMAGE_MB } from '@/lib/image/kling-image-v4';
import { getStorageObjectBuffer, ownedMediaStorageKeyForUrl } from '@/server/storage';

const readLimit = pLimit(2);
const maxBytes = KLING_IMAGE_V4_MAX_IMAGE_MB * 1024 * 1024;

/** Match owned assets and recent originals before reading only from configured storage. */
export async function qualifyKlingImageV4References(userId: string, urls: string[], deps: {
  queryFn?: typeof query;
  storageKey?: typeof ownedMediaStorageKeyForUrl;
  readOriginal?: typeof getStorageObjectBuffer;
} = {}): Promise<boolean> {
  const distinctUrls = [...new Set(urls)];
  if (!distinctUrls.length) return true;
  const keys = distinctUrls.map(url => (deps.storageKey ?? ownedMediaStorageKeyForUrl)({ url, userId }));
  if (keys.some(key => !key)) return false;
  const rows = await (deps.queryFn ?? query)<{ url: string }>(
    `SELECT url FROM user_assets WHERE user_id = $1 AND url = ANY($2::text[])
     UNION SELECT url FROM media_assets
       WHERE user_id = $1 AND url = ANY($2::text[]) AND kind = 'image' AND status = 'ready' AND deleted_at IS NULL
     UNION SELECT COALESCE(o.storage_url, o.url) FROM job_outputs o
       JOIN app_jobs j ON j.job_id = o.job_id
       WHERE o.user_id = $1 AND j.user_id = $1 AND j.hidden IS NOT TRUE
         AND o.kind = 'image' AND o.status = 'ready' AND COALESCE(o.storage_url, o.url) = ANY($2::text[])`,
    [userId, distinctUrls],
  );
  const known = new Set(rows.map(row => row.url));
  if (distinctUrls.some(url => !known.has(url))) return false;
  const supported = await Promise.all(keys.map(key => readLimit(async () => {
    try {
      const bytes = await (deps.readOriginal ?? getStorageObjectBuffer)(key!, { maxBytes, signal: AbortSignal.timeout(15_000) });
      const { format, width, height } = await sharp(bytes).metadata();
      return !klingImageV4ReferenceFailure({ mimeType: format ? `image/${format}` : null, sizeBytes: bytes.length, width, height });
    } catch {
      return false;
    }
  })));
  return supported.every(Boolean);
}
