import { authFetch } from '@/lib/authFetch';

export type MediaLibraryAssetKind = 'image' | 'video' | 'audio';

export type MediaLibraryAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind?: MediaLibraryAssetKind;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  durationSec?: number | null;
  source?: string | null;
  jobId?: string | null;
  sourceOutputId?: string | null;
  createdAt?: string;
};

export type MediaLibraryAssetsResponse = {
  ok: boolean;
  error?: string;
  assets: MediaLibraryAsset[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export type MediaLibraryAssetsKey = readonly [string, string];

export function buildMediaLibraryAssetsUrl({
  kind,
  source,
  limit,
  cursor,
  searchQuery,
  originUrl,
}: {
  kind: MediaLibraryAssetKind;
  source?: string | null;
  limit: number;
  cursor?: string | null;
  searchQuery?: string;
  originUrl?: string | null;
}): string {
  const params = new URLSearchParams({
    limit: String(limit),
    kind,
  });
  if (source && source !== 'all') params.set('source', source);
  if (cursor) params.set('cursor', cursor);
  const q = searchQuery?.trim().slice(0, 200);
  if (q) params.set('q', q);
  if (originUrl) params.set('originUrl', originUrl);
  return `/api/media-library/assets?${params.toString()}`;
}

export function buildMediaLibraryAssetsKey({
  userId,
  ...request
}: Parameters<typeof buildMediaLibraryAssetsUrl>[0] & {
  userId: string | null | undefined;
}): MediaLibraryAssetsKey | null {
  if (!userId) return null;
  return [buildMediaLibraryAssetsUrl(request), userId] as const;
}

export async function fetchMediaLibraryAssets(
  [url]: MediaLibraryAssetsKey
): Promise<MediaLibraryAssetsResponse> {
  const response = await authFetch(url);
  const payload = (await response.json().catch(() => null)) as MediaLibraryAssetsResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? 'Failed to load assets');
  }
  return payload;
}
