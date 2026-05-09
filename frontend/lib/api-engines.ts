import useSWR from 'swr';
import type { EnginesResponse } from '@/types/engines';

export type EngineCategory = 'video' | 'image' | 'all';

export type UseEnginesOptions = {
  includeAverages?: boolean;
  enabled?: boolean;
};

async function loadFallbackEngines(category: EngineCategory): Promise<EnginesResponse['engines']> {
  const { getBaseEnginesByCategory } = await import('@/lib/engines');
  return getBaseEnginesByCategory(category);
}

export function useEngines(category: EngineCategory = 'video', options?: UseEnginesOptions) {
  const enabled = options?.enabled !== false;
  const params = new URLSearchParams();
  if (category !== 'video') {
    params.set('category', category);
  }
  if (options?.includeAverages) {
    params.set('includeAverages', '1');
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return useSWR<EnginesResponse>(
    enabled ? `static-engines:${category}:${options?.includeAverages ? 'avg' : 'base'}` : null,
    async () => {
      try {
        const response = await fetch(`/api/engines${query}`, { credentials: 'include' });
        const data = (await response.json().catch(() => null)) as
          | { engines?: EnginesResponse['engines']; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(data?.error ?? `Engines request failed: ${response.status}`);
        }
        return { engines: data?.engines ?? [] };
      } catch {
        const fallbackEngines = await loadFallbackEngines(category);
        return { engines: fallbackEngines };
      }
    },
    {
      dedupingInterval: 5 * 60 * 1000,
    }
  );
}
