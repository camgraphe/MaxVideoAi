import { createSignedDownloadUrl, extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage';

/** Transient server read access; callers persist the original URL, never this grant. */
export async function createOwnedMediaReadUrl(
  input: { url: string; userId?: string | null; allowLegacyAnonymousPublicRead?: boolean; expiresInSeconds?: number; method?: 'GET' | 'HEAD'; downloadFilename?: string },
  dependencies: { sign?: typeof createSignedDownloadUrl } = {},
): Promise<string> {
  const storageKey = extractStorageKeyFromUrl(input.url);
  if (!storageKey) return input.url;
  if (input.allowLegacyAnonymousPublicRead) {
    const parsed = new URL(input.url);
    // Operator backfill only: this may attempt a public GET, never grant private access.
    if (input.userId === null && storageKey.startsWith('renders/images/anonymous/')
      && parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash) {
      return input.url;
    }
    throw new Error('MEDIA_NOT_AVAILABLE');
  }
  const key = input.userId ? ownedMediaStorageKeyForUrl({ url: input.url, userId: input.userId }) : null;
  if (!key) throw new Error('MEDIA_NOT_AVAILABLE');
  const requestedTtl = input.expiresInSeconds ?? 300;
  const expiresInSeconds = Number.isFinite(requestedTtl) ? Math.min(3600, Math.max(1, Math.trunc(requestedTtl))) : 300;
  return (dependencies.sign ?? createSignedDownloadUrl)(key, { expiresInSeconds, ...(input.method === 'HEAD' ? { method: 'HEAD' as const } : {}), ...(input.downloadFilename ? { downloadFilename: input.downloadFilename } : {}) });
}
