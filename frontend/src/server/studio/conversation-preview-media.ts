import type {WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {resolveStudioMedia} from './media-resolver';
import type {createSignedDownloadUrl} from '@/server/storage';
import {createConversationMediaReadAccess, type ConversationMediaReadAccess} from './conversation-media-read-access';

export async function buildConversationPreviewMedia(userId: string,items: WorkspaceTimelineItem[],dependencies: {resolve?: typeof resolveStudioMedia;sign?: typeof createSignedDownloadUrl} = {}): Promise<WorkspaceTimelineItem[]> {
  const resolve = dependencies.resolve ?? resolveStudioMedia;
  const cache = new Map<string,Promise<ConversationMediaReadAccess>>();
  return Promise.all(items.map(async item => {
    try {
      if (!item.ref) throw new Error('MEDIA_NOT_AVAILABLE');
      const ref = item.ref;
      const key = JSON.stringify(ref);
      if (!cache.has(key)) cache.set(key,(async () => {
        const media = await resolve(userId,ref);
        // Preview-only projection: never substitute video bytes for an image or mutate stored clip URLs.
        return createConversationMediaReadAccess(userId,media,{sign: dependencies.sign});
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
