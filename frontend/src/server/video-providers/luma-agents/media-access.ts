import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { sanitizeProviderMediaDiagnostics } from '@/server/provider-media-diagnostics';
import { LumaAgentsError } from './errors';
import type { LumaAgentsVideoPayload } from './payload';

/** Sign every URL in the validated provider payload, never the durable request identity. */
export async function createLumaAgentsMediaTransport(input: {
  payload: LumaAgentsVideoPayload;
  userId: string;
}): Promise<{ payload: LumaAgentsVideoPayload; sanitize: (value: unknown) => unknown }> {
  const reads = new Map<string, Promise<string>>();
  const canonicalByGrant = new Map<string, string>();
  const readUrl = (url: string): Promise<string> => {
    let pending = reads.get(url);
    if (!pending) {
      pending = createOwnedMediaReadUrl({ url, userId: input.userId, expiresInSeconds: 3600 }).then(grant => {
        if (grant !== url) canonicalByGrant.set(grant, url);
        return grant;
      }).catch(error => {
        if (error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE') {
          throw new LumaAgentsError('Reference media is not available.', { status: 400, code: 'REFERENCE_INVALID', errorClass: 'invalid_request' });
        }
        throw error;
      });
      reads.set(url, pending);
    }
    return pending;
  };
  const payload: LumaAgentsVideoPayload = { ...input.payload, video: { ...input.payload.video } };
  if (payload.source && 'url' in payload.source) payload.source = { ...payload.source, url: await readUrl(payload.source.url) };
  for (const field of ['start_frame', 'end_frame'] as const) {
    const frame = payload.video[field];
    if (frame && 'url' in frame) payload.video[field] = { ...frame, url: await readUrl(frame.url) };
  }
  if (payload.video.edit?.keyframes) payload.video.edit = {
    ...payload.video.edit,
    keyframes: await Promise.all(payload.video.edit.keyframes.map(async frame => ({ ...frame, url: await readUrl(frame.url) }))),
  };
  if (payload.video.keyframes) payload.video.keyframes = await Promise.all(payload.video.keyframes.map(async frame => ({ url: await readUrl(frame.url) })));
  return { payload, sanitize: value => sanitizeProviderMediaDiagnostics(value, canonicalByGrant) };
}
