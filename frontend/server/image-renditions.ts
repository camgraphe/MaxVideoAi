import { createHash } from 'node:crypto';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { uploadImageToStorage } from '@/server/storage';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import type { ImageDisplay } from '@/lib/image-display';

type StorageOptions = Pick<
  Parameters<typeof uploadImageToStorage>[0],
  'acl' | 'cacheControl' | 'privateStorageScope' | 'beforeUpload' | 'signal'
>;
export type ImageRenditionInput = StorageOptions & {
  data?: Buffer;
  imageUrl: string;
  userId?: string | null;
  jobId: string;
  index: number;
  prefix?: 'renders/thumbs' | 'user-asset-thumbs';
  /** Upload callers retain their existing thumbnail owner/injected dependency. */
  thumbUrl?: string | null;
};
export type ImageRenditions = {
  thumbUrl?: string | null;
  previewUrl?: string;
  imageDisplay?: ImageDisplay;
};
type Dependencies = {
  upload?: (
    input: Parameters<typeof uploadImageToStorage>[0],
  ) => Promise<{ url: string }>;
  authorize?: typeof createOwnedMediaReadUrl;
  fetch?: typeof fetch;
};
const processing = pLimit(2);
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

async function sourceBytes(
  input: ImageRenditionInput,
  deps: Dependencies,
): Promise<Buffer> {
  if (input.data) return input.data;
  const url = await (deps.authorize ?? createOwnedMediaReadUrl)({
    url: input.imageUrl,
    userId: input.userId,
  });
  const response = await (deps.fetch ?? fetch)(url, {
    signal: AbortSignal.any([
      AbortSignal.timeout(10000),
      ...(input.signal ? [input.signal] : []),
    ]),
  });
  if (
    !response.ok ||
    Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES
  )
    throw Error('IMAGE_SOURCE_UNAVAILABLE');
  const reader = response.body?.getReader();
  if (!reader) throw Error('IMAGE_SOURCE_EMPTY');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_SOURCE_BYTES) throw Error('IMAGE_SOURCE_TOO_LARGE');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export async function prepareImageRenditions(
  input: ImageRenditionInput,
  deps: Dependencies = {},
): Promise<ImageRenditions> {
  return processing(async () => {
    const result: ImageRenditions =
      input.thumbUrl !== undefined ? { thumbUrl: input.thumbUrl } : {};
    try {
      input.signal?.throwIfAborted();
      const data = await sourceBytes(input, deps);
      if (!data.length || data.length > MAX_SOURCE_BYTES) return result;
      const metadata = await sharp(data, {
        limitInputPixels: 100_000_000,
      }).metadata();
      if ((metadata.pages ?? 1) > 1) return result;
      const digest = createHash('sha256').update(data).digest('hex');
      const upload = deps.upload ?? uploadImageToStorage;
      const options = {
        userId: input.userId ?? undefined,
        prefix: input.prefix ?? 'renders/thumbs',
        ...(input.acl !== undefined ? { acl: input.acl } : {}),
        ...(input.cacheControl !== undefined
          ? { cacheControl: input.cacheControl }
          : {}),
        privateStorageScope: input.privateStorageScope,
        beforeUpload: input.beforeUpload,
        signal: input.signal,
      };
      if (input.thumbUrl === undefined) {
        try {
          const thumb = await sharp(data)
            .rotate()
            .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 72 })
            .timeout({ seconds: 12 })
            .toBuffer();
          result.thumbUrl = (
            await upload({
              ...options,
              data: thumb,
              mime: 'image/webp',
              fileName: `${input.jobId}-${input.index + 1}-thumb-${digest}.webp`,
            })
          ).url;
        } catch {
          /* Optional thumbnail cannot prevent display or original completion. */
        }
      }
      try {
        const encoded = await sharp(data)
          .rotate()
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .timeout({ seconds: 12 })
          .toBuffer({ resolveWithObject: true });
        if (encoded.data.length >= data.length) return result;
        input.signal?.throwIfAborted();
        const url = (
          await upload({
            ...options,
            data: encoded.data,
            mime: 'image/webp',
            fileName: `${input.jobId}-${input.index + 1}-display-v1-${digest}.webp`,
          })
        ).url;
        result.previewUrl = url;
        result.imageDisplay = {
          version: 1,
          profile: 'image-display-v1',
          sourceUrl: input.imageUrl,
          sourceSha256: digest,
          url,
          mimeType: 'image/webp',
          width: encoded.info.width,
          height: encoded.info.height,
          sizeBytes: encoded.data.length,
        };
      } catch {
        /* Preserve the already-prepared thumbnail and authoritative original. */
      }
    } catch {
      /* Optional derivative errors never alter completion/payment status. */
    }
    return result;
  });
}
