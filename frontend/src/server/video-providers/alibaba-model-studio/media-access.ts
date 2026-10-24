import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { sanitizeProviderMediaDiagnostics } from '@/server/provider-media-diagnostics';
import { AlibabaModelStudioError } from './errors';
import type { AlibabaVideoPayload } from './types';

/** Wan-only, short-lived transport. Durable inputs and other Alibaba models stay unchanged. */
export async function createWanMediaTransport(
  input: { payload: AlibabaVideoPayload; userId: string },
  dependencies: { read?: typeof createOwnedMediaReadUrl } = {},
): Promise<{ payload: AlibabaVideoPayload; sanitize: (value: unknown) => unknown }> {
  if (input.payload.model !== 'wan3.0-video' && input.payload.model !== 'wan3.0-video-prime') {
    return { payload: input.payload, sanitize: value => value };
  }
  const canonicalByGrant = new Map<string, string>();
  const reads = new Map<string, Promise<string>>();
  const readUrl = (url: string): Promise<string> => {
    let pending = reads.get(url);
    if (!pending) {
      pending = (dependencies.read ?? createOwnedMediaReadUrl)({ url, userId: input.userId, expiresInSeconds: 3600 })
        .then(grant => {
          if (grant !== url) canonicalByGrant.set(grant, url);
          return grant;
        }).catch(error => {
          const unavailable = error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE';
          // A local grant failure must never submit the inaccessible original to a fallback provider.
          throw new AlibabaModelStudioError('Reference media could not be read.', {
            status: unavailable ? 400 : 503,
            code: unavailable ? 'REFERENCE_INVALID' : 'REFERENCE_ACCESS_FAILED',
            errorClass: unavailable ? 'invalid_request' : 'provider_error',
          });
        });
      reads.set(url, pending);
    }
    return pending;
  };
  const payload = { ...input.payload, input: { ...input.payload.input } };
  if (payload.input.media) payload.input.media = await Promise.all(payload.input.media.map(async media => (
    media.type === 'file' || media.type === 'link' ? { ...media } : { ...media, url: await readUrl(media.url) }
  )));
  return { payload, sanitize: value => sanitizeProviderMediaDiagnostics(value, canonicalByGrant) };
}
