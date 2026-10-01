'use client';
import useSWR from 'swr';
import { readSeedanceWorkflowStatus } from '@/lib/seedance-workflow-status';
import type { SeedanceWorkflowView } from '@/lib/seedance-workflow-contract';
import type { SeedanceWorkflowAccount } from './useSeedanceWorkflowAccount';
export function useSeedanceWorkflowView(jobId: string | null, account: SeedanceWorkflowAccount | null, enabled = true) {
  const key = enabled && jobId && account ? ['seedance-workflow', account.userId, jobId] : null;
  return useSWR<SeedanceWorkflowView | null>(key, async () => {
    if (!account || !jobId) return null;
    return readSeedanceWorkflowStatus(jobId, account.token);
  }, { refreshInterval: 15_000, keepPreviousData: false, revalidateOnFocus: true });
}
