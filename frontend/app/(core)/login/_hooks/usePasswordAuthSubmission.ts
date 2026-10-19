'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Keep one SDK request in flight. Only the mounted form that started it
// may apply feedback or navigation from its completion.
export function usePasswordAuthSubmission(mode: string) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const version = useRef(0);
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const invalidate = useCallback(() => { version.current += 1; }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; version.current += 1; };
  }, []);

  const run = async (work: (isCurrent: () => boolean) => Promise<void>, onError: () => void) => {
    if (pending.current || !mounted.current) return;
    pending.current = true;
    const request = ++version.current;
    const isCurrent = () => mounted.current && version.current === request && currentMode.current === mode;
    setBusy(true);
    try { await work(isCurrent); }
    catch { if (isCurrent()) onError(); }
    finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, pending, run, invalidate };
}
