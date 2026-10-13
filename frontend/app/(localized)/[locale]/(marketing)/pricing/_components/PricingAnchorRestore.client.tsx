'use client';

import { useEffect, useRef } from 'react';

const CANCEL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide'] as const;
const MAX_WAIT_MS = 30_000;
const FIXED_ANCHORS = new Set(['video-pricing', 'image-pricing', 'audio-pricing', 'tool-pricing', 'full-video-pricing-table', 'pricing-faq']);
type AnchorIntent = { href: string; fromHref: string; id: string; x: number; y: number; explicit: boolean };

/** Restore Pricing destinations missed during streaming, without overriding later navigation intent. */
export function PricingAnchorRestore() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = marker.current?.parentElement;
    if (!scope) return;
    let pending: AnchorIntent | null = null;
    let frame: number | null = null;
    let deadline: number | null = null;
    const observer = new window.MutationObserver(restore);
    const anchorId = (url: URL) => {
      try { const id = decodeURIComponent(url.hash.slice(1)); return FIXED_ANCHORS.has(id) || /^[a-z0-9][a-z0-9-]*-pricing$/.test(id) ? id : null; }
      catch { return null; }
    };
    function cancel() {
      pending = null;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      if (deadline !== null) window.clearTimeout(deadline);
      deadline = null;
    }
    function ready() {
      return ['[data-pricing-content-ready]', '[data-pricing-quick-start-ready]'].every(selector =>
        Array.from(scope!.querySelectorAll(selector)).some(node => !node.parentElement?.closest('[hidden]')));
    }
    function targetFor(id: string) {
      // getElementById may find the pending duplicate or a hidden React transport segment.
      return Array.from(scope!.querySelectorAll<HTMLElement>('[id]'))
        .find(node => node.id === id && !node.closest('[hidden], [aria-busy="true"]'));
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
      if (!ready()) return;
      const target = targetFor(intent.id);
      if (!target) { cancel(); return; }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (pending !== intent || window.location.href !== intent.href || window.scrollX !== intent.x || window.scrollY !== intent.y || targetFor(intent.id) !== target || !ready()) { cancel(); return; }
        cancel();
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
    function begin(url: URL, id: string, explicit: boolean) {
      pending = { href: url.href, fromHref: window.location.href, id, x: window.scrollX, y: window.scrollY, explicit };
      deadline = window.setTimeout(cancel, MAX_WAIT_MS);
      observer.observe(scope!, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy'] });
      restore();
    }
    function click(event: MouseEvent) {
      cancel();
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof window.Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || !scope?.contains(link) || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
      const url = new URL(link.href), current = new URL(window.location.href);
      const id = anchorId(url);
      if (!id || url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search || (ready() && targetFor(id))) return;
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
    // Navigation Timing names the original document. A different route identifies a
    // client navigation whose old page scroll may still be present at this commit.
    let clientArrival = false;
    if (navigation?.name) {
      try {
        const original = new URL(navigation.name);
        clientArrival = original.origin === url.origin && (original.pathname !== url.pathname || original.search !== url.search);
      } catch { /* Missing/invalid timing keeps the conservative initial-document rule. */ }
    }
    if (id && navigation?.type !== 'back_forward' && ((window.scrollX === 0 && window.scrollY === 0) || clientArrival)) {
      begin(url, id, clientArrival);
    }
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
