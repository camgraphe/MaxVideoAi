'use client';

import { useEffect, useRef } from 'react';

export function useMarketingMenuFocus(active: boolean, menuId: string) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;
    const opener = Array.from(document.querySelectorAll<HTMLElement>('[popovertarget]'))
      .find(node => node.getAttribute('popovertarget') === menuId && !panel.contains(node));
    const previous = document.activeElement instanceof HTMLElement && !panel.contains(document.activeElement)
      ? document.activeElement : opener;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, select, [tabindex="0"]'))
      .filter(node => node.getClientRects().length > 0);
    // Native popovers are non-modal before JS. Once enhanced, contain focus and
    // make background siblings inert before announcing aria-modal on the panel.
    const background: Array<{ node: HTMLElement; inert: boolean }> = [];
    let foreground: HTMLElement = panel.parentElement ?? panel;
    while (foreground.parentElement) {
      for (const sibling of Array.from(foreground.parentElement.children)) {
        if (sibling !== foreground && sibling instanceof HTMLElement) {
          background.push({ node: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      foreground = foreground.parentElement;
      if (foreground === document.body) break;
    }
    if (!panel.contains(document.activeElement)) focusables()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener('keydown', trapFocus);
    return () => {
      panel.removeEventListener('keydown', trapFocus);
      background.forEach(({ node, inert }) => { node.inert = inert; });
      previous?.focus();
    };
  }, [active, menuId]);
  return panelRef;
}
