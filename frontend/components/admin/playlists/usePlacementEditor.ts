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
  snapshot: CurationSnapshot;
  candidates: CurationItem[];
  initialIds: string[];
  removedCount?: number;
};
export function usePlacementEditor(
  playlistId: string,
  onStateChange?: (state: { dirty: boolean; busy: boolean }) => void,
) {
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
    async (init?: RequestInit) => {
      const response = await authFetch(url, init);
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
        if (!mounted.current) return;
        const next: CurationDraft = {
          mode: data.snapshot.config?.mode ?? 'manual',
          orderedIds: data.initialIds,
          excludedIds: data.snapshot.config?.excludedIds ?? [],
        };
        saved.current = next;
        setDraft(next);
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
    });
  return {
    loaded,
    draft,
    busy,
    error,
    message,
    preview,
    dirty,
    items,
    change,
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
