'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';

/** Read one cursor page near the viewport end; never retry the same progress in a loop. */
export function useLibraryScrollPagination({ scrollRef, scopeKey, progress, layoutKey, enabled, busy, failed, onLoadMore }: {
  scrollRef: RefObject<HTMLDivElement | null>;
  scopeKey: string;
  progress: string;
  layoutKey: string;
  enabled: boolean;
  busy: boolean;
  failed: boolean;
  onLoadMore?: () => void;
}) {
  const key = JSON.stringify([scopeKey, progress]);
  const requested = useRef<string | null>(null);
  const currentKey = useRef(key);
  if (currentKey.current !== key) {
    currentKey.current = key;
    requested.current = null;
  }
  const latest = useRef(onLoadMore);
  latest.current = onLoadMore;
  const [fallbackKey, setFallbackKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || busy || failed) return;
    const element = scrollRef.current;
    if (!element) { setFallbackKey(key); return; }
    let retired = false, frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const fallback = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (!retired && currentKey.current === key) setFallbackKey(key); }, 15_000);
    };
    const check = () => {
      if (retired || currentKey.current !== key || !element.isConnected || document.visibilityState === 'hidden' || navigator.onLine === false) return;
      if (!element.clientHeight || !element.scrollHeight || requested.current === key) return;
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      if (remaining > Math.min(160, element.clientHeight / 3)) return;
      // Stamp before the callback: scroll/resize events cannot queue a second page
      // while the caller is still publishing its loading state.
      requested.current = key;
      fallback();
      try { latest.current?.(); }
      catch { setFallbackKey(key); }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    element.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('online', schedule);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(element);
    // The virtualizer owns this presentation element's full content height.
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    if (requested.current === key) fallback();
    schedule();
    return () => {
      retired = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      element.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('online', schedule);
    };
  }, [scrollRef, key, layoutKey, enabled, busy, failed]);

  return { manualRequired: failed || fallbackKey === key };
}
