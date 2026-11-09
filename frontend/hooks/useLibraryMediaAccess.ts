'use client';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLibraryReadOwner } from './useLibraryReadOwner';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { mediaReadAccessFields } from '@/lib/library-media-access';
import type { MediaReadAccess } from '@/lib/media-read-access';

type State = { access: MediaReadAccess; pending: boolean; error: string | null };
type Entry = { state: State; listeners: Set<() => void>; users: number; attempted: boolean; renewedLeaseExpiresAt?: number; controller?: AbortController; promise?: Promise<boolean> };
const entries = new Map<string, Entry>();
const waiting: (() => void)[] = [];
let running = 0;
const MAX_CONCURRENT_REFRESHES = 4;
async function bounded<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_REFRESHES) await new Promise<void>(resolve => waiting.push(resolve));
  else running++;
  try { signal.throwIfAborted(); return await work(); }
  finally { const next = waiting.shift(); if (next) next(); else running--; }
}
const idle: State = { access: {}, pending: false, error: null };
function publish(entry: Entry, patch: Partial<State>) {
  entry.state = { ...entry.state, ...patch }; entry.listeners.forEach(listener => listener());
}
/** Transient display lease only. Never replaces an asset/ref or committed draft. */
export function useLibraryMediaAccess({ userId, asset, refreshOnMount = true }: { userId: string | null | undefined; asset: MediaReadAccess; refreshOnMount?: boolean }) {
  const authorized = Boolean(userId && userId === asset.readAccessOwnerId && asset.readAccessRef && asset.readAccessRevision);
  const key = authorized ? JSON.stringify([userId, asset.readAccessRef, asset.readAccessRevision]) : null;
  const entry = useMemo(() => {
    if (!key) return null;
    let found = entries.get(key);
    if (!found) {
      found = { state: { access: mediaReadAccessFields(asset), pending: false, error: null }, listeners: new Set(), users: 0, attempted: false };
      entries.set(key, found);
    }
    return found;
    // A freshly signed projection must not reset a healthy mounted decoder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const subscribe = useCallback((listener: () => void) => {
    if (!entry) return () => {};
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
  }, [entry]);
  const state = useSyncExternalStore(subscribe, () => entry?.state ?? idle, () => idle);
  useEffect(() => {
    if (!entry || !key) return;
    entries.set(key, entry);
    entry.users++;
    return () => {
      if (--entry.users === 0) {
        entry.controller?.abort();
        entry.controller = undefined; entry.promise = undefined; entry.attempted = false; entry.renewedLeaseExpiresAt = undefined;
        entry.state = { ...entry.state, pending: false };
        if (entries.get(key) === entry) entries.delete(key);
      }
    };
  }, [entry, key]);
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!entry || !userId || !entry.users) return false;
    if (entry.promise) return entry.promise;
    // A successful replacement gets a new budget only after that lease expires.
    // Failed renewals and immediate grant200/media403 errors never rearm themselves.
    const expiredReplacement = entry.renewedLeaseExpiresAt !== undefined && entry.renewedLeaseExpiresAt <= Date.now();
    if (entry.attempted && !expiredReplacement) { publish(entry, { error: 'READ_ACCESS_FAILED' }); return false; }
    entry.attempted = true;
    entry.renewedLeaseExpiresAt = undefined;
    const controller = new AbortController(); entry.controller = controller;
    publish(entry, { pending: true, error: null });
    entry.promise = bounded(controller.signal, async () => {
      try {
        const response = await ownedAuthFetch('/api/media-library/read-access', userId, {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: entry.state.access.readAccessRef, revision: entry.state.access.readAccessRevision }),
        });
        const body = await response.json();
        controller.signal.throwIfAborted();
        if (!response.ok || !body?.ok || body.access?.readAccessOwnerId !== userId || body.access?.readAccessRevision !== entry.state.access.readAccessRevision
          || JSON.stringify(body.access?.readAccessRef) !== JSON.stringify(entry.state.access.readAccessRef)) throw new Error('READ_ACCESS_FAILED');
        const expiresAt = Date.parse(body.access.readAccessExpiresAt);
        entry.renewedLeaseExpiresAt = Number.isFinite(expiresAt) && expiresAt > Date.now() ? expiresAt : undefined;
        publish(entry, { access: mediaReadAccessFields(body.access), pending: false });
        return true;
      } catch {
        if (!controller.signal.aborted) publish(entry, { pending: false, error: 'READ_ACCESS_FAILED' });
        return false;
      }
    }).catch(() => false).finally(() => { if (entry.controller === controller) entry.promise = undefined; });
    return entry.promise;
  }, [entry, userId]);
  const ensureFresh = useCallback(async () => {
    const expiry = entry?.state.access.readAccessExpiresAt;
    // A proactive mount near expiry may keep a still-valid renewed lease; its next
    // automatic budget is reserved for actual expiry (or explicit Retry).
    if (entry?.attempted && entry.renewedLeaseExpiresAt !== undefined && Date.now() < entry.renewedLeaseExpiresAt) return true;
    return expiry && Date.parse(expiry) <= Date.now() + 30_000 ? refresh() : true;
  }, [entry, refresh]);
  const beginAttempt = useCallback(() => {
    if (entry && !entry.state.pending) { entry.attempted = false; entry.renewedLeaseExpiresAt = undefined; publish(entry, { error: null }); }
  }, [entry]);
  // Only stale leases renew on mount. Valid active readers are not reset by timers.
  useEffect(() => { if (refreshOnMount) void ensureFresh(); }, [ensureFresh, refreshOnMount]);
  return { retired: Boolean(asset.readAccessOwnerId && asset.readAccessOwnerId !== userId), access: entry ? state.access : asset.readAccessOwnerId && asset.readAccessOwnerId !== userId ? {} : mediaReadAccessFields(asset), pending: state.pending, error: state.error, refresh, ensureFresh, beginAttempt };
}

/** Adapters without an account prop bind to the current session, never the DTO owner. */
export function useLibraryDisplayAccess(asset: MediaReadAccess, refreshOnMount = true) {
  const userId = useLibraryReadOwner(Boolean(asset.readAccessOwnerId));
  return useLibraryMediaAccess({ userId, asset, refreshOnMount });
}
