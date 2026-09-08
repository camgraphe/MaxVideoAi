'use client';

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { createBillingRequestScope } from '../_lib/billing-request-scope';

/** A new identity retires both requests and retained event callbacks, including ABA changes. */
export function useBillingRequestOwner(identity: string | null) {
  const owner = useMemo(() => ({ identity }), [identity]);
  const current = useRef<typeof owner | null>(null);
  const scopeRef = useRef(createBillingRequestScope());
  const requestScope = scopeRef.current;
  useLayoutEffect(() => {
    // Hooks mask data against `owner` during render. Commit callback ownership before
    // browser events/passive effects, without retiring a still-visible tree during
    // a speculative render that React may abandon.
    current.current = owner;
    return () => {
      current.current = null;
      requestScope.invalidate();
    };
  }, [owner, requestScope]);
  const isActive = useCallback(
    () => owner.identity !== null && current.current === owner,
    [owner]
  );
  return { owner, requestScope, isActive };
}
