import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import enginesFixture from '../fixtures/engines.json';
import type { EnginesResponse } from '@/types/engines';
import type { JobsPage } from '@/types/jobs';

const STATIC_ENGINES: EnginesResponse =
  (enginesFixture as EnginesResponse) ?? ({ ok: true, provider: 'mock', engines: [] } as EnginesResponse);

const EMPTY_JOBS_PAGE: JobsPage = {
  ok: true,
  jobs: [],
  nextCursor: null,
};

export function useEngines() {
  return useSWR<EnginesResponse>('static-engines', () => Promise.resolve(STATIC_ENGINES), {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  });
}

export function useInfiniteJobs() {
  return useSWRInfinite<JobsPage>(
    (index) => (index === 0 ? 'static-jobs' : null),
    async () => EMPTY_JOBS_PAGE,
    { revalidateOnFocus: false }
  );
}

export async function runPreflight() {
  throw new Error('Preflight is available only in the private/internal build.');
}

export async function runGenerate() {
  throw new Error('Generate is available only in the private/internal build.');
}

export async function getJobStatus() {
  throw new Error('Job status endpoint is only available in the private/internal build.');
}

export async function hideJob() {
  throw new Error('Job moderation is not supported in the public build.');
}
