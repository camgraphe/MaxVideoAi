'use client';
import { useEffect, type RefObject } from 'react';
/** Slot media is keyed by its display lease; retire the exact previous decoder. */
export function useRetireSlotMedia(container: RefObject<HTMLDivElement | null>, url?: string) {
  useEffect(() => {
    const nodes = Array.from(container.current?.querySelectorAll<HTMLMediaElement>('video,audio') ?? []);
    for (const node of nodes) if (url && node.getAttribute('src') !== url) node.setAttribute('src', url);
    return () => { for (const node of nodes) { if (!node.paused) node.pause(); node.removeAttribute('src'); } };
  }, [container, url]);
}
