import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { sanitizeProviderMediaDiagnostics } from '@/server/provider-media-diagnostics';
import { BytePlusModelArkError } from './byteplus-modelark-error';
import type { BytePlusSeedancePayload } from './byteplus-modelark-payload';
import type { Seedance25FinalRequest } from './byteplus-modelark-draft';

type BytePlusMediaPayload = BytePlusSeedancePayload | Seedance25FinalRequest;

/** Owner-checked grants exist only in the provider transport, never in saved inputs. */
export async function createBytePlusMediaTransport<T extends BytePlusMediaPayload>(
  input: { payload: T; userId: string },
  dependencies: { read?: typeof createOwnedMediaReadUrl } = {},
): Promise<{ payload: T; sanitize: (value: unknown) => unknown }> {
  const reads = new Map<string, Promise<string>>();
  const canonicalByGrant = new Map<string, string>();
  const readUrl = (url: string): Promise<string> => {
    let pending = reads.get(url);
    if (!pending) {
      pending = (dependencies.read ?? createOwnedMediaReadUrl)({ url, userId: input.userId, expiresInSeconds: 3600 })
        .then(grant => {
          if (grant !== url) canonicalByGrant.set(grant, url);
          return grant;
        }).catch(error => {
          const unavailable = error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE';
          // A local access failure must stop before the provider-attempt/idempotency marker.
          throw new BytePlusModelArkError('Reference media could not be read.', {
            status: unavailable ? 400 : 503,
            code: unavailable ? 'REFERENCE_INVALID' : 'REFERENCE_ACCESS_FAILED',
          });
        });
      reads.set(url, pending);
    }
    return pending;
  };
  const content = await Promise.all(input.payload.content.map(async item => {
    switch (item.type) {
      case 'image_url': return { ...item, image_url: { ...item.image_url, url: await readUrl(item.image_url.url) } };
      case 'video_url': return { ...item, video_url: { ...item.video_url, url: await readUrl(item.video_url.url) } };
      case 'audio_url': return { ...item, audio_url: { ...item.audio_url, url: await readUrl(item.audio_url.url) } };
      default: return { ...item };
    }
  }));
  return { payload: { ...input.payload, content } as T,
    sanitize: value => sanitizeProviderMediaDiagnostics(value, canonicalByGrant) };
}
