import type {AgentGenerationStatus} from '@/server/generations/generation-status';
import {createSignedDownloadUrl, extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl} from '@/server/storage';

/** Native presentation only: canonical job/quote data and MCP stable URLs remain unchanged. */
export async function buildStudioGenerationMediaAccess(
  userId: string,
  status: AgentGenerationStatus | null,
  dependencies: {sign?: typeof createSignedDownloadUrl} = {},
): Promise<AgentGenerationStatus | null> {
  if (!status?.result) return status;
  const sign = dependencies.sign ?? createSignedDownloadUrl;
  const cache = new Map<string, Promise<string>>();
  async function readable(url: string): Promise<string> {
    const key = ownedMediaStorageKeyForUrl({url, userId});
    if (extractStorageKeyFromUrl(url) && !key) throw new Error('MEDIA_NOT_AVAILABLE');
    if (!key) return url;
    if (!cache.has(key)) cache.set(key, sign(key, {expiresInSeconds: 300}));
    return cache.get(key)!;
  }
  const optional = (url: string | null) => url ? readable(url) : Promise.resolve(null);
  const result = status.result;
  if (result.surface === 'image') return {...status, result: {...result,
    imageUrls: await Promise.all(result.imageUrls.map(readable)),
    thumbnailUrls: await Promise.all(result.thumbnailUrls.map(readable)),
  }};
  if (result.surface === 'video') return {...status, result: {...result,
    videoUrl: await readable(result.videoUrl),
    previewUrl: await optional(result.previewUrl),
    thumbnailUrl: await optional(result.thumbnailUrl),
    audioUrl: await optional(result.audioUrl),
  }};
  return {...status, result: {...result,
    audioUrl: await optional(result.audioUrl),
    videoUrl: await optional(result.videoUrl),
    thumbnailUrl: await optional(result.thumbnailUrl),
  }};
}
