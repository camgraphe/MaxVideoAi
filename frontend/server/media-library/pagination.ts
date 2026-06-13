export type MediaLibraryCursor = {
  createdAt: string;
  id: string;
};

export type MediaLibraryPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_MEDIA_LIBRARY_LIMIT = 60;
const MAX_MEDIA_LIBRARY_LIMIT = 100;

function normalizeLimit(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

export function resolveMediaLibraryLimit(value: unknown): number {
  const normalized = normalizeLimit(value) ?? DEFAULT_MEDIA_LIBRARY_LIMIT;
  return Math.min(MAX_MEDIA_LIBRARY_LIMIT, Math.max(1, normalized));
}

export function encodeMediaLibraryCursor(cursor: MediaLibraryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeMediaLibraryCursor(value: string | null | undefined): MediaLibraryCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<MediaLibraryCursor>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    if (!Number.isFinite(Date.parse(parsed.createdAt)) || parsed.id.trim().length === 0) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function sliceMediaLibraryPage<T extends { id: string; createdAt?: string | null }>(
  items: T[],
  limit: number
): MediaLibraryPage<T> {
  const sorted = [...items].sort((a, b) => {
    const timeDiff = Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '');
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
  const visibleItems = sorted.slice(0, limit);
  const lastVisibleItem = visibleItems.at(-1) ?? null;
  const hasMore = sorted.length > limit;
  return {
    items: visibleItems,
    hasMore,
    nextCursor: hasMore && lastVisibleItem?.createdAt
      ? encodeMediaLibraryCursor({ createdAt: lastVisibleItem.createdAt, id: lastVisibleItem.id })
      : null,
  };
}
