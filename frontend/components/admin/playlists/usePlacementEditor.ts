'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import {
  resolveCuration,
  type CurationDraft,
  type CurationItem,
  type CurationPreview,
  type CurationSnapshot,
} from '@/lib/admin/playlist-curation';

type Loaded = {
  candidatePage?: {items: CurationItem[]; total: number; nextCursor: string | null};
  snapshot: CurationSnapshot;
  candidates: CurationItem[];
  selectedItems: CurationItem[];
  selectedTotal: number;
  initialIds: string[];
  removedCount?: number;
};
export function usePlacementEditor(
  playlistId: string,
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void,
  onSaved?: () => void | Promise<void>,
) {
  const [selectedPage, setSelectedPage] = useState(0);
  const [windowBusy, setWindowBusy] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<CurationDraft>({
    mode: 'manual',
    orderedIds: [],
    excludedIds: [],
  });
  const saved = useRef(draft);
  const [busy, setBusy] = useState(true);
  const running = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CurationPreview | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.current);
  const url = `/api/admin/playlists/${playlistId}/curation`;
  const request = useCallback(
    async (init?: RequestInit, suffix = '') => {
      const response = await authFetch(url + suffix, init);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? 'Unable to load or save this destination.');
      return payload;
    },
    [url],
  );
  const run = useCallback(async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      if (mounted.current) {
        setError(error instanceof Error ? error.message : 'Request failed');
        setPreview(null);
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  const reload = useCallback(
    () =>
      run(async () => {
        const data: Loaded = await request();
        const byId = new Map((data.selectedItems ?? []).map(item => [item.id, item]));
        if (data.snapshot.available && data.snapshot.supported) {
          const missingOpening = (data.snapshot.config?.openingIds ?? []).filter(id => !byId.has(id));
          if (missingOpening.length) {
            const params = new URLSearchParams();
            missingOpening.forEach(id => params.append('ids', id));
            const window = await request(undefined, `/candidates?${params}`);
            for (const item of window.items as CurationItem[]) byId.set(item.id, item);
          }
        }
        data.candidates = [...byId.values()];
        if (!mounted.current) return;
        const next: CurationDraft = {
          openingIds: data.snapshot.config?.openingIds ?? null,
          mode: data.snapshot.config?.mode ?? 'manual',
          orderedIds: data.initialIds,
          excludedIds: data.snapshot.config?.excludedIds ?? [],
        };
        saved.current = next;
        setDraft(next);
        setSelectedPage(0);
        setLoaded(data);
        setPreview(null);
        setMessage(null);
      }),
    [request, run],
  );
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);
  useEffect(() => {
    onStateChange?.({ dirty, busy });
  }, [dirty, busy, onStateChange]);
  useEffect(() => () => onStateChange?.({ dirty: false, busy: false }), [onStateChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const change = (next: CurationDraft) => {
    if (running.current) return;
    setDraft(next);
    setPreview(null);
    setMessage(null);
  };
  const changeMode = (mode: CurationDraft['mode']) => {
    if (running.current || mode === draft.mode) return;
    if (mode === 'hybrid') { change({ ...draft, mode }); return; }
    return run(async () => {
      const eligible: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const page: { ids: string[]; total: number } = await request(undefined, `/candidates?idsOnly=true&limit=500&offset=${offset}`);
        eligible.push(...page.ids);
        if (!page.ids.length || offset + page.ids.length >= page.total) break;
      }
      if (!mounted.current) return;
      const eligibleSet = new Set(eligible);
      const excluded = new Set(draft.excludedIds);
      const orderedIds = [...new Set([...(draft.openingIds ?? []), ...draft.orderedIds, ...eligible])]
        .filter(id => eligibleSet.has(id) && !excluded.has(id));
      setDraft({ ...draft, mode, orderedIds });
      setPreview(null);
      setMessage(null);
    });
  };
  const rememberItems = useCallback((items: CurationItem[]) => {
    setLoaded(current => current ? { ...current, candidates: [...new Map([...current.candidates, ...items].map(item => [item.id, item])).values()] } : current);
  }, []);
  const tailIds = draft.orderedIds.filter(id => !draft.openingIds?.includes(id));
  const page = Math.min(selectedPage, Math.max(0, Math.ceil(tailIds.length / 48) - 1));
  const windowIds = tailIds.slice(page * 48, (page + 1) * 48);
  const windowKey = windowIds.join(',');
  const loadedReady = Boolean(loaded);
  const needsFirstWindow = Boolean(page === 0 && loaded && windowIds.some(id => !loaded.candidates.some(item => item.id === id)));
  useEffect(() => {
    if (!loadedReady || (page === 0 && !needsFirstWindow)) { setWindowBusy(false); return; }
    let active = true;
    const params = new URLSearchParams();
    windowKey.split(',').filter(Boolean).forEach(id => params.append('ids', id));
    if (!params.size) return;
    setWindowBusy(true);
    void request(undefined, `/candidates?${params}`).then(data => {
      if (active) rememberItems(data.items);
    }).catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setWindowBusy(false); });
    return () => { active = false; };
  }, [page, windowKey, request, rememberItems, loadedReady, needsFirstWindow]);
  const items = resolveCuration(draft, loaded?.candidates ?? []);
  const makePreview = () =>
    run(async () => {
      const data = await request({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, revision: loaded?.snapshot.revision }),
      });
      if (mounted.current) setPreview(data.preview);
    });
  const save = () =>
    run(async () => {
      if (!preview || !loaded) return;
      const data = await request({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft,
          revision: loaded.snapshot.revision,
          token: preview.token,
        }),
      });
      if (!mounted.current) return;
      saved.current = draft;
      setLoaded({
        ...loaded,
        snapshot: data.snapshot,
        initialIds: draft.orderedIds,
        removedCount: 0,
      });
      setPreview(null);
      setMessage('Page selection saved.');
      void Promise.resolve().then(() => onSaved?.()).catch(error => console.error('[PlacementEditor] destination refresh failed', error));
    });
  return {
    selectedPage: page, setSelectedPage, windowBusy, windowIds, tailIds, rememberItems,
    loaded,
    draft,
    busy,
    error,
    message,
    preview,
    dirty,
    items,
    change,
    changeMode,
    makePreview,
    save,
    reload,
    cancel: () => {
      if (running.current) return;
      setDraft(saved.current);
      setPreview(null);
      setError(null);
      setMessage(null);
    },
  };
}
