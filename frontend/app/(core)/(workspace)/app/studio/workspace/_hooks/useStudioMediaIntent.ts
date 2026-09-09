'use client';
import { useEffect, useMemo, useRef } from 'react';

/** Every async acceptance is bound to the current target and can be explicitly cancelled. */
export function useStudioMediaIntent(scope: unknown) {
  const current = useRef({ scope, token: 0 });
  if (current.current.scope !== scope) current.current = { scope, token: current.current.token + 1 };
  useEffect(() => () => { current.current.token += 1; }, []);
  return useMemo(() => ({
    begin: () => { const token = ++current.current.token; return () => current.current.token === token; },
    cancel: () => { current.current.token += 1; },
  }), []);
}
