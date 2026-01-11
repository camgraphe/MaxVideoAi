'use client';

import { useEffect, useState } from 'react';

export function IdleMount({
  children,
  fallback = null,
  timeoutMs = 1200,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeoutMs?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const run = () => {
      if (!cancelled) {
        setMounted(true);
      }
    };

    const handle =
      typeof idleWindow.requestIdleCallback === 'function'
        ? idleWindow.requestIdleCallback(run, { timeout: timeoutMs })
        : window.setTimeout(run, timeoutMs);

    return () => {
      cancelled = true;
      if (typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [timeoutMs]);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
