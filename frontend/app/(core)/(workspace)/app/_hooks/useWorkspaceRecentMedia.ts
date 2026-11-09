'use client';
import { useLibraryCacheRevision, libraryRevisionKey } from '@/hooks/useLibraryCacheRevision';

import useSWR from 'swr';
import { buildRecentOutputsKey, recentOutputsFetcher, type LibraryKind } from '../library/_lib/library-page-helpers';
import { projectRecentMedia, recentMediaScope } from '../_lib/workspace-recent-media';

/** Shares the Library first-page cache. No extra timer, pagination, or previous-account data. */
export function useWorkspaceRecentMedia(userId: string | null | undefined, kind: LibraryKind) {
  const revision = useLibraryCacheRevision(userId);
  const key = libraryRevisionKey(buildRecentOutputsKey({ userId, activeKind: kind, activeView: 'review' }), revision);
  const query = useSWR(key, recentOutputsFetcher, {
    dedupingInterval: 30_000, keepPreviousData: false, revalidateOnFocus: false, shouldRetryOnError: false,
  });
  const error = Boolean(query.error || (query.data && !query.data.ok));
  return {
    scope: recentMediaScope(key),
    assets: key && !error ? projectRecentMedia(query.data, kind) : [],
    loading: Boolean(key && query.isLoading),
    error,
    refreshing: Boolean(key && query.isValidating),
    retry: () => { if (key && !query.isValidating) void query.mutate(); },
  };
}
