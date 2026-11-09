'use client';
import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLibraryBrowse } from '@/hooks/useLibraryBrowse';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { normalizeLibraryBrowseScope } from '@/lib/library-browse-scope';
import {
  inferKind,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';
/** One bounded server-wide browse, including all kinds and organization filters. */
export function useLibraryPageData({
  userId,
  activeView,
  activeKind,
  activeSource,
  jobId,
  organizationScope,
}: {
  userId: string | null | undefined;
  activeView: LibraryView;
  activeKind: LibraryKind | 'all';
  activeSource: SavedAssetSource;
  toolsEnabled: boolean;
  jobId?: string | null;
  organizationScope?: Pick<LibraryBrowseScope, 'favorite' | 'trash' | 'collectionId' | 'sort'>;
}) {
  const [searchQuery, setSearchQueryState] = useState('');
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const activeJobId = activeView === 'review' ? (jobId ?? null) : null;
  const scope = useMemo(
    () =>
      normalizeLibraryBrowseScope({
        view: activeView,
        kind: activeKind,
        source: activeSource,
        q: searchQuery,
        ...(activeJobId ? { jobId: activeJobId } : {}),
        ...organizationScope,
      }),
    [activeView, activeKind, activeSource, searchQuery, activeJobId, organizationScope]
  );
  const browse = useLibraryBrowse({ userId: userId ?? null, scope });
  const currentAssets = useMemo(
    () =>
      browse.assets.map((asset) => ({
        ...asset,
        kind: asset.kind ?? inferKind(asset),
        canDelete: scope.view === 'saved',
      })),
    [browse.assets, scope.view]
  );
  const clearJobFilter = useCallback(() => {
    const next = new URLSearchParams(params?.toString() ?? '');
    next.delete('job');
    next.delete('jobId');
    const q = next.toString();
    router.replace(q ? `${pathname ?? '/app/library'}?${q}` : (pathname ?? '/app/library'), {
      scroll: false,
    });
  }, [params, pathname, router]);
  return {
    currentAssets,
    scope,
    totalCount: browse.totalCount,
    assetsError: browse.error,
    recentError: browse.error,
    assetsLoading: browse.isLoading,
    recentLoading: browse.isLoading,
    mutateAssets: browse.revalidate,
    mutateRecentOutputs: browse.revalidate,
    searchQuery,
    setSearchQuery: useCallback((q: string) => setSearchQueryState(q.slice(0, 200)), []),
    hasMore: browse.hasMore,
    loadMore: browse.loadMore,
    isLoadingMore: browse.isLoadingMore,
    activeJobId,
    clearJobFilter,
  };
}
