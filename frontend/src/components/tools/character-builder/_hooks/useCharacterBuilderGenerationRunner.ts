import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import { runCharacterBuilderTool } from '@/lib/api';
import type {
  CharacterBuilderAction,
  CharacterBuilderState,
} from '@/types/character-builder';
import type { JobsPage } from '@/types/jobs';
import {
  decrementLoadingRequestCount,
  emitClientMetric,
  getLoadingRequestKey,
  incrementLoadingRequestCount,
  isAuthRequiredError,
  normalizeHairAndOutfitModes,
} from '../_lib/character-builder-helpers';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type {
  LoadingRequestCounts,
  PendingCharacterRun,
} from '../_lib/character-builder-types';

interface UseCharacterBuilderGenerationRunnerOptions {
  copy: CharacterCopy;
  hasIdentityReference: boolean;
  mutateHistoricalJobs: SWRInfiniteKeyedMutator<JobsPage[]>;
  openAuthGate: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoadingActions: Dispatch<SetStateAction<LoadingRequestCounts>>;
  setPendingRuns: Dispatch<SetStateAction<PendingCharacterRun[]>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  state: CharacterBuilderState;
  user: unknown;
}

export function useCharacterBuilderGenerationRunner({
  copy,
  hasIdentityReference,
  mutateHistoricalJobs,
  openAuthGate,
  setError,
  setLoadingActions,
  setPendingRuns,
  setState,
  setStatusMessage,
  state,
  user,
}: UseCharacterBuilderGenerationRunnerOptions) {
  return useCallback(
    async (action: CharacterBuilderAction, generateCount?: 1 | 4) => {
      if (!user) {
        openAuthGate();
        return;
      }
      setError(null);
      setStatusMessage(null);
      const loadingKey = getLoadingRequestKey(action, generateCount);
      const clientJobId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `img_${crypto.randomUUID()}`
          : `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const requestTraits = normalizeHairAndOutfitModes(state.traits);
      const pendingCreatedAt = new Date().toISOString();
      const pendingRun: PendingCharacterRun = {
        id: clientJobId,
        jobId: clientJobId,
        createdAt: pendingCreatedAt,
        action,
        outputMode: state.outputMode,
        qualityMode: state.qualityMode,
        formatMode: state.formatMode,
        generateCount: generateCount ?? 1,
      };

      setLoadingActions((previous) => incrementLoadingRequestCount(previous, loadingKey));
      setPendingRuns((previous) => [pendingRun, ...previous].slice(0, 12));

      emitClientMetric('tool_start', {
        tool_name: 'character_builder',
        tool_surface: 'workspace',
        logged_in: true,
        action: action.replace(/-/g, '_'),
        source_mode: state.sourceMode,
        output_mode: state.outputMode.replace(/-/g, '_'),
        quality_mode: state.qualityMode,
        format_mode: state.formatMode.replace(/-/g, '_'),
        generate_count: generateCount ?? 1,
      });

      try {
        const response = await runCharacterBuilderTool({
          jobId: clientJobId,
          action,
          sourceMode: state.sourceMode,
          outputMode: state.outputMode,
          consistencyMode: state.consistencyMode,
          referenceStrength: hasIdentityReference ? state.referenceStrength : null,
          qualityMode: state.qualityMode,
          formatMode: state.formatMode,
          referenceImages: state.referenceImages,
          traits: requestTraits,
          outputOptions: state.outputOptions,
          advancedNotes: state.advancedNotes,
          mustRemainVisible: state.mustRemainVisible,
          generateCount: generateCount ?? 1,
          selectedResultId: null,
          selectedResultUrl: null,
          pinnedReferenceResultId: null,
          pinnedReferenceResultUrl: null,
          lineage: {
            parentResultId: null,
            parentRunId: null,
            pinnedReferenceResultId: null,
          },
        });

        if (!response.run) {
          throw new Error(copy.missingRun);
        }

        setPendingRuns((previous) => previous.filter((entry) => entry.id !== clientJobId));
        setState((previous) => {
          const nextRuns = [response.run!, ...previous.runs].slice(0, 12);
          const firstResultId = response.run!.results[0]?.id ?? null;

          return {
            ...previous,
            runs: nextRuns,
            selectedResultId: firstResultId,
            pinnedReferenceResultId: null,
            refinementHistory: previous.refinementHistory,
          };
        });

        setStatusMessage(
          action === 'generate'
            ? generateCount === 4
              ? copy.runGenerateFourDone
              : copy.runGenerateOneDone
            : action === 'full-body-fix'
              ? copy.runFullBodyDone
              : copy.runLightingDone
        );
        emitClientMetric('tool_complete', {
          tool_name: 'character_builder',
          tool_surface: 'workspace',
          logged_in: true,
          action: action.replace(/-/g, '_'),
          source_mode: state.sourceMode,
          output_mode: state.outputMode.replace(/-/g, '_'),
          quality_mode: state.qualityMode,
          format_mode: state.formatMode.replace(/-/g, '_'),
          generate_count: generateCount ?? 1,
          result_count: response.run.results.length,
        });
        void mutateHistoricalJobs(undefined, { revalidate: true });
      } catch (runError) {
        setPendingRuns((previous) => previous.filter((entry) => entry.id !== clientJobId));
        if (isAuthRequiredError(runError)) {
          openAuthGate();
          return;
        }
        setError(runError instanceof Error ? runError.message : copy.runFailed);
      } finally {
        setLoadingActions((previous) => decrementLoadingRequestCount(previous, loadingKey));
      }
    },
    [
      copy.missingRun,
      copy.runFailed,
      copy.runFullBodyDone,
      copy.runGenerateFourDone,
      copy.runGenerateOneDone,
      copy.runLightingDone,
      hasIdentityReference,
      mutateHistoricalJobs,
      openAuthGate,
      setError,
      setLoadingActions,
      setPendingRuns,
      setState,
      setStatusMessage,
      state,
      user,
    ]
  );
}
