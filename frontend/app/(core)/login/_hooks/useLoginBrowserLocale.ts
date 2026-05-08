'use client';

import { useEffect, useState } from 'react';

export function useLoginBrowserLocale() {
  const [browserLocale, setBrowserLocale] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setBrowserLocale(navigator.language ?? null);
    }
  }, []);

  return browserLocale;
}
