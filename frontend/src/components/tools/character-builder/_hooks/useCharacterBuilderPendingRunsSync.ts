import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import { authFetch } from '@/lib/authFetch';
import type { JobsPage } from '@/types/jobs';
import type { CharacterBuilderRun, CharacterBuilderState } from '@/types/character-builder';
import { buildRecoveredRunFromJob } from '../_lib/character-builder-helpers';
import type { CharacterJobPayload, PendingCharacterRun } from '../_lib/character-builder-types';

type MutateHistoricalJobs = SWRInfiniteKeyedMutator<JobsPage[]>;

interface UseCharacterBuilderPendingRunsSyncOptions {
  authLoading: boolean;
  hydrated: boolean;
  mutateHistoricalJobs: MutateHistoricalJobs;
  pendingRuns: PendingCharacterRun[];
  setPendingRuns: Dispatch<SetStateAction<PendingCharacterRun[]>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  user: unknown;
}

export function useCharacterBuilderPendingRunsSync({
  authLoading,
  hydrated,
  mutateHistoricalJobs,
  pendingRuns,
  setPendingRuns,
  setState,
  user,
}: UseCharacterBuilderPendingRunsSyncOptions) {
  useEffect(() => {
    if (!hydrated || authLoading || !user || !pendingRuns.length) return undefined;

    let cancelled = false;

    async function syncPendingRuns() {
      const completedRuns: CharacterBuilderRun[] = [];
      const completedIds = new Set<string>();
      const failedIds = new Set<string>();

      await Promise.all(
        pendingRuns.map(async (pendingRun) => {
          try {
            const response = await authFetch(`/api/jobs/${encodeURIComponent(pendingRun.jobId)}`);
            const payload = (await response.json().catch(() => null)) as CharacterJobPayload | null;
            if (!response.ok || !payload?.ok || cancelled) return;

            const normalizedStatus = typeof payload.status === 'string' ? payload.status.toLowerCase() : '';
            const recoveredRun = buildRecoveredRunFromJob(pendingRun, payload);
            if (recoveredRun) {
              completedRuns.push(recoveredRun);
              completedIds.add(pendingRun.id);
              return;
            }

            if (normalizedStatus === 'failed' || normalizedStatus === 'error' || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
              failedIds.add(pendingRun.id);
            }
          } catch {
            // ignore transient polling failures
          }
        })
      );

      if (cancelled) return;

      if (completedIds.size || failedIds.size) {
        setPendingRuns((previous) =>
          previous.filter((entry) => !completedIds.has(entry.id) && !failedIds.has(entry.id))
        );
      }

      if (completedRuns.length) {
        setState((previous) => {
          const seenJobIds = new Set(previous.runs.map((run) => run.jobId));
          const freshRuns = completedRuns.filter((run) => !seenJobIds.has(run.jobId));
          if (!freshRuns.length) return previous;
          const nextRuns = [...freshRuns, ...previous.runs].slice(0, 12);
          const firstResultId = freshRuns[0]?.results[0]?.id ?? previous.selectedResultId;
          return {
            ...previous,
            runs: nextRuns,
            selectedResultId: firstResultId,
          };
        });
        void mutateHistoricalJobs(undefined, { revalidate: true });
      }
    }

    void syncPendingRuns();
    const intervalId = window.setInterval(() => {
      void syncPendingRuns();
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authLoading, hydrated, mutateHistoricalJobs, pendingRuns, setPendingRuns, setState, user]);
}
