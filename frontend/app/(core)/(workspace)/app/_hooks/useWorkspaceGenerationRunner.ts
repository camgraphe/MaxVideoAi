import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type {
  EngineCaps,
  EngineModeUiCaps,
  Mode,
  PreflightResponse,
} from '@/types/engines';
import type { JobsPage } from '@/types/jobs';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import {
  type LocalRender,
} from '../_lib/render-persistence';
import {
  emitClientMetric,
} from '../_lib/workspace-client-helpers';
import type { FormState } from '../_lib/workspace-form-state';
import {
  prepareGenerationInputs,
} from '../_lib/workspace-generation-inputs';
import {
  getLumaRay2GenerationContext,
  getStartRenderValidationMessage,
  supportsNegativePromptInput,
} from '../_lib/workspace-generation-guards';
import type {
  WorkspaceInputFieldEntry,
  WorkspaceInputSchemaSummary,
} from '../_lib/workspace-input-schema';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import { useWorkspaceWalletPreflight } from './useWorkspaceWalletPreflight';
import { runWorkspaceGenerationIteration } from './workspace-generation-iteration-runner';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';

type TopUpModalState = {
  message: string;
  amountLabel?: string;
  shortfallCents?: number;
} | null;

type WorkspaceWalletCopy = {
  wallet: {
    insufficient: string;
    insufficientWithAmount: string;
  };
};

type WorkflowCopy = {
  audioUnsupported: string;
  addReferenceMediaBeforeAudio: string;
  addSourceVideo: (modeLabel: string) => string;
};

type MutateLatestJobs = SWRInfiniteKeyedMutator<JobsPage[]>;

type UseWorkspaceGenerationRunnerOptions = {
  audioWorkflowUnsupported: boolean;
  form: FormState | null;
  activeMode: Mode;
  submissionMode: Mode;
  effectivePrompt: string;
  effectiveDurationSec: number;
  negativePrompt: string;
  selectedEngine: EngineCaps | null;
  preflight: PreflightResponse | null;
  memberTier: MemberTier;
  showComposerError: (message: string) => void;
  writeScopedStorage: (base: string, value: string | null) => void;
  mutateLatestJobs: MutateLatestJobs;
  inputSchemaSummary: WorkspaceInputSchemaSummary;
  extraInputFields: WorkspaceInputFieldEntry[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setPreflightError: Dispatch<SetStateAction<string | undefined>>;
  setTopUpModal: Dispatch<SetStateAction<TopUpModalState>>;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setActiveBatchId: Dispatch<SetStateAction<string | null>>;
  setBatchHeroes: Dispatch<SetStateAction<Record<string, string>>>;
  setRenders: Dispatch<SetStateAction<LocalRender[]>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
  rendersRef: MutableRefObject<LocalRender[]>;
  uiLocale: string;
  workflowCopy: WorkflowCopy;
  workspaceCopy: WorkspaceWalletCopy;
  capability: EngineModeUiCaps | undefined;
  cfgScale: number | null;
  formatTakeLabel: (current: number, total: number) => string;
  primaryAssetFieldLabel: string;
  primaryAssetFieldIds: Set<string>;
  referenceAssetFieldIds: Set<string>;
  referenceAudioFieldIds: Set<string>;
  genericImageFieldIds: Set<string>;
  frameAssetFieldIds: Set<string>;
  allowsUnifiedVeoFirstLast: boolean;
  hasLastFrameInput: boolean;
  supportsAudioToggle: boolean;
  multiPromptActive: boolean;
  multiPromptInvalid: boolean;
  multiPromptError: string | null;
  multiPromptScenes: MultiPromptScene[];
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  isSeedance: boolean;
  isUnifiedSeedance: boolean;
  promptLength: number;
  promptCharLimitExceeded: boolean;
  promptMaxChars: number | null;
  voiceIds: string[];
  voiceControlEnabled: boolean;
  shotType: ShotType;
  klingElements: KlingElementState[];
};

export function useWorkspaceGenerationRunner({
  audioWorkflowUnsupported,
  form,
  activeMode,
  submissionMode,
  effectivePrompt,
  effectiveDurationSec,
  negativePrompt,
  selectedEngine,
  preflight,
  memberTier,
  showComposerError,
  writeScopedStorage,
  mutateLatestJobs,
  inputSchemaSummary,
  extraInputFields,
  inputAssets,
  setAuthModalOpen,
  setPreflightError,
  setTopUpModal,
  setActiveGroupId,
  setActiveBatchId,
  setBatchHeroes,
  setRenders,
  setSelectedPreview,
  setViewMode,
  rendersRef,
  uiLocale,
  workflowCopy,
  workspaceCopy,
  capability,
  cfgScale,
  formatTakeLabel,
  primaryAssetFieldLabel,
  primaryAssetFieldIds,
  referenceAssetFieldIds,
  referenceAudioFieldIds,
  genericImageFieldIds,
  frameAssetFieldIds,
  allowsUnifiedVeoFirstLast,
  hasLastFrameInput,
  supportsAudioToggle,
  multiPromptActive,
  multiPromptInvalid,
  multiPromptError,
  multiPromptScenes,
  supportsKlingV3Controls,
  supportsKlingV3VoiceControl,
  isSeedance,
  isUnifiedSeedance,
  promptLength,
  promptCharLimitExceeded,
  promptMaxChars,
  voiceIds,
  voiceControlEnabled,
  shotType,
  klingElements,
}: UseWorkspaceGenerationRunnerOptions) {
  const { presentInsufficientFunds, verifyWalletBalance } = useWorkspaceWalletPreflight({
    workspaceCopy,
    setTopUpModal,
    showComposerError,
  });

  const startRender = useCallback(async () => {
    if (!form || !selectedEngine) return;
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    setPreflightError(undefined);
    const trimmedPrompt = effectivePrompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = supportsNegativePromptInput(inputSchemaSummary);
    const lumaContext = getLumaRay2GenerationContext({
      selectedEngineId: selectedEngine.id,
      submissionMode,
      form,
    });
    const validationMessage = getStartRenderValidationMessage({
      audioWorkflowUnsupported,
      audioUnsupportedMessage: workflowCopy.audioUnsupported,
      multiPromptActive,
      multiPromptInvalid,
      multiPromptError,
      promptLength,
      promptCharLimitExceeded,
      promptMaxChars,
      selectedEngineLabel: selectedEngine.label,
      trimmedPrompt,
      trimmedNegativePrompt,
      inputSchemaSummary,
      inputAssets,
      extraInputFields,
      form,
      lumaContext,
    });
    if (validationMessage) {
      showComposerError(validationMessage);
      return;
    }

    const iterationCount = Math.max(1, form.iterations ?? 1);
    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (iterationCount > 1) {
      const totalCents =
        typeof preflight?.pricing?.totalCents === 'number' ? preflight.pricing.totalCents * iterationCount : undefined;
      emitClientMetric('group_render_initiated', {
        batchId,
        iterations: iterationCount,
        engine: selectedEngine.id,
        total_cents: totalCents ?? null,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      });
    }

    const paymentMode: 'wallet' | 'platform' = token ? 'wallet' : 'platform';
    const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

    if (paymentMode === 'wallet') {
      const hasWalletBalance = await verifyWalletBalance({ preflight, iterationCount, currencyCode });
      if (!hasWalletBalance) return;
    }

    const generationInputs = prepareGenerationInputs({
      selectedEngineId: selectedEngine.id,
      activeMode,
      submissionMode,
      form,
      inputSchema: selectedEngine.inputSchema,
      inputSchemaSummary,
      extraInputFields,
      inputAssets,
      primaryAssetFieldIds,
      referenceAssetFieldIds,
      genericImageFieldIds,
      frameAssetFieldIds,
      referenceAudioFieldIds,
      supportsKlingV3Controls,
      klingElements,
      multiPromptActive,
      multiPromptScenes,
    });
    if (!generationInputs.ok) {
      showComposerError(generationInputs.message);
      return;
    }

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runWorkspaceGenerationIteration({
        activeMode,
        allowsUnifiedVeoFirstLast,
        batchId,
        capability,
        cfgScale,
        currencyCode,
        effectiveDurationSec,
        effectivePrompt,
        form,
        formatTakeLabel,
        generationInputs,
        hasLastFrameInput,
        isSeedance,
        isUnifiedSeedance,
        iterationCount,
        iterationIndex,
        lumaContext,
        memberTier,
        mutateLatestJobs,
        paymentMode,
        preflight,
        presentInsufficientFunds,
        primaryAssetFieldLabel,
        rendersRef,
        selectedEngine,
        setActiveBatchId,
        setActiveGroupId,
        setBatchHeroes,
        setRenders,
        setSelectedPreview,
        setViewMode,
        shotType,
        showComposerError,
        submissionMode,
        supportsAudioToggle,
        supportsKlingV3Controls,
        supportsKlingV3VoiceControl,
        supportsNegativePrompt,
        token,
        trimmedNegativePrompt,
        trimmedPrompt,
        uiLocale,
        voiceControlEnabled,
        voiceIds,
        workflowCopy,
        writeScopedStorage,
      });
    }
  }, [
    audioWorkflowUnsupported,
    form,
    activeMode,
    submissionMode,
    effectivePrompt,
    effectiveDurationSec,
    negativePrompt,
    selectedEngine,
    preflight,
    memberTier,
    showComposerError,
    writeScopedStorage,
    mutateLatestJobs,
    inputSchemaSummary,
    extraInputFields,
    inputAssets,
    setAuthModalOpen,
    setPreflightError,
    setActiveGroupId,
    setActiveBatchId,
    setBatchHeroes,
    setRenders,
    setSelectedPreview,
    setViewMode,
    rendersRef,
    uiLocale,
    workflowCopy,
    capability,
    cfgScale,
    formatTakeLabel,
    primaryAssetFieldLabel,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    referenceAudioFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    allowsUnifiedVeoFirstLast,
    hasLastFrameInput,
    supportsAudioToggle,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    multiPromptScenes,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    promptLength,
    promptCharLimitExceeded,
    promptMaxChars,
    presentInsufficientFunds,
    voiceIds,
    voiceControlEnabled,
    verifyWalletBalance,
    shotType,
    klingElements,
  ]);

  return {
    startRender,
  };
}
