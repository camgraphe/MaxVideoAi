'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { useOptionalI18n } from '@/lib/i18n/I18nProvider';

type MenuScrollState = { overflow: boolean; above: boolean; below: boolean };
const EMPTY: MenuScrollState = { overflow: false, above: false, below: false };
const COPY = { en: 'More options', fr: 'Plus d’options', es: 'Más opciones' };
export const MENU_SCROLL_CUE_HEIGHT = 20;

export function getMenuVerticalBounds(
  anchor: Pick<DOMRect, 'top' | 'bottom'>, viewportHeight: number,
  menuHeight: number, contentHeight: number, chromeHeight: number,
  preferred: 'top' | 'bottom' | 'auto', optionHeight = 44,
) {
  const above = Math.max(0, anchor.top - 8 - 12);
  const below = Math.max(0, viewportHeight - anchor.bottom - 8 - 12);
  const minimum = Math.min(contentHeight + chromeHeight, optionHeight + MENU_SCROLL_CUE_HEIGHT * 2 + chromeHeight);
  let placement: 'top' | 'bottom' = preferred === 'auto' ? (below < menuHeight && above > below ? 'top' : 'bottom') : preferred;
  // Keep the requested side unless it cannot show a useful option and its cues.
  if (placement === 'top' && above < minimum && below > above) placement = 'bottom';
  else if (placement === 'bottom' && below < minimum && above > below) placement = 'top';
  return { placement, maxHeight: placement === 'top' ? above : below };
}

/** Measure the options viewport, never the cue slots or an inferred option count. */
export function useMenuScrollCues(viewportRef: RefObject<HTMLElement | null>, active: boolean, content: unknown) {
  const [state, setState] = useState(EMPTY);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !viewport) {
      setState(current => current.overflow ? EMPTY : current);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const top = Math.max(0, Math.min(viewport.scrollTop, remaining));
      const limit = Number.parseFloat(window.getComputedStyle(viewport).maxHeight) || Infinity;
      // Removing cues restores this space in a capped flex menu. A filtered list
      // which fits without them must not keep itself artificially overflowing.
      const capacity = Math.min(limit, viewport.clientHeight + (state.overflow ? MENU_SCROLL_CUE_HEIGHT * 2 : 0));
      const overflow = viewport.scrollHeight > capacity + 1;
      const next = { overflow, above: overflow && top > 1, below: overflow && remaining - top > 1 };
      setState(current => current.overflow === next.overflow && current.above === next.above && current.below === next.below ? current : next);
    };
    update();
    viewport.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(viewport);
    // Rich option labels may change size without changing the capped viewport.
    for (const option of viewport.children) observer?.observe(option);
    return () => {
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [active, content, viewportRef, state.overflow]);
  return state;
}

export function MenuScrollCue({ state, direction }: { state: MenuScrollState; direction: 'up' | 'down' }) {
  const locale = useOptionalI18n()?.locale ?? 'en';
  if (!state.overflow) return null;
  const visible = direction === 'up' ? state.above : state.below;
  return (
    <div
      aria-hidden="true"
      data-menu-scroll-cue={direction}
      // Keep both slots while overflowing: scrolling changes visibility, never geometry.
      style={{ height: MENU_SCROLL_CUE_HEIGHT }}
      className={`pointer-events-none flex shrink-0 select-none items-center justify-center whitespace-nowrap text-[11px] leading-none text-text-muted${visible ? '' : ' invisible'}`}
    >
      {COPY[locale]} {direction === 'up' ? '↑' : '↓'}
    </div>
  );
}
