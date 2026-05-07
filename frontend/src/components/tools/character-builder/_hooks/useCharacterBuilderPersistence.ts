import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import {
  CHARACTER_BUILDER_STORAGE_KEY,
  createDefaultCharacterBuilderState,
} from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
} from '@/types/character-builder';
import {
  CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY,
  getRefByRole,
  INITIAL_LOADING_REQUEST_COUNTS,
  readPersistedPendingRuns,
  readPersistedState,
  writePersistedPendingRuns,
  writePersistedState,
} from '../_lib/character-builder-helpers';
import type {
  LoadingRequestCounts,
  PendingCharacterRun,
} from '../_lib/character-builder-types';

interface UseCharacterBuilderPersistenceOptions {
  authLoading: boolean;
  hydrated: boolean;
  pendingRuns: PendingCharacterRun[];
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHairOpen: Dispatch<SetStateAction<boolean>>;
  setHydrated: Dispatch<SetStateAction<boolean>>;
  setLightboxEntry: Dispatch<SetStateAction<MediaLightboxEntry | null>>;
  setLoadingActions: Dispatch<SetStateAction<LoadingRequestCounts>>;
  setMustRemainDraft: Dispatch<SetStateAction<string>>;
  setPendingRuns: Dispatch<SetStateAction<PendingCharacterRun[]>>;
  setSavingResultId: Dispatch<SetStateAction<string | null>>;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  state: CharacterBuilderState;
  styleReference: CharacterBuilderReferenceImage | null | undefined;
  user: unknown;
}

export function useCharacterBuilderPersistence({
  authLoading,
  hydrated,
  pendingRuns,
  setAdvancedOpen,
  setError,
  setHairOpen,
  setHydrated,
  setLightboxEntry,
  setLoadingActions,
  setMustRemainDraft,
  setPendingRuns,
  setSavingResultId,
  setShowStyleReferenceSlot,
  setState,
  setStatusMessage,
  state,
  styleReference,
  user,
}: UseCharacterBuilderPersistenceOptions) {
  const visitorSanitizedRef = useRef(false);

  useEffect(() => {
    const persisted = readPersistedState();
    if (persisted) {
      setState(persisted);
      setAdvancedOpen(Boolean(persisted.advancedNotes));
      setShowStyleReferenceSlot(Boolean(getRefByRole(persisted.referenceImages, 'style')));
    }
    const pending = readPersistedPendingRuns();
    if (pending.length) {
      setPendingRuns(pending);
    }
    setHydrated(true);
  }, [setAdvancedOpen, setHydrated, setPendingRuns, setShowStyleReferenceSlot, setState]);

  useEffect(() => {
    if (styleReference) {
      setShowStyleReferenceSlot(true);
    }
  }, [setShowStyleReferenceSlot, styleReference]);

  useEffect(() => {
    if (!hydrated) return;
    writePersistedState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    writePersistedPendingRuns(pendingRuns);
  }, [hydrated, pendingRuns]);

  useEffect(() => {
    if (authLoading || !hydrated) return;
    if (user) {
      visitorSanitizedRef.current = false;
      return;
    }
    if (visitorSanitizedRef.current) return;
    visitorSanitizedRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CHARACTER_BUILDER_STORAGE_KEY);
        window.localStorage.removeItem(CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY);
      } catch {
        // ignore storage failures
      }
    }
    setState(createDefaultCharacterBuilderState());
    setAdvancedOpen(false);
    setHairOpen(false);
    setShowStyleReferenceSlot(false);
    setMustRemainDraft('');
    setLoadingActions(INITIAL_LOADING_REQUEST_COUNTS);
    setPendingRuns([]);
    setSavingResultId(null);
    setLightboxEntry(null);
    setError(null);
    setStatusMessage(null);
  }, [
    authLoading,
    hydrated,
    setAdvancedOpen,
    setError,
    setHairOpen,
    setLightboxEntry,
    setLoadingActions,
    setMustRemainDraft,
    setPendingRuns,
    setSavingResultId,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    user,
  ]);
}
