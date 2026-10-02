import type { GeneratePayload } from '@/lib/fal-types';
import { VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { sanitizeProviderMediaDiagnostics } from '@/server/provider-media-diagnostics';

const PROVIDER_MEDIA_READ_TTL_SECONDS = 3600;
const EXTRA_MEDIA_FIELDS = new Set([
  ...Object.values(VIDEO_MEDIA_FIELD_CANDIDATES).flat(),
  'image_url', 'input_image', 'image', 'video_url', 'audio_url', 'file_url',
]);

/** Grants belong only to the provider transport; the source payload stays durable. */
export async function createFalMediaTransport(
  input: { payload: GeneratePayload; userId: string },
  dependencies: { read?: typeof createOwnedMediaReadUrl } = {},
): Promise<{ payload: GeneratePayload; sanitize: (value: unknown) => unknown }> {
  const read = dependencies.read ?? createOwnedMediaReadUrl;
  const reads = new Map<string, Promise<string>>();
  const canonicalByGrant = new Map<string, string>();
  const readUrl = (url: string): Promise<string> => {
    let pending = reads.get(url);
    if (!pending) {
      pending = read({ url, userId: input.userId, expiresInSeconds: PROVIDER_MEDIA_READ_TTL_SECONDS })
        .then(grant => {
          if (grant !== url) canonicalByGrant.set(grant, url);
          return grant;
        }).catch(error => {
          if (error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE') {
            throw Object.assign(new Error('Reference media is not available.'), { status: 400, code: 'REFERENCE_INVALID' });
          }
          throw error;
        });
      reads.set(url, pending);
    }
    return pending;
  };
  const payload = { ...input.payload };
  for (const field of ['imageUrl', 'videoUrl', 'audioUrl', 'endImageUrl'] as const) {
    const url = payload[field];
    if (typeof url === 'string') payload[field] = await readUrl(url);
  }
  if (payload.referenceImages) payload.referenceImages = await Promise.all(payload.referenceImages.map(readUrl));
  if (payload.inputs) payload.inputs = await Promise.all(payload.inputs.map(async attachment => ({
    ...attachment,
    ...(typeof attachment.url === 'string' ? { url: await readUrl(attachment.url) } : {}),
  })));
  if (payload.elements) payload.elements = await Promise.all(payload.elements.map(async element => ({
    ...element,
    ...(typeof element.frontalImageUrl === 'string' ? { frontalImageUrl: await readUrl(element.frontalImageUrl) } : {}),
    ...(typeof element.videoUrl === 'string' ? { videoUrl: await readUrl(element.videoUrl) } : {}),
    ...(element.referenceImageUrls ? { referenceImageUrls: await Promise.all(element.referenceImageUrls.map(readUrl)) } : {}),
  })));
  if (payload.soraRequest?.mode === 'i2v') {
    payload.soraRequest = { ...payload.soraRequest, image_url: await readUrl(payload.soraRequest.image_url) };
  }
  if (payload.extraInputValues) {
    payload.extraInputValues = { ...payload.extraInputValues };
    for (const [field, value] of Object.entries(payload.extraInputValues)) {
      if (!EXTRA_MEDIA_FIELDS.has(field)) continue;
      if (typeof value === 'string') payload.extraInputValues[field] = await readUrl(value);
      else if (Array.isArray(value)) payload.extraInputValues[field] = await Promise.all(value.map(item =>
        typeof item === 'string' ? readUrl(item) : item));
    }
  }
  return { payload, sanitize: value => sanitizeProviderMediaDiagnostics(value, canonicalByGrant) };
}
