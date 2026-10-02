import type {WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {resolveStudioMedia} from './media-resolver';
import {createSignedDownloadUrl} from '@/server/storage';
import {createOwnedMediaReadUrl} from '@/server/owned-media-read-access';
import {validReferenceMediaUrl} from '@/server/agent-api/reference-assets';

export async function buildConversationPreviewMedia(userId: string,items: WorkspaceTimelineItem[],dependencies: {resolve?: typeof resolveStudioMedia;sign?: typeof createSignedDownloadUrl} = {}): Promise<WorkspaceTimelineItem[]> {
  const resolve = dependencies.resolve ?? resolveStudioMedia;
  const sign = dependencies.sign ?? createSignedDownloadUrl;
  const cache = new Map<string,Promise<{url: string;expires: string | null;thumbnailUrl?: string;thumbnailAccessUrl?: string}>>();
  return Promise.all(items.map(async item => {
    try {
      if (!item.ref) throw new Error('MEDIA_NOT_AVAILABLE');
      const ref = item.ref;
      const key = JSON.stringify(ref);
      if (!cache.has(key)) cache.set(key,(async () => {
        const media = await resolve(userId,ref);
        const access = media.originalAccess.type === 'owned-storage'
          ? {url: await sign(media.originalAccess.storageKey,{expiresInSeconds: 300}),expires: new Date(Date.now()+300000).toISOString()}
          : {url: media.url,expires: null};
        let thumbnailUrl: string | undefined;
        let thumbnailAccessUrl: string | undefined;
        if (media.kind !== 'audio' && media.thumbUrl && validReferenceMediaUrl(media.thumbUrl)) {
          try {
            thumbnailAccessUrl = await createOwnedMediaReadUrl({url: media.thumbUrl,userId,expiresInSeconds: 300},{sign});
            thumbnailUrl = media.thumbUrl;
          }
          catch { /* A missing or inaccessible derivative must not disable the readable original. */ }
        }
        // Preview-only projection: never substitute video bytes for an image or mutate stored clip URLs.
        return {...access,thumbnailUrl,thumbnailAccessUrl: thumbnailAccessUrl ?? (media.kind === 'image' ? access.url : undefined)};
      })());
      const access = await cache.get(key)!;
      return {...item,thumbnailUrl: access.thumbnailUrl,thumbnailAccessUrl: access.thumbnailAccessUrl,mediaAccessRequired: true,mediaAccessError: undefined,mediaAccessUrl: access.url,mediaAccessExpiresAt: access.expires};
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'MEDIA_NOT_AVAILABLE') throw error;
      // Preserve position and edit identity, but never project an inaccessible original or thumbnail.
      return {...item,mediaUrl: undefined,thumbnailUrl: undefined,thumbnailAccessUrl: undefined,mediaAccessUrl: undefined,mediaAccessExpiresAt: undefined,mediaAccessRequired: true,mediaAccessError: 'MEDIA_NOT_AVAILABLE' as const};
    }
  }));
}
