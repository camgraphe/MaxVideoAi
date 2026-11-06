'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRecastDraft, saveRecastDraft, type RecastDraft } from '../_lib/recast-draft-store';

/** One local draft per signed-in account. Saves are ordered, including an explicit reset. */
export function useRecastDraft(accountId: string | null, leaveMessage: string) {
  const [initial, setInitial] = useState<RecastDraft | null | undefined>(accountId ? undefined : null);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [epoch, setEpoch] = useState(0);
  const [hasContent, setHasContent] = useState(false);
  const [locked, setLocked] = useState(false);
  const [clearing, setClearing] = useState(false);
  const latest = useRef<RecastDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    if (accountId) void loadRecastDraft(accountId).then(value => {
      if (!cancelled) { latest.current = value; setHasContent(Boolean(value)); setInitial(value); }
    }).catch(() => { if (!cancelled) { setInitial(null); setStatus('error'); } });
    return () => { cancelled = true; alive.current = false; };
  }, [accountId]);
  const persist = useCallback((value: RecastDraft | null) => {
    if (!accountId) return Promise.resolve();
    const task = queue.current.catch(() => {}).then(() => saveRecastDraft(accountId, value));
    queue.current = task;
    void task.then(() => {
      if (alive.current && latest.current === value) setStatus('saved');
    }, () => { if (alive.current) setStatus('error'); });
    return task;
  }, [accountId]);
  const change = useCallback((value: RecastDraft | null) => {
    latest.current = value;
    setHasContent(Boolean(value));
    clearTimeout(timer.current);
    if (!accountId) { if (value) setStatus('error'); return; }
    setStatus('saving');
    timer.current = setTimeout(() => { void persist(value); }, 250);
  }, [accountId, persist]);
  // A route unmount still flushes the last edit, even before the debounce settled.
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (timer.current) void persist(latest.current);
  }, [persist]);
  const reset = useCallback(async () => {
    if (locked || clearing) return;
    clearTimeout(timer.current);
    setClearing(true);
    try {
      await persist(null);
      latest.current = null;
      setHasContent(false);
      setInitial(null);
      setStatus('saved');
      setEpoch(value => value + 1);
    } catch { setStatus('error'); }
    finally { setClearing(false); }
  }, [clearing, locked, persist]);
  const unsafe = locked || (hasContent && status !== 'saved');
  useEffect(() => {
    if (!unsafe) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm(leaveMessage)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [unsafe, leaveMessage]);
  return { initial, epoch, change, reset, status, locked, setLocked, clearing };
}
