import type { ResponseInputContent, ResponseInputImage } from 'openai/resources/responses/responses';
import { AgentApiError } from '@/server/agent-api/errors';
import { extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage-read';
import { loadVisionReferenceImage } from './media-analysis/reference-image';

/** Only current, owner-resolved attachments are passed in. Replace the transient
 * provider image parts together so count, fallback and dispatch see the same pixels. */
export async function prepareStudioReferenceImages(
  userId: string,
  content: ResponseInputContent[],
  loadImage = loadVisionReferenceImage,
): Promise<void> {
  const pending: { part: ResponseInputImage; url: string; key: string }[] = [];
  for (const part of content) {
    if (part.type !== 'input_image' || !part.image_url || part.image_url.startsWith('data:')) continue;
    const url = part.image_url;
    if (!extractStorageKeyFromUrl(url)) continue;
    const key = ownedMediaStorageKeyForUrl({ userId, url });
    if (!key) throw new AgentApiError('REFERENCE_FORBIDDEN', 'This image is unavailable for this account.');
    pending.push({ part, url, key });
  }
  if (!pending.length) return;

  const deadline = AbortSignal.timeout(45_000);
  const images = new Map<string, string>();
  const sourceBudget = { remainingBytes: 64 * 1024 * 1024 };
  let encodedBytes = 0;
  for (const { url, key } of pending) {
    let image = images.get(key);
    if (!image) {
      try {
        image = await loadImage(
          { kind: 'image', url, originalAccess: { type: 'owned-storage', storageKey: key } },
          deadline,
          sourceBudget,
        );
      } catch {
        throw new AgentApiError(
          'REFERENCE_INVALID',
          'Studio could not read this image. Retry or attach a smaller image.',
          true,
        );
      }
      images.set(key, image);
    }
    encodedBytes += image.length;
    if (encodedBytes > 16 * 1024 * 1024) {
      throw new AgentApiError(
        'REFERENCE_INVALID',
        'The attached images are too large together. Use fewer or smaller images.',
      );
    }
  }
  for (const { part, key } of pending) part.image_url = images.get(key)!;
}
