'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { buildGalleryOpening } from './examples-discovery-layout';
import type { ExampleGalleryVideo, ExampleSort } from './examples-gallery-types';

type Window = { items: ExampleGalleryVideo[]; offset: number; hasMore: boolean };
export function useGalleryReader(videos: ExampleGalleryVideo[], offset: number, sort: ExampleSort, engineFilter: string | null | undefined, locale: string) {
  const token = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [window, setWindow] = useState<Window>({ items: videos, offset, hasMore: videos.length === 24 });
  const [busy, setBusy] = useState(false);
  const [navigationError, setNavigationError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const remembered = useRef(new Map<string, Window>());
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const navigate = useCallback((id: string, nextWindow: Window, push = false) => {
    remembered.current.set(id, nextWindow);
    setWindow(nextWindow); setSelected(id); setNavigationError(false);
    const state = { ...globalThis.window.history.state, exampleReader: { token, id } };
    const url = new URL(globalThis.window.location.href); url.hash = `example=${encodeURIComponent(id)}`;
    globalThis.window.history[push ? 'pushState' : 'replaceState'](state, '', url);
  }, [token]);
  const open = useCallback((video: ExampleGalleryVideo) => navigate(video.id, { items: videos, offset, hasMore: videos.length === 24 }, true), [navigate, videos, offset]);
  const close = useCallback(() => {
    request.current?.abort(); setBusy(false); setSelected(null);
    if (globalThis.window.history.state?.exampleReader?.token === token) globalThis.window.history.back();
  }, [token]);
  useEffect(() => {
    const pop = () => {
      request.current?.abort(); setBusy(false); setNavigationError(false);
      const state = globalThis.window.history.state?.exampleReader;
      const saved = state?.token === token ? remembered.current.get(state.id) : null;
      if (saved) { setWindow(saved); setSelected(state.id); } else setSelected(null);
    };
    globalThis.window.addEventListener('popstate', pop);
    return () => { request.current?.abort(); globalThis.window.removeEventListener('popstate', pop); };
  }, [token]);
  const index = window.items.findIndex(video => video.id === selected);
  const step = async (direction: -1 | 1) => {
    if (busy || !selected) return;
    const neighbor = window.items[index + direction];
    if (neighbor) { navigate(neighbor.id, window); return; }
    const nextOffset = window.offset + direction * 24;
    if (nextOffset < 0 || (direction === 1 && !window.hasMore)) return;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setBusy(true); setNavigationError(false);
    const params = new URLSearchParams({ sort, locale, offset: String(nextOffset), limit: '24' });
    if (engineFilter) params.set('engine', engineFilter);
    try {
      const response = await fetch(`/api/examples?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Catalog unavailable');
      const result = await response.json() as { cards: ExampleGalleryVideo[]; hasMore: boolean };
      if (!Array.isArray(result.cards)) throw new Error('Invalid catalog');
      if (controller.signal.aborted || selectedRef.current !== selected) return;
      const opening = buildGalleryOpening(result.cards, nextOffset === 0 && sort === 'playlist');
      const items = [...opening.opening, ...opening.rest];
      const next = direction === 1 ? items[0] : items.at(-1);
      if (next) navigate(next.id, { items, offset: nextOffset, hasMore: result.hasMore });
      else if (direction === 1) setWindow(current => ({ ...current, hasMore: false }));
    } catch { if (!controller.signal.aborted) setNavigationError(true); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return { selected, open, close, step, busy, navigationError,
    canPrevious: index > 0 || window.offset > 0, canNext: index < window.items.length - 1 || window.hasMore };
}
