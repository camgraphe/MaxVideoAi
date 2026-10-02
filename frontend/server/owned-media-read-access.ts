import { createSignedDownloadUrl, extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage';

/** Transient server read access; callers persist the original URL, never this grant. */
export async function createOwnedMediaReadUrl(
  input: { url: string; userId?: string | null; allowLegacyAnonymousPublicRead?: boolean },
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
  return (dependencies.sign ?? createSignedDownloadUrl)(key, { expiresInSeconds: 300 });
}
