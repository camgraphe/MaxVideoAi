'use client';

import { useSearchParams } from 'next/navigation';

export type StudioGenerationMode = 'mock' | 'real';

export const STUDIO_TEST_SIMULATION_QUERY = '__studio_test_simulation';

export function resolveStudioGenerationMode(params: {
  nodeEnv: string | undefined;
  testSimulation: string | null | undefined;
}): StudioGenerationMode {
  if (params.nodeEnv === 'production') return 'real';
  return params.testSimulation === '1' ? 'mock' : 'real';
}

export function useStudioGenerationMode(): StudioGenerationMode {
  const searchParams = useSearchParams();
  return resolveStudioGenerationMode({
    nodeEnv: process.env.NODE_ENV,
    testSimulation: searchParams?.get(STUDIO_TEST_SIMULATION_QUERY),
  });
}
