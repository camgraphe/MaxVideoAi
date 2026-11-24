import sharp from 'sharp';
import { createSignedDownloadUrl } from '@/server/storage';
import type { StudioResolvedMedia } from '../media-resolver';
import { readBoundedAnalysisBody } from './source';

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

/** Produce transient pixels for a reference whose ownership was verified by the caller. */
export async function loadVisionReferenceImage(
  media: Pick<StudioResolvedMedia, 'kind' | 'url' | 'originalAccess'>,
  signal: AbortSignal,
  sourceBudget?: { remainingBytes: number },
): Promise<string> {
  signal.throwIfAborted();
  if (media.kind !== 'image') throw new Error('REFERENCE_INVALID');
  const maxBytes = Math.min(MAX_SOURCE_BYTES, sourceBudget?.remainingBytes ?? MAX_SOURCE_BYTES);
  if (maxBytes <= 0) throw new Error('REFERENCE_IMAGE_TOO_LARGE');

  const url =
    media.originalAccess.type === 'owned-storage'
      ? await createSignedDownloadUrl(media.originalAccess.storageKey, { expiresInSeconds: 120 })
      : media.url;
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal });
  const bytes = await readBoundedAnalysisBody(response, maxBytes);
  if (sourceBudget) sourceBudget.remainingBytes -= bytes.byteLength;
  signal.throwIfAborted();
  const image = await sharp(bytes, { limitInputPixels: 64_000_000, animated: false })
    .timeout({ seconds: 5 })
    .rotate()
    .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  signal.throwIfAborted();
  if (image.length > 2 * 1024 * 1024) throw new Error('REFERENCE_IMAGE_TOO_LARGE');
  return 'data:image/jpeg;base64,' + image.toString('base64');
}
