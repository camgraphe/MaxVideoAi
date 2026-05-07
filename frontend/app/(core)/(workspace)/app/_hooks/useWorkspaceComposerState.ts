import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import {
  framesToSeconds,
} from '../_lib/workspace-engine-helpers';
import {
  buildMultiPromptSummary,
  createMultiPromptScene,
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
} from '../_lib/workspace-input-helpers';
import {
  useWorkspaceEngineModeState,
  type WorkspaceComposerModeToggles,
  type WorkspaceComposerWorkflowCopy,
  type WorkspaceReferenceInputStatus,
} from './useWorkspaceEngineModeState';

type ShotType = 'customize' | 'intelligent';

type UseWorkspaceComposerStateOptions = {
  engines: EngineCaps[];
  form: FormState | null;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  prompt: string;
  multiPromptEnabled: boolean;
  setMultiPromptEnabled: Dispatch<SetStateAction<boolean>>;
  multiPromptScenes: MultiPromptScene[];
  setMultiPromptScenes: Dispatch<SetStateAction<MultiPromptScene[]>>;
  voiceIdsInput: string;
  shotType: ShotType;
  setShotType: Dispatch<SetStateAction<ShotType>>;
  effectiveRequestedEngineToken: string | null;
  authChecked: boolean;
  hydratedForScope: string | null;
  storageScope: string;
  hasStoredFormRef: MutableRefObject<boolean>;
  preserveStoredDraftRef: MutableRefObject<boolean>;
  requestedEngineOverrideIdRef: MutableRefObject<string | null>;
  requestedEngineOverrideTokenRef: MutableRefObject<string | null>;
  requestedModeOverrideRef: MutableRefObject<Mode | null>;
  writeStorage: (base: string, value: string | null) => void;
  uiLocale: string;
  workflowCopy: WorkspaceComposerWorkflowCopy;
  showNotice: (message: string) => void;
};

type UseWorkspaceComposerStateResult = {
  selectedEngine: EngineCaps | null;
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  isSeedance: boolean;
  isUnifiedSeedance: boolean;
  isUnifiedHappyHorse: boolean;
  multiPromptTotalSec: number;
  multiPromptActive: boolean;
  multiPromptInvalid: boolean;
  multiPromptError: string | null;
  voiceIds: string[];
  voiceControlEnabled: boolean;
  promptMaxChars: number | null;
  promptCharLimitExceeded: boolean;
  seedValue: string;
  cameraFixedValue: boolean;
  safetyCheckerValue: boolean;
  effectivePrompt: string;
  referenceInputStatus: WorkspaceReferenceInputStatus;
  hasLastFrameInput: boolean;
  audioWorkflowLocked: boolean;
  audioWorkflowUnsupported: boolean;
  activeManualMode: Mode | null;
  activeMode: Mode;
  allowsUnifiedVeoFirstLast: boolean;
  submissionMode: Mode;
  showSafetyCheckerControl: boolean;
  effectiveDurationSec: number;
  capability: EngineModeUiCaps | undefined;
  supportsAudioToggle: boolean;
  engineModeOptions: Mode[] | undefined;
  composerModeToggles: WorkspaceComposerModeToggles;
  showRetakeWorkflowAction: boolean;
  composerWorkflowNotice: string | null;
  handleMultiPromptAddScene: () => void;
  handleMultiPromptRemoveScene: (id: string) => void;
  handleMultiPromptUpdateScene: (
    id: string,
    patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>
  ) => void;
  handleSeedChange: (value: string) => void;
  handleCameraFixedChange: (value: boolean) => void;
  handleSafetyCheckerChange: (value: boolean) => void;
  handleEngineChange: (engineId: string) => void;
  handleModeChange: (mode: Mode) => void;
  handleComposerModeToggle: (mode: Mode | null) => void;
  handleDurationChange: (raw: number | string) => void;
  handleFramesChange: (value: number) => void;
  handleResolutionChange: (resolution: string) => void;
  handleAspectRatioChange: (ratio: string) => void;
  handleFpsChange: (fps: number) => void;
};

export function useWorkspaceComposerState({
  engines,
  form,
  setForm,
  inputAssets,
  prompt,
  multiPromptEnabled,
  setMultiPromptEnabled,
  multiPromptScenes,
  setMultiPromptScenes,
  voiceIdsInput,
  shotType,
  setShotType,
  effectiveRequestedEngineToken,
  authChecked,
  hydratedForScope,
  storageScope,
  hasStoredFormRef,
  preserveStoredDraftRef,
  requestedEngineOverrideIdRef,
  requestedEngineOverrideTokenRef,
  requestedModeOverrideRef,
  writeStorage,
  uiLocale,
  workflowCopy,
  showNotice,
}: UseWorkspaceComposerStateOptions): UseWorkspaceComposerStateResult {
  const {
    selectedEngine,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    isUnifiedHappyHorse,
    referenceInputStatus,
    primaryAudioDurationSec,
    primaryVideoDurationSec,
    hasLastFrameInput,
    audioWorkflowLocked,
    audioWorkflowUnsupported,
    activeManualMode,
    activeMode,
    allowsUnifiedVeoFirstLast,
    submissionMode,
    showSafetyCheckerControl,
    capability,
    supportsAudioToggle,
    engineModeOptions,
    composerModeToggles,
    showRetakeWorkflowAction,
    composerWorkflowNotice,
    handleEngineChange,
    handleModeChange,
    handleComposerModeToggle,
  } = useWorkspaceEngineModeState({
    engines,
    form,
    setForm,
    inputAssets,
    shotType,
    setShotType,
    effectiveRequestedEngineToken,
    authChecked,
    hydratedForScope,
    storageScope,
    hasStoredFormRef,
    preserveStoredDraftRef,
    requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef,
    requestedModeOverrideRef,
    writeStorage,
    uiLocale,
    workflowCopy,
    showNotice,
  });

  const multiPromptTotalSec = useMemo(
    () => multiPromptScenes.reduce((sum, scene) => sum + (scene.duration || 0), 0),
    [multiPromptScenes]
  );
  const multiPromptActive = Boolean(supportsKlingV3Controls && multiPromptEnabled);
  const multiPromptInvalid = multiPromptActive
    ? multiPromptScenes.length === 0 ||
      multiPromptScenes.some((scene) => !scene.prompt.trim()) ||
      multiPromptTotalSec < MULTI_PROMPT_MIN_SEC ||
      multiPromptTotalSec > MULTI_PROMPT_MAX_SEC
    : false;
  const multiPromptError = multiPromptInvalid
    ? `Multi-prompt requires a prompt per scene and total duration between ${MULTI_PROMPT_MIN_SEC}s and ${MULTI_PROMPT_MAX_SEC}s.`
    : null;

  const voiceIds = useMemo(
    () =>
      voiceIdsInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [voiceIdsInput]
  );
  const voiceControlEnabled = Boolean(supportsKlingV3VoiceControl && voiceIds.length);
  const promptMaxChars = !multiPromptActive ? (selectedEngine?.inputLimits.promptMaxChars ?? null) : null;
  const promptCharLimitExceeded = typeof promptMaxChars === 'number' && prompt.length > promptMaxChars;
  const seedValue =
    typeof form?.seed === 'number' && Number.isFinite(form.seed) ? String(form.seed) : '';
  const cameraFixedValue = typeof form?.cameraFixed === 'boolean' ? form.cameraFixed : false;
  const safetyCheckerValue = typeof form?.safetyChecker === 'boolean' ? form.safetyChecker : true;
  const effectivePrompt = multiPromptActive ? buildMultiPromptSummary(multiPromptScenes) : prompt;

  useEffect(() => {
    if (!supportsKlingV3Controls && multiPromptEnabled) {
      setMultiPromptEnabled(false);
    }
  }, [supportsKlingV3Controls, multiPromptEnabled, setMultiPromptEnabled]);

  const effectiveDurationSec = useMemo(() => {
    if (multiPromptActive) return multiPromptTotalSec;
    if (submissionMode === 'a2v' && typeof primaryAudioDurationSec === 'number') return primaryAudioDurationSec;
    if ((submissionMode === 'v2v' || submissionMode === 'reframe') && typeof primaryVideoDurationSec === 'number') {
      return primaryVideoDurationSec;
    }
    return form?.durationSec ?? 0;
  }, [multiPromptActive, multiPromptTotalSec, submissionMode, primaryAudioDurationSec, primaryVideoDurationSec, form?.durationSec]);

  useEffect(() => {
    if (!voiceControlEnabled) return;
    setForm((current) => {
      if (!current || current.audio) return current;
      return { ...current, audio: true };
    });
  }, [setForm, voiceControlEnabled]);

  const handleDurationChange = useCallback(
    (raw: number | string) => {
      if (multiPromptActive) return;
      setForm((current) => {
        if (!current) return current;
        const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
        const durationSec = Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : current.durationSec;
        return {
          ...current,
          durationSec,
          durationOption: raw,
          numFrames: null,
        };
      });
    },
    [multiPromptActive, setForm]
  );

  const handleFramesChange = useCallback(
    (value: number) => {
      setForm((current) => {
        if (!current) return current;
        const safeFrames = Math.max(1, Math.round(value));
        return {
          ...current,
          numFrames: safeFrames,
          durationSec: framesToSeconds(safeFrames),
          durationOption: safeFrames,
        };
      });
    },
    [setForm]
  );

  const handleResolutionChange = useCallback(
    (resolution: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed = capability?.resolution && capability.resolution.length ? capability.resolution : selectedEngine.resolutions;
        if (allowed.length && !allowed.includes(resolution)) {
          const fallback = allowed.includes(current.resolution) ? current.resolution : allowed[0];
          return fallback === current.resolution ? current : { ...current, resolution: fallback };
        }
        if (current.resolution === resolution) return current;
        return { ...current, resolution };
      });
    },
    [capability, selectedEngine, setForm]
  );

  const handleAspectRatioChange = useCallback(
    (ratio: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed =
          capability?.aspectRatio && capability.aspectRatio.length
            ? capability.aspectRatio
            : capability
              ? []
              : selectedEngine.aspectRatios;
        if (allowed.length && !allowed.includes(ratio)) {
          const fallback = allowed.includes(current.aspectRatio) ? current.aspectRatio : allowed[0];
          return fallback === current.aspectRatio ? current : { ...current, aspectRatio: fallback };
        }
        if (current.aspectRatio === ratio) return current;
        return { ...current, aspectRatio: ratio };
      });
    },
    [capability, selectedEngine, setForm]
  );

  const handleFpsChange = useCallback(
    (fps: number) => {
      setForm((current) => {
        if (!current) return current;
        if (current.fps === fps) return current;
        return { ...current, fps };
      });
    },
    [setForm]
  );

  const handleMultiPromptAddScene = useCallback(() => {
    setMultiPromptScenes((previous) => [...previous, createMultiPromptScene()]);
  }, [setMultiPromptScenes]);

  const handleMultiPromptRemoveScene = useCallback(
    (id: string) => {
      setMultiPromptScenes((previous) => {
        const next = previous.filter((scene) => scene.id !== id);
        return next.length ? next : [createMultiPromptScene()];
      });
    },
    [setMultiPromptScenes]
  );

  const handleMultiPromptUpdateScene = useCallback(
    (id: string, patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>) => {
      setMultiPromptScenes((previous) =>
        previous.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene))
      );
    },
    [setMultiPromptScenes]
  );

  const handleSeedChange = useCallback(
    (value: string) => {
      setForm((current) => {
        if (!current) return current;
        const trimmed = value.trim();
        if (!trimmed) {
          return { ...current, seed: null };
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) return current;
        return { ...current, seed: Math.trunc(parsed) };
      });
    },
    [setForm]
  );

  const handleCameraFixedChange = useCallback(
    (value: boolean) => {
      setForm((current) => (current ? { ...current, cameraFixed: value } : current));
    },
    [setForm]
  );

  const handleSafetyCheckerChange = useCallback(
    (value: boolean) => {
      setForm((current) => (current ? { ...current, safetyChecker: value } : current));
    },
    [setForm]
  );

  return {
    selectedEngine,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    isUnifiedHappyHorse,
    multiPromptTotalSec,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    voiceIds,
    voiceControlEnabled,
    promptMaxChars,
    promptCharLimitExceeded,
    seedValue,
    cameraFixedValue,
    safetyCheckerValue,
    effectivePrompt,
    referenceInputStatus,
    hasLastFrameInput,
    audioWorkflowLocked,
    audioWorkflowUnsupported,
    activeManualMode,
    activeMode,
    allowsUnifiedVeoFirstLast,
    submissionMode,
    showSafetyCheckerControl,
    effectiveDurationSec,
    capability,
    supportsAudioToggle,
    engineModeOptions,
    composerModeToggles,
    showRetakeWorkflowAction,
    composerWorkflowNotice,
    handleMultiPromptAddScene,
    handleMultiPromptRemoveScene,
    handleMultiPromptUpdateScene,
    handleSeedChange,
    handleCameraFixedChange,
    handleSafetyCheckerChange,
    handleEngineChange,
    handleModeChange,
    handleComposerModeToggle,
    handleDurationChange,
    handleFramesChange,
    handleResolutionChange,
    handleAspectRatioChange,
    handleFpsChange,
  };
}
