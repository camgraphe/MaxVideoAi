import { query } from '@/lib/db';
import { ownedMediaStorageKeyForUrl, createSignedDownloadUrl } from '@/server/storage';
import { OpenAIImageError } from './openai-image-error';
import { gptImage26ReferenceFailure } from '@/lib/image/gptImage26';

/** JSON edits let OpenAI fetch short-lived URLs; no unowned URL is ever signed. */
export async function prepareOpenAIImageReferences(params: { userId: string; urls: string[] }, deps: {
  queryFn?: typeof query; ownedKeyFn?: typeof ownedMediaStorageKeyForUrl; signFn?: typeof createSignedDownloadUrl;
} = {}): Promise<string[]> {
  if (!params.urls.length) return [];
  const reject = () => new OpenAIImageError('Use owned PNG, JPEG or WebP originals up to 25 MB from your media library.', { code: 'OPENAI_IMAGE_REFERENCE_INVALID', status: 400 });
  if (params.urls.length > 16) throw reject();
  const keys = params.urls.map(url => (deps.ownedKeyFn ?? ownedMediaStorageKeyForUrl)({ url, userId: params.userId }));
  if (keys.some(key => !key)) throw reject();
  const rows = await (deps.queryFn ?? query)<{ url: string; mime_type: string; size_bytes: number | string; width: number; height: number }>(
    `SELECT url, mime_type, size_bytes, width, height FROM user_assets WHERE user_id = $1 AND url = ANY($2::text[])
     UNION SELECT url, mime_type, size_bytes, width, height FROM media_assets
       WHERE user_id = $1 AND url = ANY($2::text[]) AND kind = 'image' AND status = 'ready' AND deleted_at IS NULL`, [params.userId, params.urls]);
  for (const url of params.urls) {
    const row = rows.find(item => item.url === url);
    if (!row || gptImage26ReferenceFailure({ mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), width: row.width, height: row.height })) throw reject();
  }
  return Promise.all(keys.map(key => (deps.signFn ?? createSignedDownloadUrl)(key!, { expiresInSeconds: 3600 })));
}
