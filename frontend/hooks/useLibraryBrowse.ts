'use client';
import { useLibraryCacheRevision, libraryRevisionKey, useLibraryScopePersistence } from '@/hooks/useLibraryCacheRevision';
import { useMemo, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import { buildLibraryBrowseKey, fetchLibraryBrowse } from '@/lib/library-browse-client';
import type { LibraryBrowseScope, LibraryBrowseResponse } from '@/lib/library-browse';
/** Server-wide filters/totals; this hook never filters a locally truncated library. */
export function useLibraryBrowse({ userId, scope, enabled = true }: {
    userId: string | null;
    scope: LibraryBrowseScope;
    enabled?: boolean;
}) {
    const revision = useLibraryCacheRevision(userId);
    const persistSize = useLibraryScopePersistence(JSON.stringify([buildLibraryBrowseKey({ userId, scope }), enabled]));
    const query = useSWRInfinite<LibraryBrowseResponse>((index, previous) => {
        if (!enabled || !userId || (previous && !previous.nextCursor))
            return null;
        return libraryRevisionKey(buildLibraryBrowseKey({ userId, scope, cursor: index === 0 ? null : previous?.nextCursor }), revision);
    }, fetchLibraryBrowse, { persistSize, keepPreviousData: false, revalidateFirstPage: false, revalidateOnFocus: false, shouldRetryOnError: false });
    const assets = useMemo(() => {
        if (!enabled || !userId)
            return [];
        const seen = new Set<string>();
        return (query.data ?? []).flatMap(page => page.assets.filter(asset => !seen.has(asset.organization.key) && Boolean(seen.add(asset.organization.key))));
    }, [enabled, userId, query.data]);
    const last = query.data?.at(-1), isLoadingMore = Boolean(query.isValidating && query.data && query.size > query.data.length);
    const loadMore = useCallback(() => {
        if (last?.nextCursor && !isLoadingMore)
            void query.setSize(size => size + 1);
    }, [last?.nextCursor, isLoadingMore, query]);
    return { assets, totalCount: enabled && userId ? query.data?.[0]?.totalCount ?? 0 : 0, error: query.error, isLoading: query.isLoading, isLoadingMore,
        hasMore: Boolean(last?.hasMore && last.nextCursor), loadMore, revalidate: query.mutate };
}
