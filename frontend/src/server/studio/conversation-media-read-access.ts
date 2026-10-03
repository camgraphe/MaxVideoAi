import {createSignedDownloadUrl} from '@/server/storage';
import {createOwnedMediaReadUrl} from '@/server/owned-media-read-access';
import {validReferenceMediaUrl} from '@/server/agent-api/reference-assets';
import type {StudioResolvedMedia} from './media-resolver';

export type ConversationMediaReadAccess = {
  url: string;
  expires: string | null;
  thumbnailUrl?: string;
  thumbnailAccessUrl?: string;
};

/** Sign already-resolved owned originals and independently validate their derivatives. */
export async function createConversationMediaReadAccess(
  userId: string,
  media: StudioResolvedMedia,
  dependencies: {sign?: typeof createSignedDownloadUrl; now?: () => Date} = {},
): Promise<ConversationMediaReadAccess> {
  const sign = dependencies.sign ?? createSignedDownloadUrl;
  const expires = new Date((dependencies.now?.() ?? new Date()).getTime() + 300000).toISOString();
  const access: ConversationMediaReadAccess = media.originalAccess.type === 'owned-storage'
    ? {url: await sign(media.originalAccess.storageKey, {expiresInSeconds: 300}), expires}
    : {url: media.url, expires: null};
  if (media.kind !== 'audio' && media.thumbUrl && validReferenceMediaUrl(media.thumbUrl)) {
    try {
      access.thumbnailAccessUrl = await createOwnedMediaReadUrl({url: media.thumbUrl, userId, expiresInSeconds: 300}, {sign});
      access.thumbnailUrl = media.thumbUrl;
      if (access.thumbnailAccessUrl !== media.thumbUrl) access.expires = expires;
    } catch { /* An unavailable derivative does not disable a readable original. */ }
  }
  // Video/audio originals are never used as image thumbnails.
  access.thumbnailAccessUrl ??= media.kind === 'image' ? access.url : undefined;
  return access;
}
