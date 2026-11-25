import pLimit from 'p-limit';
import sharp from 'sharp';
import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { createSignedDownloadUrl, getStorageObjectBuffer, ownedMediaStorageKeyForUrl } from '@/server/storage';
import { OpenAIImageError } from './openai-image-error';
import { rasterMime } from './openai-image-response';
import { gptImage26ReferenceFailure } from '@/lib/image/gptImage26';
import type { StoredAssetInfo } from './image-reference-normalization';
import { getPublicStoryboardTemplateReferenceUrl } from './storyboard-template-reference';

const maxReferenceBytes = 25 * 1024 * 1024;
const readLimit = pLimit(2);

export type OpenAIStoryboardReferenceScope =
  | { role: 'board' | 'edit' }
  | { role: 'kling_first_frame'; parentJobId: string | null };

type ReferenceInput = { userId: string; urls: string[]; storyboard?: OpenAIStoryboardReferenceScope };
type ReferenceDependencies = {
  queryFn?: typeof query;
  ownedKeyFn?: typeof ownedMediaStorageKeyForUrl;
  signFn?: typeof createSignedDownloadUrl;
  readOriginalFn?: typeof getStorageObjectBuffer;
};

type OwnedReference = { url: string; key: string };
type AssetRow = { url: string; mime_type: string | null; size_bytes: number | string | null; width: number | null; height: number | null };

function rejectReference(storyboard?: OpenAIStoryboardReferenceScope) {
  const source = storyboard ? 'from your uploads or generated images' : 'from your media library';
  return new OpenAIImageError(`Use owned PNG, JPEG or WebP originals up to 25 MB ${source}.`, {
    code: 'OPENAI_IMAGE_REFERENCE_INVALID', status: 400,
  });
}

function isVerifiedAsset(row: AssetRow): boolean {
  return !gptImage26ReferenceFailure({
    mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), width: row.width, height: row.height,
  });
}

export async function prepareOpenAIImageReferences(params: ReferenceInput, deps: ReferenceDependencies = {}): Promise<string[]> {
  return (await prepareOpenAIImageReferenceContext(params, deps)).preparedReferenceUrls;
}

/** JSON edits use the pinned board template and short-lived URLs for verified owned originals. */
export async function prepareOpenAIImageReferenceContext(params: ReferenceInput, deps: ReferenceDependencies = {}): Promise<{
  preparedReferenceUrls: string[];
  storedAssetInfoByUrl: Map<string, StoredAssetInfo>;
}> {
  const { userId, urls, storyboard } = params;
  const storedAssetInfoByUrl = new Map<string, StoredAssetInfo>();
  if (!urls.length) return { preparedReferenceUrls: [], storedAssetInfoByUrl };
  if (urls.length > 16) throw rejectReference(storyboard);
  const templateUrl = storyboard?.role === 'board' ? getPublicStoryboardTemplateReferenceUrl(urls[0]) : null;
  const ownedKey = deps.ownedKeyFn ?? ownedMediaStorageKeyForUrl;
  const owned = (templateUrl ? urls.slice(1) : urls).map(url => {
    const storageUrl = storyboard ? normalizeMediaUrl(url) ?? url : url;
    const key = ownedKey({ url: storageUrl, userId });
    if (!key) throw rejectReference(storyboard);
    return { url, key };
  });
  if (!owned.length && templateUrl) return { preparedReferenceUrls: [templateUrl], storedAssetInfoByUrl };

  const execute = deps.queryFn ?? query;
  let firstFrameOriginal: string | null = null;
  if (storyboard?.role === 'kling_first_frame') {
    if (!storyboard.parentJobId) throw rejectReference(storyboard);
    const [parentOriginal] = await findCommittedStoryboardOriginals(userId, [owned[0].url], execute, storyboard.parentJobId);
    if (!parentOriginal) throw rejectReference(storyboard);
    firstFrameOriginal = parentOriginal.url;
  }
  const originals = [...new Map(owned.map(ref => [ref.url, ref])).values()];
  const rows = await execute<AssetRow>(
    `SELECT url, mime_type, size_bytes, width, height FROM user_assets WHERE user_id = $1 AND url = ANY($2::text[])
     UNION SELECT url, mime_type, size_bytes, width, height FROM media_assets
       WHERE user_id = $1 AND url = ANY($2::text[]) AND kind = 'image' AND status = 'ready' AND deleted_at IS NULL`,
    [userId, originals.map(ref => ref.url)]);
  if (storyboard) {
    // Older saves can carry client-supplied metadata. Use the rows only to prove ownership.
    const known = new Set(rows.map(row => row.url));
    if (firstFrameOriginal) known.add(firstFrameOriginal);
    const inspected = await verifyStoryboardOriginals(userId, originals, known, storyboard, deps);
    for (const [url, facts] of inspected) storedAssetInfoByUrl.set(url, facts);
  } else {
    for (const ref of originals) {
      const row = rows.find(asset => asset.url === ref.url);
      if (!row || !isVerifiedAsset(row)) throw rejectReference();
      storedAssetInfoByUrl.set(ref.url, { mime: row.mime_type, width: row.width, height: row.height });
    }
  }

  const sign = deps.signFn ?? createSignedDownloadUrl;
  const signed = await Promise.all(owned.map(({ key }) => sign(key, { expiresInSeconds: 3600 })));
  return { preparedReferenceUrls: templateUrl ? [templateUrl, ...signed] : signed, storedAssetInfoByUrl };
}

async function findCommittedStoryboardOriginals(userId: string, urls: string[], execute: typeof query, jobId: string | null = null) {
  return execute<{ url: string }>(
    `SELECT DISTINCT original.url FROM app_jobs j
     LEFT JOIN job_outputs o ON o.job_id = j.job_id AND o.kind = 'image' AND o.position = 0
     CROSS JOIN LATERAL (
       SELECT CASE WHEN jsonb_typeof(j.render_ids) = 'string' AND pg_input_is_valid(j.render_ids#>>'{}', 'jsonb')
         THEN (j.render_ids#>>'{}')::jsonb ELSE j.render_ids END AS renders
     ) AS legacy
     CROSS JOIN LATERAL (
       SELECT CASE
         -- An existing output projection, including a tombstone, stays authoritative.
         WHEN o.job_id IS NULL THEN CASE WHEN jsonb_typeof(legacy.renders->0) = 'string'
           THEN legacy.renders->>0 ELSE legacy.renders->0->>'url' END
         WHEN o.user_id = j.user_id AND o.status = 'ready' THEN COALESCE(o.storage_url, o.url)
       END AS url
     ) AS original
     WHERE j.user_id = $1 AND j.surface = 'storyboard' AND ($3::text IS NULL OR j.job_id = $3)
       AND j.status = 'completed' AND j.hidden IS NOT TRUE
       AND original.url = ANY($2::text[])`, [userId, urls, jobId]);
}

async function verifyStoryboardOriginals(
  userId: string,
  originals: OwnedReference[],
  known: Set<string>,
  storyboard: OpenAIStoryboardReferenceScope,
  deps: ReferenceDependencies,
): Promise<Array<readonly [string, StoredAssetInfo]>> {
  const missingUrls = originals.filter(ref => !known.has(ref.url)).map(ref => ref.url);
  if (missingUrls.length) {
    const execute = deps.queryFn ?? query;
    const rows = await execute<{ url: string }>(
      `SELECT COALESCE(o.storage_url, o.url) AS url FROM job_outputs o
       JOIN app_jobs j ON j.job_id = o.job_id AND j.user_id = o.user_id
       WHERE o.user_id = $1 AND o.kind = 'image' AND o.status = 'ready'
         AND j.status = 'completed' AND j.hidden IS NOT TRUE
         AND COALESCE(o.storage_url, o.url) = ANY($2::text[])`, [userId, missingUrls]);
    for (const row of rows) known.add(row.url);
    const unprojectedUrls = missingUrls.filter(url => !known.has(url));
    if (storyboard.role === 'edit' && unprojectedUrls.length) {
      const legacy = await findCommittedStoryboardOriginals(userId, unprojectedUrls, execute);
      for (const row of legacy) known.add(row.url);
    }
  }
  if (originals.some(ref => !known.has(ref.url))) throw rejectReference(storyboard);

  const readOriginal = deps.readOriginalFn ?? getStorageObjectBuffer;
  return Promise.all(originals.map(({ key, url }) => readLimit(async () => {
    try {
      const bytes = await readOriginal(key, { maxBytes: maxReferenceBytes, signal: AbortSignal.timeout(15_000) });
      const mime = bytes.length <= maxReferenceBytes ? rasterMime(bytes) : null;
      if (mime) {
        const { width, height } = await sharp(bytes).metadata();
        if (!gptImage26ReferenceFailure({ mimeType: mime, sizeBytes: bytes.length, width, height })) {
          return [url, { mime, width, height }] as const;
        }
      }
    } catch {
      // Storage and decoder errors are translated to the same safe validation result.
    }
    throw rejectReference(storyboard);
  })));
}
