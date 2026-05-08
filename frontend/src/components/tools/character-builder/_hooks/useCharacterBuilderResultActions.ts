import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { normalizeCharacterFormatMode } from '@/lib/character-builder';
import type {
  CharacterBuilderResult,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderState,
} from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import {
  isAuthRequiredError,
  parseCharacterBuilderSnapshot,
} from '../_lib/character-builder-helpers';
import type { HistoricalCharacterGalleryItem } from '../_lib/character-builder-types';

interface UseCharacterBuilderResultActionsOptions {
  copy: CharacterCopy;
  openAuthGate: () => void;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  user: unknown;
}

export function useCharacterBuilderResultActions({
  copy,
  openAuthGate,
  setAdvancedOpen,
  setError,
  setShowStyleReferenceSlot,
  setState,
  setStatusMessage,
  user,
}: UseCharacterBuilderResultActionsOptions) {
  const [savingResultId, setSavingResultId] = useState<string | null>(null);

  const applySettingsSnapshot = useCallback(
    (snapshot: CharacterBuilderSettingsSnapshot, selectedId?: string) => {
      setState((previous) => ({
        ...previous,
        sourceMode: snapshot.builder.sourceMode,
        referenceImages: snapshot.builder.referenceImages,
        traits: snapshot.builder.traits,
        outputMode: snapshot.builder.outputMode,
        consistencyMode: snapshot.builder.consistencyMode,
        referenceStrength: snapshot.builder.referenceStrength,
        qualityMode: snapshot.builder.qualityMode,
        formatMode: normalizeCharacterFormatMode(snapshot.builder.formatMode, snapshot.builder.qualityMode),
        outputOptions: snapshot.builder.outputOptions,
        advancedNotes: snapshot.builder.advancedNotes,
        mustRemainVisible: snapshot.builder.mustRemainVisible,
        selectedResultId: selectedId ?? previous.selectedResultId,
      }));
      setAdvancedOpen(Boolean(snapshot.builder.advancedNotes));
      setStatusMessage(copy.duplicateDone);
    },
    [copy.duplicateDone, setAdvancedOpen, setState, setStatusMessage]
  );

  const handleSaveResult = useCallback(
    async (result: CharacterBuilderResult) => {
      if (!user) {
        openAuthGate();
        return;
      }
      setSavingResultId(result.id);
      setError(null);
      setStatusMessage(null);
      try {
        await saveImageToLibrary({
          url: result.url,
          jobId: result.jobId,
          label: copy.generatePanel.portraitTitle,
          source: 'character',
        });
        setStatusMessage(copy.savedToLibrary);
      } catch (saveError) {
        if (isAuthRequiredError(saveError)) {
          openAuthGate();
          return;
        }
        setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
      } finally {
        setSavingResultId(null);
      }
    },
    [
      copy.generatePanel.portraitTitle,
      copy.savedToLibrary,
      copy.saveToLibraryFailed,
      openAuthGate,
      setError,
      setStatusMessage,
      user,
    ]
  );

  const handleSaveHistoricalResult = useCallback(
    async (item: HistoricalCharacterGalleryItem) => {
      if (!user) {
        openAuthGate();
        return;
      }
      setSavingResultId(item.id);
      setError(null);
      setStatusMessage(null);
      try {
        await saveImageToLibrary({
          url: item.imageUrl,
          jobId: item.jobId,
          label: copy.generatePanel.portraitTitle,
          source: 'character',
        });
        setStatusMessage(copy.savedToLibrary);
      } catch (saveError) {
        if (isAuthRequiredError(saveError)) {
          openAuthGate();
          return;
        }
        setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
      } finally {
        setSavingResultId(null);
      }
    },
    [
      copy.generatePanel.portraitTitle,
      copy.savedToLibrary,
      copy.saveToLibraryFailed,
      openAuthGate,
      setError,
      setStatusMessage,
      user,
    ]
  );

  const handleDuplicateHistoricalSettings = useCallback(
    async (item: HistoricalCharacterGalleryItem) => {
      if (!user) {
        openAuthGate();
        return;
      }
      setError(null);
      setStatusMessage(null);
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(item.jobId)}`);
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; settingsSnapshot?: unknown; error?: string }
          | null;
        if (!response.ok || !payload?.ok || !payload.settingsSnapshot) {
          throw new Error(payload?.error ?? copy.runFailed);
        }
        const snapshotState = parseCharacterBuilderSnapshot(payload.settingsSnapshot);
        if (!snapshotState) {
          throw new Error(copy.missingRun);
        }
        setState((previous) => ({
          ...previous,
          ...snapshotState,
          selectedResultId: item.id,
        }));
        setAdvancedOpen(Boolean(snapshotState.advancedNotes));
        setShowStyleReferenceSlot(Boolean(snapshotState.referenceImages?.some((image) => image.role === 'style')));
        setStatusMessage(copy.duplicateDone);
      } catch (duplicateError) {
        if (isAuthRequiredError(duplicateError)) {
          openAuthGate();
          return;
        }
        setError(duplicateError instanceof Error ? duplicateError.message : copy.runFailed);
      }
    },
    [
      copy.duplicateDone,
      copy.missingRun,
      copy.runFailed,
      openAuthGate,
      setAdvancedOpen,
      setError,
      setShowStyleReferenceSlot,
      setState,
      setStatusMessage,
      user,
    ]
  );

  return {
    applySettingsSnapshot,
    handleDuplicateHistoricalSettings,
    handleSaveHistoricalResult,
    handleSaveResult,
    savingResultId,
    setSavingResultId,
  };
}
