'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';

// One nonredirecting subscription for mounted private display readers. Public
// readers do not load auth, and a stale initial session cannot beat an auth event.
const listeners = new Set<() => void>();
let owner: string | null = null;
let stop: (() => void) | undefined;
function start() {
  let retired = false;
  let observedEvent = false;
  let unsubscribe: (() => void) | undefined;
  const apply = (id: string | null) => {
    if (retired || owner === id) return;
    owner = id;
    listeners.forEach(listener => listener());
  };
  void loadSupabaseClient().then(async client => {
    if (retired) return;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      observedEvent = true;
      apply(session?.user.id ?? null);
    });
    unsubscribe = () => data.subscription.unsubscribe();
    const initial = await client.auth.getSession();
    if (!observedEvent) apply(initial.data.session?.user.id ?? null);
  }).catch(() => { if (!observedEvent) apply(null); });
  stop = () => { retired = true; unsubscribe?.(); owner = null; };
}
export function useLibraryReadOwner(enabled: boolean) {
  const subscribe = useCallback((listener: () => void) => {
    if (!enabled) return () => {};
    listeners.add(listener);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(listener);
      if (!listeners.size) { stop?.(); stop = undefined; }
    };
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => enabled ? owner : null, () => null);
}
