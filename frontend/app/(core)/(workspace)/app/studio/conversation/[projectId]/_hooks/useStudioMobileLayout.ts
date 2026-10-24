'use client';

import {useEffect, useSyncExternalStore, type RefObject} from 'react';

const query = '(max-width: 767px)';
function subscribe(change: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

/** The visual viewport also shrinks for the iPhone keyboard; dvh alone does not. */
export function useStudioMobileLayout(root: RefObject<HTMLElement>) {
  const mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    if (!mobile) return;
    const shell = root.current?.closest<HTMLElement>('[data-studio-mobile-shell]');
    if (!shell) return;
    const viewport = window.visualViewport;
    const update = () => {
      // Pinch zoom must remain usable rather than reflowing the interface.
      if (viewport && viewport.scale !== 1) return;
      shell.style.setProperty('--studio-mobile-height', `${viewport?.height ?? window.innerHeight}px`);
      shell.style.setProperty('--studio-mobile-top', `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      shell.style.removeProperty('--studio-mobile-height');
      shell.style.removeProperty('--studio-mobile-top');
    };
  }, [mobile, root]);
  return mobile;
}
