import { useLibraryCacheRevision, libraryCacheRevision, invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  buildAssetLibraryCacheKey,
  buildAssetLibraryUrl,
  normalizeAssetLibraryPayload,
  revokeAssetPreview,
  type AssetLibraryKind,
  type AssetLibrarySource,
  type AssetPickerTarget,
  type ReferenceAsset,
  type UserAsset,
} from '../_lib/workspace-assets';

type FetchAssetLibraryOptions = {
  source?: AssetLibrarySource;
  kind?: AssetLibraryKind;
};

type UseWorkspaceAssetLibraryOptions = {
  userId?: string | null;
  listingEnabled?: boolean;
  showNotice: (message: string) => void;
  setInputAssets: Dispatch<SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
};

export function useWorkspaceAssetLibrary({
  userId = null,
  listingEnabled = true,
  showNotice,
  setInputAssets,
}: UseWorkspaceAssetLibraryOptions) {
  const revision = useLibraryCacheRevision(userId);
  const owner = useRef({ userId, version: 0 });
  const requestVersion = useRef(0);
  if (owner.current.userId !== userId) {
    owner.current = { userId, version: owner.current.version + 1 };
    requestVersion.current += 1;
  }
  const [libraryOwnerId, setLibraryOwnerId] = useState(userId);
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<UserAsset[]>([]);
  const accountScope = owner.current;
  const setScopedAssetLibrary = useCallback<Dispatch<SetStateAction<UserAsset[]>>>((next) => {
    if (owner.current === accountScope) setAssetLibrary(next);
  }, [accountScope]);
  const [isAssetLibraryLoading, setIsAssetLibraryLoading] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState<string | null>(null);
  const [assetLibrarySource, setAssetLibrarySource] = useState<AssetLibrarySource>('all');
  const [assetLibraryLoadedKey, setAssetLibraryLoadedKey] = useState<string | null>(null);
  const [assetLibraryNextCursor, setAssetLibraryNextCursor] = useState<string | null>(null);
  const [assetLibraryHasMore, setAssetLibraryHasMore] = useState(false);
  const [isAssetLibraryLoadingMore, setIsAssetLibraryLoadingMore] = useState(false);
  const [assetDeletePendingId, setAssetDeletePendingId] = useState<string | null>(null);

  const assetLibraryKind = useMemo<AssetLibraryKind>(() => {
    if (!assetPickerTarget) return 'image';
    if (assetPickerTarget.kind === 'field' && (assetPickerTarget.field.type === 'video' || assetPickerTarget.field.type === 'audio')) {
      return assetPickerTarget.field.type;
    }
    if (assetPickerTarget.kind === 'kling' && assetPickerTarget.slot === 'video') {
      return 'video';
    }
    return 'image';
  }, [assetPickerTarget]);
  const assetLibraryRequestKey = assetPickerTarget
    ? `${userId ?? "guest"}:${revision}:${buildAssetLibraryCacheKey(assetLibraryKind, assetLibrarySource)}`
    : null;
  const visibleAssetLibrary = useMemo(
    () => libraryOwnerId === userId && userId && assetLibraryLoadedKey === assetLibraryRequestKey ? assetLibrary.filter((asset) => asset.kind === assetLibraryKind) : [],
    [assetLibrary, assetLibraryKind, assetLibraryLoadedKey, assetLibraryRequestKey, libraryOwnerId, userId]
  );

  const resetAssetLibraryForSource = useCallback((nextSource: AssetLibrarySource) => {
    requestVersion.current += 1;
    setIsAssetLibraryLoading(false);
    setAssetLibrarySource(nextSource);
    setAssetLibrary([]);
    setAssetLibraryError(null);
    setAssetLibraryLoadedKey(null);
    setAssetLibraryNextCursor(null);
    setAssetLibraryHasMore(false);
    setIsAssetLibraryLoadingMore(false);
  }, []);

  useEffect(() => {
    setLibraryOwnerId(userId);
    setAssetPickerTarget(null);
    setAssetLibrary([]);
    setAssetLibraryLoadedKey(null);
    setAssetLibraryNextCursor(null);
    setAssetLibraryHasMore(false);
    setAssetLibraryError(null);
    setIsAssetLibraryLoading(false);
    setIsAssetLibraryLoadingMore(false);
  }, [userId]);

  useEffect(() => () => { requestVersion.current += 1; }, []);
  useEffect(() => { requestVersion.current += 1; setIsAssetLibraryLoading(false); setIsAssetLibraryLoadingMore(false); }, [revision]);

  const fetchAssetLibrary = useCallback(async (options?: FetchAssetLibraryOptions) => {
    if (!userId || owner.current.userId !== userId) return;
    if (!listingEnabled) {
      invalidateLibraryMedia(userId);
      return;
    }
    const scope = owner.current;
    const request = ++requestVersion.current;
    const isCurrent = () => owner.current === scope && requestVersion.current === request && libraryCacheRevision(userId) === revision;
    const source = options?.source ?? assetLibrarySource;
    const kind = options?.kind ?? assetLibraryKind;
    const requestKey = `${userId}:${revision}:${buildAssetLibraryCacheKey(kind, source)}`;
    setIsAssetLibraryLoading(true);
    setIsAssetLibraryLoadingMore(false);
    setAssetLibraryError(null);
    setAssetLibraryNextCursor(null);
    setAssetLibraryHasMore(false);
    try {
      const assetResponse = await ownedAuthFetch(buildAssetLibraryUrl(kind, source), userId);
      if (!isCurrent()) return;
      if (assetResponse.status === 401) {
        setAssetLibrary([]);
        setAssetLibraryError('Sign in to access Media.');
        setAssetLibraryLoadedKey(requestKey);
        return;
      }
      const payload = await assetResponse.json().catch(() => null);
      if (!isCurrent()) return;
      if (!assetResponse.ok || !payload?.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : kind === 'video'
              ? 'Failed to load videos'
              : 'Failed to load images';
        throw new Error(message);
      }
      const nextCursor = typeof payload.nextCursor === 'string' ? payload.nextCursor : null;
      setAssetLibrary(normalizeAssetLibraryPayload(payload, source, kind));
      setAssetLibraryNextCursor(nextCursor);
      setAssetLibraryHasMore(Boolean(payload.hasMore && nextCursor));
      setAssetLibraryLoadedKey(requestKey);
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[assets] failed to load library', error);
      setAssetLibraryError(
        error instanceof Error
          ? error.message
          : kind === 'video'
            ? 'Failed to load videos'
            : 'Failed to load images'
      );
      setAssetLibraryLoadedKey(requestKey);
    } finally {
      if (isCurrent()) setIsAssetLibraryLoading(false);
    }
  }, [assetLibraryKind, assetLibrarySource, listingEnabled, userId, revision]);

  const loadMoreAssetLibrary = useCallback(async () => {
    if (!listingEnabled || !userId || owner.current.userId !== userId || !assetLibraryNextCursor || isAssetLibraryLoadingMore) return;
    const scope = owner.current;
    const request = ++requestVersion.current;
    const isCurrent = () => owner.current === scope && requestVersion.current === request && libraryCacheRevision(userId) === revision;
    const source = assetLibrarySource;
    const kind = assetLibraryKind;
    const requestKey = `${userId}:${revision}:${buildAssetLibraryCacheKey(kind, source)}`;
    if (assetLibraryLoadedKey !== requestKey) return;

    setIsAssetLibraryLoadingMore(true);
    setAssetLibraryError(null);
    try {
      const response = await ownedAuthFetch(buildAssetLibraryUrl(kind, source, assetLibraryNextCursor), userId);
      const payload = await response.json().catch(() => null);
      if (!isCurrent()) return;
      if (!response.ok || !payload?.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to load more media');
      }
      const nextAssets = normalizeAssetLibraryPayload(payload, source, kind);
      setAssetLibrary((previous) => {
        const urls = new Set(previous.map((asset) => asset.url));
        return [...previous, ...nextAssets.filter((asset) => !urls.has(asset.url) && Boolean(urls.add(asset.url)))];
      });
      const nextCursor = typeof payload.nextCursor === 'string' ? payload.nextCursor : null;
      setAssetLibraryNextCursor(nextCursor);
      setAssetLibraryHasMore(Boolean(payload.hasMore && nextCursor));
    } catch (error) {
      if (!isCurrent()) return;
      setAssetLibraryError(error instanceof Error ? error.message : 'Failed to load more media');
    } finally {
      if (isCurrent()) setIsAssetLibraryLoadingMore(false);
    }
  }, [assetLibraryKind, assetLibraryLoadedKey, assetLibraryNextCursor, assetLibrarySource, isAssetLibraryLoadingMore, listingEnabled, userId, revision]);

  useEffect(() => {
    if (!listingEnabled || !userId || libraryOwnerId !== userId || !assetPickerTarget || !assetLibraryRequestKey || isAssetLibraryLoading) return;
    if (assetLibraryLoadedKey === assetLibraryRequestKey) return;
    setAssetLibrary([]);
    setAssetLibraryError(null);
    void fetchAssetLibrary({ kind: assetLibraryKind, source: assetLibrarySource });
  }, [
    userId,
    libraryOwnerId,
    listingEnabled,
    assetLibraryKind,
    assetLibraryLoadedKey,
    assetLibraryRequestKey,
    assetLibrarySource,
    assetPickerTarget,
    fetchAssetLibrary,
    isAssetLibraryLoading,
  ]);

  const handleDeleteLibraryAsset = useCallback(
    async (asset: UserAsset) => {
      if (!asset?.id || !userId) return;
      const scope = owner.current;
      setAssetDeletePendingId(asset.id);
      try {
        const response = await ownedAuthFetch(`/api/media-library/assets/${encodeURIComponent(asset.id)}`, userId, {
          method: 'DELETE',
        });
        const payload = await response.json().catch(() => null);
        const success = response.ok && Boolean(payload?.ok);
        const notFound = response.status === 404 || payload?.error === 'NOT_FOUND';
        if (!success && !notFound) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to delete image';
          throw new Error(message);
        }

        invalidateLibraryMedia(userId);
        if (owner.current !== scope) return;
        setAssetLibrary((previous) => previous.filter((entry) => entry.id !== asset.id));
        setInputAssets((previous) => {
          let changed = false;
          const next: typeof previous = {};
          for (const [fieldId, entries] of Object.entries(previous)) {
            let fieldChanged = false;
            const updated = entries.map((entry) => {
              if (entry && entry.assetId === asset.id) {
                fieldChanged = true;
                changed = true;
                revokeAssetPreview(entry);
                return null;
              }
              return entry;
            });
            next[fieldId] = fieldChanged ? updated : entries;
          }
          return changed ? next : previous;
        });
      } catch (error) {
        if (owner.current !== scope) return;
        console.error('[assets] failed to delete asset', error);
        showNotice(error instanceof Error ? error.message : 'Failed to delete image');
        throw error;
      } finally {
        if (owner.current === scope) setAssetDeletePendingId(null);
      }
    },
    [setInputAssets, showNotice, userId]
  );

  const handleAssetLibrarySourceChange = useCallback(
    (nextSource: AssetLibrarySource) => {
      if (nextSource === assetLibrarySource) return;
      resetAssetLibraryForSource(nextSource);
    },
    [assetLibrarySource, resetAssetLibraryForSource]
  );

  const closeAssetLibrary = useCallback(() => {
    setAssetPickerTarget(null);
  }, []);

  return {
    assetPickerTarget: libraryOwnerId === userId ? assetPickerTarget : null,
    setAssetPickerTarget,
    assetLibraryKind,
    assetLibrarySource,
    setAssetLibrary: setScopedAssetLibrary,
    visibleAssetLibrary,
    isAssetLibraryLoading,
    assetLibraryError,
    assetLibraryHasMore,
    isAssetLibraryLoadingMore,
    assetDeletePendingId,
    fetchAssetLibrary,
    loadMoreAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    resetAssetLibraryForSource,
  };
}
