import { createHash } from 'node:crypto';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { headerValue, openPublicHttpsResponse } from '@/server/public-media-transport';
import { getStorageObjectMetadata, ownedMediaStorageKeyForUrl, uploadFileBufferToKey } from '@/server/storage';
import type { MarketingMediaFile } from '@/lib/marketing-media';
import { MarketingMediaError, type MarketingCopyPlan } from './snapshot';

export type MarketingFileContext = {
  copyId: string;
  ownerId: string | null;
  remainingBytes: number;
  signal: AbortSignal;
};
const MAX_FILE_BYTES = 256 * 1024 ** 2;
const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};
type Dependencies = {
  readUrl: (input: { url: string; userId: string | null }) => Promise<string>;
  open: typeof openPublicHttpsResponse;
  put: typeof uploadFileBufferToKey;
  verify: (url: string, size: number, signal: AbortSignal) => Promise<boolean>;
};
const defaults: Dependencies = {
  readUrl: (input) =>
    input.userId && ownedMediaStorageKeyForUrl({ url: input.url, userId: input.userId })
      ? createOwnedMediaReadUrl(input)
      : Promise.resolve(input.url),
  open: openPublicHttpsResponse,
  put: async (input) => {
    try {
      return await uploadFileBufferToKey({ ...input, conditionalCreate: true });
    } catch (error) {
      if ((error as { context?: { code?: string } }).context?.code !== 'precondition-conflict') throw error;
      const metadata = await getStorageObjectMetadata(input.key, input.signal);
      if (metadata.size !== input.data.length || metadata.mime?.split(';')[0] !== input.mime) throw error;
      const { buildPublicStorageUrl } = await import('@/server/storage');
      return { key: input.key, url: buildPublicStorageUrl(input.key) };
    }
  },
  verify: async (url, size, signal) => {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    return response.ok && Number(response.headers.get('content-length')) === size;
  },
};

/** Exact bytes, bounded memory/network, DNS-pinned transport, no personal asset insertion. */
export async function copyMarketingMediaFile(
  file: MarketingCopyPlan['media'][number],
  context: MarketingFileContext,
  dependencies: Dependencies = defaults,
): Promise<MarketingMediaFile> {
  const limit = Math.min(MAX_FILE_BYTES, context.remainingBytes);
  const source = await dependencies.readUrl({ url: file.sourceUrl, userId: context.ownerId });
  const signal = AbortSignal.any([context.signal, AbortSignal.timeout(60_000)]);
  const response = await dependencies.open(source, undefined, { signal, timeoutMs: 60_000 });
  const declared = headerValue(response.headers, 'content-length');
  const mime = (headerValue(response.headers, 'content-type') ?? '').split(';')[0].trim().toLowerCase();
  try {
    if (response.statusCode !== 200) throw new MarketingMediaError('A source file could not be copied.');
    if (!MIME_EXTENSIONS[mime] || !mime.startsWith(file.kind + '/'))
      throw new MarketingMediaError('A source file has an unsupported media type.');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit))
      throw new MarketingMediaError('A source file exceeds the copy size limit.');
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      size += chunk.byteLength;
      if (size > limit) throw new MarketingMediaError('A source file is too large to copy.');
      chunks.push(Buffer.from(chunk));
    }
    if (!size || (declared !== null && Number(declared) !== size))
      throw new MarketingMediaError('A source file download is incomplete.');
    const data = Buffer.concat(chunks);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const key = `marketing-media/${context.copyId}/${sha256}.${MIME_EXTENSIONS[mime]}`;
    const stored = await dependencies.put({
      key,
      data,
      mime,
      cacheControl: 'public, max-age=31536000, immutable',
      signal,
    });
    if (!(await dependencies.verify(stored.url, size, signal)))
      throw new MarketingMediaError('The copied file is not publicly readable yet. Retry the copy.');
    return { sourceUrl: file.sourceUrl, url: stored.url, key: stored.key, sizeBytes: size, mime, sha256 };
  } finally {
    response.cancel?.();
  }
}
