import type { MultiPromptScene } from '@/components/Composer';
import { buildMultiPromptSummary, MULTI_PROMPT_MIN_SEC, MULTI_PROMPT_MAX_SEC } from './workspace-input-helpers';
import { getWorkspaceMultiPromptState } from './workspace-multi-prompt-state';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import {
  getSeedanceAssetState,
  getUnifiedSeedanceMode,
  isUnifiedSeedanceEngineId,
} from '@/lib/seedance-workflow';
import {
  getUnifiedHappyHorseMode,
  isHappyHorseEngineId,
  supportsHappyHorseVideoEdit,
} from '@/lib/happy-horse-workflow';
import type { EngineCaps, Mode } from '@/types/engines';
import { resolveActiveVideoInputField, VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';
import {
  getKlingO3UnsupportedVideoReason,
  isKlingO3EngineId,
  resolveKlingO3UnifiedMode,
} from './kling-o3-unified-workflow';
import {
  isGeminiOmniEngineId,
  resolveGeminiOmniUnifiedMode,
} from './gemini-omni-unified-workflow';
import {
  isUnifiedMinimaxH3EngineId,
  resolveMinimaxH3UnifiedMode,
} from './minimax-h3-unified-workflow';
import {
  getReferenceInputStatus,
  hasInputAssetInSlots,
  PRIMARY_IMAGE_SLOT_IDS,
  PRIMARY_VIDEO_SLOT_IDS,
  type ReferenceAsset,
} from './workspace-assets';
import type { FormState } from './workspace-form-state';
import {
  getEngineModeOptions,
  getModeCaps,
  isWorkspaceModeAvailable,
  supportsModeAudioControl,
} from './workspace-engine-helpers';

/** Pure live/candidate workflow facts. Null inputs retain the live hydration fallback. */
export function resolveWorkspaceWorkflow({ engine: selectedEngine, form, inputAssets, klingElements }: {
  engine: EngineCaps | null;
  form: FormState | null;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}) {
  const supportsKlingV3Controls = selectedEngine?.id === 'kling-3-pro' ||
    selectedEngine?.id === 'kling-3-standard' ||
    selectedEngine?.id === 'kling-3-4k' ||
    Boolean(selectedEngine?.id.startsWith('kling-o3-'));

  const supportsKlingV3VoiceControl = false;

  const isSeedance = selectedEngine?.id === 'seedance-1-5-pro';

  const isUnifiedSeedance = isUnifiedSeedanceEngineId(selectedEngine?.id);

  const isUnifiedHappyHorse = isHappyHorseEngineId(selectedEngine?.id);

  const isUnifiedKlingO3 = isKlingO3EngineId(selectedEngine?.id);

  const isUnifiedGeminiOmni = isGeminiOmniEngineId(selectedEngine?.id);

  const isUnifiedMinimaxH3 = isUnifiedMinimaxH3EngineId(selectedEngine?.id);

  const klingO3UnsupportedVideoReason = getKlingO3UnsupportedVideoReason({ engine: selectedEngine, inputAssets, klingElements });

  const primaryAudioDurationSec = (() => {
    for (const entries of Object.values(inputAssets)) {
      for (const asset of entries) {
        if (asset?.kind === 'audio' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  })();

  const primaryVideoDurationSec = (() => {
    for (const fieldId of PRIMARY_VIDEO_SLOT_IDS) {
      const entries = inputAssets[fieldId] ?? [];
      for (const asset of entries) {
        if (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.ceil(asset.durationSec));
        }
      }
    }
    return null;
  })();

  const workspaceExecutableModes = selectedEngine ? [...selectedEngine.modes] : [];

  const engineModeOptions = getEngineModeOptions(selectedEngine
    ? { ...selectedEngine, modes: workspaceExecutableModes }
    : null);

  const referenceInputStatus = getReferenceInputStatus(inputAssets);

  const seedanceAssetState = getSeedanceAssetState(inputAssets);

  const hasPrimaryImageInput = hasInputAssetInSlots(inputAssets, [...PRIMARY_IMAGE_SLOT_IDS, 'start_image_url'], 'image');

  const hasLastFrameInput = hasInputAssetInSlots(inputAssets, ['last_frame_url', 'end_image_url'], 'image');

  const implicitMode = (() => {
    if (!selectedEngine) return form?.mode ?? 't2v';
    if (isUnifiedMinimaxH3) {
      return resolveMinimaxH3UnifiedMode(inputAssets);
    }
    if (isUnifiedSeedance) {
      return getUnifiedSeedanceMode(inputAssets);
    }
    if (isUnifiedKlingO3) {
      return resolveKlingO3UnifiedMode({
        engine: selectedEngine,
        inputAssets,
        klingElements,
      });
    }
    if (isUnifiedGeminiOmni) {
      return resolveGeminiOmniUnifiedMode({
        engine: selectedEngine,
        inputAssets,
        previousInteractionId: form?.extraInputValues.previous_interaction_id,
      });
    }
    if (isUnifiedHappyHorse && (form?.mode === 't2v' || !form?.mode)) {
      return getUnifiedHappyHorseMode(inputAssets, {
        supportsVideoEdit: supportsHappyHorseVideoEdit(selectedEngine.id),
      });
    }
    const modes = workspaceExecutableModes;
    if (referenceInputStatus.hasAudio && modes.includes('a2v')) return 'a2v';
    if (referenceInputStatus.hasVideo && modes.includes('v2v')) return 'v2v';
    if (referenceInputStatus.hasVideo && modes.includes('r2v')) return 'r2v';
    if (referenceInputStatus.hasVideo && modes.includes('reframe')) return 'reframe';
    if (referenceInputStatus.hasImage && modes.includes('i2v')) return 'i2v';
    if (modes.includes('t2v')) return 't2v';
    return modes[0] ?? 't2v';
  })();

  const audioToVideoSupported = Boolean(selectedEngine?.modes.includes('a2v'));

  const audioWorkflowLocked = referenceInputStatus.hasAudio && audioToVideoSupported;

  const audioWorkflowUnsupported = referenceInputStatus.hasAudio &&
    Boolean(selectedEngine) &&
    !audioToVideoSupported &&
    !(isUnifiedSeedance && seedanceAssetState.hasReferenceAudio) &&
    !isUnifiedMinimaxH3;

  const activeManualMode = (() => {
    if (!selectedEngine) return null;
    const currentMode = form?.mode ?? null;
    if (isUnifiedSeedance) {
      return currentMode === 'extend' && isWorkspaceModeAvailable(selectedEngine, currentMode) ? currentMode : null;
    }
    if (isUnifiedKlingO3) return null;
    if (isUnifiedGeminiOmni) return null;
    if (isUnifiedMinimaxH3) return null;
    if (referenceInputStatus.hasAudio) return null;
    if ((currentMode === 'v2v' ||
      currentMode === 'reframe' ||
      currentMode === 'ref2v' ||
      currentMode === 'fl2v' ||
      currentMode === 'extend' ||
      currentMode === 'retake') &&
      isWorkspaceModeAvailable(selectedEngine, currentMode)
      && workspaceExecutableModes.includes(currentMode)) {
      return currentMode;
    }
    return null;
  })();

  const activeMode: Mode = activeManualMode ?? implicitMode;

  const unifiedFirstFrameField = resolveActiveVideoInputField({
    inputSchema: selectedEngine?.inputSchema,
    mode: 'fl2v',
    type: 'image',
    candidateFieldIds: VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame,
  });

  const hasUnifiedFirstFrameInput = Boolean(unifiedFirstFrameField
    && hasInputAssetInSlots(inputAssets, [unifiedFirstFrameField.id], 'image'));

  const allowsUnifiedVeoFirstLast = (() => {
    return Boolean(selectedEngine &&
      selectedEngine.modes.includes('fl2v') &&
      activeManualMode === null &&
      (activeMode === 't2v'
        || (activeMode === 'i2v'
          && (unifiedFirstFrameField?.id === 'first_frame_url'
            || hasUnifiedFirstFrameInput
            || hasLastFrameInput))));
  })();

  const submissionMode = (() => {
    if (allowsUnifiedVeoFirstLast && hasPrimaryImageInput && hasLastFrameInput) {
      return 'fl2v';
    }
    return activeMode;
  })();

  const showSafetyCheckerControl = (() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) return false;
    return [...(schema.required ?? []), ...(schema.optional ?? [])].some((field) => {
      if (field.id !== 'enable_safety_checker') return false;
      return !field.modes || field.modes.includes(submissionMode);
    });
  })();

  const capability = (() => {
    if (!selectedEngine) return undefined;
    return getModeCaps(selectedEngine, submissionMode);
  })();

  const supportsAudioToggle = Boolean(selectedEngine && supportsModeAudioControl(selectedEngine, submissionMode, capability));
  return {
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    isUnifiedHappyHorse,
    isUnifiedKlingO3,
    isUnifiedGeminiOmni,
    isUnifiedMinimaxH3,
    klingO3UnsupportedVideoReason,
    primaryAudioDurationSec,
    primaryVideoDurationSec,
    workspaceExecutableModes,
    engineModeOptions,
    referenceInputStatus,
    hasLastFrameInput,
    implicitMode,
    audioWorkflowLocked,
    audioWorkflowUnsupported,
    activeManualMode,
    activeMode,
    allowsUnifiedVeoFirstLast,
    submissionMode,
    showSafetyCheckerControl,
    capability,
    supportsAudioToggle
  };
}

export type WorkspaceWorkflowProjection = ReturnType<typeof resolveWorkspaceWorkflow>;

/** Composer facts shared with candidate quoting; effects remain in the live hook. */
export function resolveWorkspaceComposerFacts({
  engine: selectedEngine, form, workflow, prompt, multiPromptEnabled, multiPromptScenes, voiceIdsInput,
}: {
  engine: EngineCaps | null;
  form: FormState | null;
  workflow: Pick<WorkspaceWorkflowProjection, 'supportsKlingV3Controls' | 'supportsKlingV3VoiceControl' | 'submissionMode' | 'primaryAudioDurationSec' | 'primaryVideoDurationSec'>;
  prompt: string;
  multiPromptEnabled: boolean;
  multiPromptScenes: MultiPromptScene[];
  voiceIdsInput: string;
}) {
  const { supportsKlingV3Controls, supportsKlingV3VoiceControl, submissionMode, primaryAudioDurationSec, primaryVideoDurationSec } = workflow;
  const multiPromptActive = Boolean(supportsKlingV3Controls && multiPromptEnabled);
  const multiPromptState = getWorkspaceMultiPromptState({
    active: multiPromptActive,
    scenes: multiPromptScenes,
    minDurationSec: MULTI_PROMPT_MIN_SEC,
    maxDurationSec: MULTI_PROMPT_MAX_SEC,
  });
  const multiPromptTotalSec = multiPromptState.totalDurationSec;
  const multiPromptInvalid = multiPromptState.invalid;
  const multiPromptError = multiPromptState.error;
  const voiceIds = voiceIdsInput
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const voiceControlEnabled = Boolean(supportsKlingV3VoiceControl && voiceIds.length);
  const promptMaxChars = !multiPromptActive ? (selectedEngine?.inputLimits.promptMaxChars ?? null) : null;
  const promptCharLimitExceeded = typeof promptMaxChars === 'number' && prompt.length > promptMaxChars;
  const effectivePrompt = multiPromptActive ? buildMultiPromptSummary(multiPromptScenes) : prompt;
  const effectiveDurationSec = (() => {
    if (multiPromptActive) return multiPromptTotalSec;
    if (submissionMode === 'a2v' && typeof primaryAudioDurationSec === 'number') return primaryAudioDurationSec;
    if ((submissionMode === 'v2v' || submissionMode === 'reframe') && typeof primaryVideoDurationSec === 'number') {
      return primaryVideoDurationSec;
    }
    return form?.durationSec ?? 0;
  })();
  return { multiPromptActive, multiPromptTotalSec, multiPromptInvalid, multiPromptError, voiceIds, voiceControlEnabled, promptMaxChars, promptCharLimitExceeded, effectivePrompt, effectiveDurationSec };
}

export type WorkspaceComposerFacts = ReturnType<typeof resolveWorkspaceComposerFacts>;
