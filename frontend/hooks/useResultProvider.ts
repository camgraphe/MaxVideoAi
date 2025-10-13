import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ResultProvider } from '@/types/video-groups';
import { persistResultProvider, resolveResultProvider } from '@/lib/result-provider-mode';

export function useResultProvider(): ResultProvider {
  const searchParams = useSearchParams();
  const params = useMemo(() => {
    if (!searchParams) return null;
    return new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  const [provider, setProvider] = useState<ResultProvider>(() => resolveResultProvider(params));

  useEffect(() => {
    const next = resolveResultProvider(params);
    if (next !== provider) {
      setProvider(next);
    }
    persistResultProvider(next);
  }, [params, provider]);

  return provider;
}
