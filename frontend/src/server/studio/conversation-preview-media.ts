import type {WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {resolveStudioMedia} from './media-resolver';
import {createSignedDownloadUrl} from '@/server/storage';

export async function buildConversationPreviewMedia(userId: string,items: WorkspaceTimelineItem[],dependencies: {resolve?: typeof resolveStudioMedia;sign?: typeof createSignedDownloadUrl} = {}): Promise<WorkspaceTimelineItem[]> {
  const resolve = dependencies.resolve ?? resolveStudioMedia;
  const sign = dependencies.sign ?? createSignedDownloadUrl;
  const cache = new Map<string,Promise<{url: string;expires: string | null}>>();
  return Promise.all(items.map(async item => {
    try {
      if (!item.ref) throw new Error('MEDIA_NOT_AVAILABLE');
      const ref = item.ref;
      const key = JSON.stringify(ref);
      if (!cache.has(key)) cache.set(key,(async () => {
        const media = await resolve(userId,ref);
        return media.originalAccess.type === 'owned-storage'
          ? {url: await sign(media.originalAccess.storageKey,{expiresInSeconds: 300}),expires: new Date(Date.now()+300000).toISOString()}
          : {url: media.url,expires: null};
      })());
      const access = await cache.get(key)!;
      return {...item,mediaAccessRequired: true,mediaAccessError: undefined,mediaAccessUrl: access.url,mediaAccessExpiresAt: access.expires};
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'MEDIA_NOT_AVAILABLE') throw error;
      // Preserve position and edit identity, but never project an inaccessible original or thumbnail.
      return {...item,mediaUrl: undefined,thumbnailUrl: undefined,mediaAccessUrl: undefined,mediaAccessExpiresAt: undefined,mediaAccessRequired: true,mediaAccessError: 'MEDIA_NOT_AVAILABLE' as const};
    }
  }));
}
