import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { CharacterBuilderState } from '@/types/character-builder';
import { parseCharacterBuilderSnapshot } from '../_lib/character-builder-helpers';

interface UseCharacterBuilderJobSnapshotLoaderOptions {
  hydrated: boolean;
  jobIdFromQuery: string | null;
  loadFromJobDoneMessage: string;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
}

export function useCharacterBuilderJobSnapshotLoader({
  hydrated,
  jobIdFromQuery,
  loadFromJobDoneMessage,
  setShowStyleReferenceSlot,
  setState,
  setStatusMessage,
}: UseCharacterBuilderJobSnapshotLoaderOptions) {
  useEffect(() => {
    const requestedJobId = jobIdFromQuery;
    if (!hydrated || !requestedJobId) return;
    const activeJobId: string = requestedJobId;
    let cancelled = false;

    async function loadFromJob() {
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(activeJobId)}`);
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              settingsSnapshot?: unknown;
            }
          | null;
        if (!response.ok || !payload?.ok || !payload.settingsSnapshot || cancelled) return;
        const snapshotState = parseCharacterBuilderSnapshot(payload.settingsSnapshot);
        if (!snapshotState) return;
        setState((previous) => ({
          ...previous,
          ...snapshotState,
        }));
        setShowStyleReferenceSlot(Boolean(snapshotState.referenceImages?.some((image) => image.role === 'style')));
        setStatusMessage(loadFromJobDoneMessage);
      } catch (loadError) {
        if (!cancelled) {
          console.warn('[character-builder] failed to load job snapshot', loadError);
        }
      }
    }

    void loadFromJob();

    return () => {
      cancelled = true;
    };
  }, [hydrated, jobIdFromQuery, loadFromJobDoneMessage, setShowStyleReferenceSlot, setState, setStatusMessage]);
}
