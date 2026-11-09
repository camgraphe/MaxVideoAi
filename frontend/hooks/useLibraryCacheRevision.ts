'use client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

// Revisions fence complete page/Infinite aggregates, including inactive filters and
// old DTOs whose row IDs are not organization keys. No media or grants live here.
const revisions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();
export function libraryCacheRevision(userId: string | null | undefined): number {
  return userId ? revisions.get(userId) ?? 0 : 0;
}
/** Publish only confirmed writes, always using the initiating account. */
export function invalidateLibraryMedia(userId: string): void {
  revisions.set(userId, libraryCacheRevision(userId) + 1);
  listeners.get(userId)?.forEach(listener => listener());
}
export function useLibraryCacheRevision(userId: string | null | undefined): number {
  const subscribe = useCallback((listener: () => void) => {
    if (!userId) return () => {};
    const owned = listeners.get(userId) ?? new Set();
    listeners.set(userId, owned); owned.add(listener);
    return () => { owned.delete(listener); if (!owned.size) listeners.delete(userId); };
  }, [userId]);
  return useSyncExternalStore(subscribe, () => libraryCacheRevision(userId), () => 0);
}
export function libraryRevisionKey<T extends readonly [string, string]>(key: T | null, revision: number): readonly [string, string, number] | null {
  return key ? [key[0], key[1], revision] : null;
}

/** Keep visited page count for mutation refreshes, reset it for a real scope change. */
export function useLibraryScopePersistence(scope: string): boolean {
  const previous = useRef(scope);
  const persist = previous.current === scope;
  useEffect(() => { previous.current = scope; }, [scope]);
  return persist;
}
