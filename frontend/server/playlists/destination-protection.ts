import type { QueryExecutor } from '@/lib/db';
import { getExamplesHubPlaylistSlug, getStarterPlaylistSlug } from './slugs';

const RESERVED_CORE_SLUGS = new Set(['examples', 'marketing-examples', 'welcome', 'starter']);
export const normalizeDestinationSlug = (slug: string) => slug.trim().toLowerCase();

/** Reserved even when the current environment uses a different source. */
export function isHistoricalCoreSlug(slug: string): boolean {
  return RESERVED_CORE_SLUGS.has(normalizeDestinationSlug(slug));
}

export function isInactiveHistoricalCoreSlug(slug: string): boolean {
  const normalized = normalizeDestinationSlug(slug);
  return isHistoricalCoreSlug(normalized)
    && normalized !== normalizeDestinationSlug(getExamplesHubPlaylistSlug())
    && normalized !== normalizeDestinationSlug(getStarterPlaylistSlug());
}

export class DestinationWriteError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = 'DestinationWriteError';
  }
}

/** Read-only in previews; callers serialize mutations in their existing transaction. */
export async function assertDestinationWritable(db: QueryExecutor, playlistId: string): Promise<void> {
  const [playlist] = await db.query<{ slug: string }>('SELECT slug FROM playlists WHERE id=$1', [playlistId]);
  if (!playlist) throw new DestinationWriteError('Destination not found', 404);
  if (isInactiveHistoricalCoreSlug(playlist.slug)) {
    throw new DestinationWriteError('This historical destination is disconnected from runtime configuration. Reconcile configuration before editing.');
  }
}
