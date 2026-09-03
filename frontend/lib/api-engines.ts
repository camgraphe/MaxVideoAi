import useSWR from 'swr';
import type { EnginesResponse } from '@/types/engines';
import { authFetch } from '@/src/lib/authFetch';

export type EngineCategory = 'video' | 'image' | 'all';

export type EnginesAuthScope =
  | { status: 'pending' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; principalId: string; accessToken: string };

export type UseEnginesOptions = {
  includeAverages?: boolean;
  enabled?: boolean;
  authScope?: EnginesAuthScope;
};

async function loadFallbackEngines(category: EngineCategory): Promise<EnginesResponse['engines']> {
  const { getBaseEnginesByCategory } = await import('@/lib/engines');
  return getBaseEnginesByCategory(category);
}

export function useEngines(category: EngineCategory = 'video', options?: UseEnginesOptions) {
  const enabled = options?.enabled !== false;
  const authScope = options?.authScope ?? { status: 'anonymous' as const };
  const authenticated =
    authScope.status === 'authenticated'
    && authScope.principalId.trim().length > 0
    && authScope.accessToken.trim().length > 0;
  const cachePrincipal = authScope.status === 'anonymous'
    ? 'anonymous'
    : authenticated
      ? `principal:${authScope.principalId.trim()}`
      : null;
  const params = new URLSearchParams();
  if (category !== 'video') {
    params.set('category', category);
  }
  if (options?.includeAverages) {
    params.set('includeAverages', '1');
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return useSWR<EnginesResponse>(
    enabled && cachePrincipal
      ? ['engines', cachePrincipal, category, options?.includeAverages ? 'avg' : 'base']
      : null,
    async () => {
      try {
        const response = authenticated
          ? await authFetch(`/api/engines${query}`, {
              credentials: 'include',
              cache: 'no-store',
              headers: { Authorization: `Bearer ${authScope.accessToken}` },
            })
          : await fetch(`/api/engines${query}`, {
              credentials: 'omit',
              cache: 'no-store',
            });
        const data = (await response.json().catch(() => null)) as
          | { engines?: EnginesResponse['engines']; engineScores?: EnginesResponse['engineScores']; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(data?.error ?? `Engines request failed: ${response.status}`);
        }
        return { engines: data?.engines ?? [], engineScores: data?.engineScores ?? {} };
      } catch {
        const fallbackEngines = await loadFallbackEngines(category);
        return { engines: fallbackEngines, engineScores: {} };
      }
    },
    {
      dedupingInterval: 5 * 60 * 1000,
    }
  );
}
