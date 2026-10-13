'use client';

import { useEffect, useRef } from 'react';

const CANCEL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide'] as const;
const CATALOG_ANCHOR_IDS = ['models-grid', 'recommended'];
type AnchorIntent = { href: string; fromHref: string; id: string; x: number; y: number; explicit: boolean };

/** Restore local anchors missed while catalogue prices were suspended, without overriding later navigation intent. */
export function ModelsCatalogAnchorRestore() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = marker.current?.parentElement;
    if (!scope) return;
    let pending: AnchorIntent | null = null;
    let frame: number | null = null;
    const observer = new window.MutationObserver(restore);
    const anchorId = (url: URL) => {
      try { const id = decodeURIComponent(url.hash.slice(1)); return CATALOG_ANCHOR_IDS.includes(id) ? id : null; }
      catch { return null; }
    };
    function cancel() {
      pending = null;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    }
    function restore() {
      const intent = pending;
      if (!intent || frame !== null) return;
      // A reveal mutation can precede delivery of the router's queued scroll event.
      if (intent.explicit && window.location.href === intent.href) {
        intent.x = window.scrollX;
        intent.y = window.scrollY;
      }
      if (window.scrollX !== intent.x || window.scrollY !== intent.y) { cancel(); return; }
      if (window.location.href !== intent.href) {
        // Link may commit pushState after the captured click, without a hashchange event.
        if (!intent.explicit || window.location.href !== intent.fromHref) cancel();
        return;
      }
      const target = document.getElementById(intent.id);
      if (!target || !scope?.contains(target)) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (pending !== intent || window.location.href !== intent.href || window.scrollX !== intent.x || window.scrollY !== intent.y || !scope.contains(target)) { cancel(); return; }
        cancel();
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
    function begin(url: URL, id: string, explicit: boolean) {
      pending = { href: url.href, fromHref: window.location.href, id, x: window.scrollX, y: window.scrollY, explicit };
      observer.observe(scope!, { childList: true, subtree: true });
      restore();
    }
    function click(event: MouseEvent) {
      cancel();
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof window.Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || !scope?.contains(link) || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
      const url = new URL(link.href), current = new URL(window.location.href);
      const id = anchorId(url);
      if (!id || url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search || document.getElementById(id)) return;
      begin(url, id, true);
      window.queueMicrotask(restore);
    }
    function scroll() {
      if (pending?.explicit && window.location.href === pending.href) {
        // Next may scroll to the route shell when a clicked hash target is still suspended.
        // User gestures already cancel the intent before their scroll events arrive.
        pending.x = window.scrollX;
        pending.y = window.scrollY;
        restore();
      } else cancel();
    }
    function hashChange() {
      if (pending?.explicit && window.location.href === pending.href) restore();
      else cancel();
    }
    for (const event of CANCEL_EVENTS) window.addEventListener(event, cancel, { capture: true, passive: true });
    window.addEventListener('scroll', scroll, { capture: true, passive: true });
    window.addEventListener('click', click, true);
    window.addEventListener('hashchange', hashChange);
    const url = new URL(window.location.href), id = anchorId(url);
    const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (id && window.scrollX === 0 && window.scrollY === 0 && navigation?.type !== 'back_forward') begin(url, id, false);
    return () => {
      cancel();
      for (const event of CANCEL_EVENTS) window.removeEventListener(event, cancel, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('hashchange', hashChange);
    };
  }, []);

  return <span ref={marker} hidden />;
}
