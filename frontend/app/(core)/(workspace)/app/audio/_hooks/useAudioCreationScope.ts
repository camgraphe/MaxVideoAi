'use client';
import { useLayoutEffect, useRef } from 'react';

/** A fresh identity on every transition, including A → B → A. Retired callbacks never regain ownership. */
export function useAudioCreationScope(owner: string | null) {
  const current = useRef<{ owner: string | null; alive: boolean; isCurrent: () => boolean } | null>(null);
  if (!current.current || current.current.owner !== owner) {
    if (current.current) current.current.alive = false;
    const scope = { owner, alive: true, isCurrent: () => current.current === scope && scope.alive };
    current.current = scope;
  }
  const scope = current.current;
  useLayoutEffect(() => {
    scope.alive = true;
    return () => { scope.alive = false; };
  }, [scope]);
  return scope;
}
