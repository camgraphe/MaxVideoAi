'use client';
import { useEffect, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import {
  invalidateLibraryMedia,
  libraryRevisionKey,
  useLibraryCacheRevision,
  useLibraryScopePersistence,
} from '@/hooks/useLibraryCacheRevision';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import type { LibraryCollection } from '@/lib/media-library-organization';
type Page = { items: LibraryCollection[]; nextCursor: string | null; hasMore: boolean };
export function useLibraryCollections(userId: string) {
  const revision = useLibraryCacheRevision(userId),
    persistSize = useLibraryScopePersistence(userId);
  const query = useSWRInfinite<Page>(
    (index, previous) =>
      !userId || (previous && !previous.nextCursor)
        ? null
        : libraryRevisionKey(
            [
              `/api/media-library/collections?limit=30${index && previous?.nextCursor ? '&cursor=' + encodeURIComponent(previous.nextCursor) : ''}`,
              userId,
            ],
            revision
          ),
    async ([url, owner]: readonly [string, string, number]) => {
      const response = await ownedAuthFetch(url, owner),
        body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'COLLECTION_FAILED');
      return body;
    },
    {
      persistSize,
      keepPreviousData: false,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  const context = useRef({ userId });
  if (context.current.userId !== userId) context.current = { userId };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [state, setState] = useState<{ owner: string; pending: boolean; error: string | null }>({
    owner: userId,
    pending: false,
    error: null,
  });
  const stateRef = useRef(false);
  useEffect(() => {
    stateRef.current = false;
    setState({ owner: userId, pending: false, error: null });
  }, [userId]);
  const write = async (method: 'POST' | 'PATCH' | 'DELETE', id?: string, name?: string) => {
    if (stateRef.current) return false;
    const captured = context.current;
    const isCurrent = () => alive.current && context.current === captured;
    const trimmed = name?.trim();
    if (method !== 'DELETE' && (!trimmed || Array.from(trimmed).length > 120)) {
      setState({ owner: userId, pending: false, error: 'INVALID_COLLECTION_NAME' });
      return false;
    }
    stateRef.current = true;
    setState({ owner: userId, pending: true, error: null });
    try {
      const response = await ownedAuthFetch(
        `/api/media-library/collections${id ? '/' + encodeURIComponent(id) : ''}`,
        userId,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(method === 'DELETE' ? {} : { body: JSON.stringify({ name: trimmed }) }),
        }
      );
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'COLLECTION_FAILED');
      invalidateLibraryMedia(userId);
      return isCurrent();
    } catch (e) {
      if (isCurrent()) setState({ owner: userId, pending: false, error: (e as Error).message });
      return false;
    } finally {
      if (isCurrent()) {
        stateRef.current = false;
        setState((s) => ({ ...s, pending: false }));
      }
    }
  };
  const last = query.data?.at(-1);
  return {
    items: query.data?.flatMap((p) => p.items) ?? [],
    isLoading: query.isLoading,
    error: state.owner === userId ? (state.error ?? query.error ?? null) : null,
    pending: state.owner === userId && state.pending,
    write,
    hasMore: Boolean(last?.hasMore),
    loadMore: () => {
      if (last?.nextCursor && !query.isValidating) void query.setSize((s) => s + 1);
    },
    refresh: query.mutate,
  };
}
