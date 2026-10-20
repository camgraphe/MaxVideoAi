'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SWRConfig, type Middleware } from 'swr';
import { infinite } from 'swr/infinite';
import { isFocusResyncPath, shouldResyncKey } from './focus-resync-policy';

// The shared resync handles these keys on focus, visibility and BFCache restore.
// Keep native SWR focus for every other key (including consumers with their own opt-out).
const sharedFocusOwner: Middleware = (useSWRNext) => (key, fetcher, config) => {
  // Infinite receives a page-key loader here, not a normal dependent key.
  // Its aggregate cache is excluded from filtered mutate, so retain its native focus owner.
  if (config.use?.includes(infinite)) return useSWRNext(key, fetcher, config);
  let resolvedKey = key;
  if (typeof key === 'function') {
    try {
      resolvedKey = key();
    } catch {
      resolvedKey = null; // Same dependent-key behavior as SWR.
    }
  }
  return useSWRNext(resolvedKey, fetcher, {
    ...config,
    revalidateOnFocus: shouldResyncKey(resolvedKey) ? false : config.revalidateOnFocus,
  });
};

const SWR_CONFIG = {
  revalidateOnFocus: true,
  focusThrottleInterval: 5000,
};

export function SWRProvider({ children }: { children: ReactNode }) {
  const shouldWatch = isFocusResyncPath(usePathname());
  const config = useMemo(() => ({ ...SWR_CONFIG, use: shouldWatch ? [sharedFocusOwner] : [] }), [shouldWatch]);
  return <SWRConfig value={config}>{children}</SWRConfig>;
}
