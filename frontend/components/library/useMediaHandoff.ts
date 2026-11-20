'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { consumeMediaHandoff, receiveMediaHandoff, type MediaDestination } from '@/lib/media-handoff';

/** One pending original per tab and exact navigation scope. */
export function useMediaHandoff(userId: string | null | undefined, destination: MediaDestination) {
  const params = useSearchParams();
  const token = params?.get('media');
  const scope = userId && token ? JSON.stringify([userId, destination, token]) : null;
  const [pending, setPending] = useState<{ scope: string; request: NonNullable<ReturnType<typeof receiveMediaHandoff>> } | null>(null);
  // StrictMode replays effects after the storage value has already been consumed.
  const attemptedScope = useRef<string | null>(null);
  useEffect(() => {
    if (attemptedScope.current === scope) return;
    attemptedScope.current = scope;
    setPending(null);
    if (!scope || !userId || !token) return;
    try {
      const request = receiveMediaHandoff(window.sessionStorage, userId, destination, token);
      if (request) setPending({ scope, request });
    } catch { /* Storage can be unavailable; no media is inserted. */ }
  }, [scope, userId, destination, token]);
  // Hide stale media during render, before the invalidating effect runs.
  const request = pending?.scope === scope ? pending?.request : null;
  const close = useCallback(() => {
    if (request?.videoSource && userId && token) {
      try { consumeMediaHandoff(window.sessionStorage, userId, destination, token); }
      catch { /* The draft can still use its attached source. */ }
    }
    setPending(current => current?.scope === scope ? null : current);
  }, [request, scope, token, userId, destination]);
  return { asset: request?.asset ?? null, videoSource: request?.videoSource, token, close };
}
