import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import { supportsAudioPricingToggle } from '@/lib/pricing-addons';
import {
  getSeedanceAssetState,
  getUnifiedSeedanceMode,
  isUnifiedSeedanceEngineId,
} from '@/lib/seedance-workflow';
import {
  getUnifiedHappyHorseMode,
  isHappyHorseEngineId,
} from '@/lib/happy-horse-workflow';
import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';
import {
  getReferenceInputStatus,
  hasInputAssetInSlots,
  PRIMARY_IMAGE_SLOT_IDS,
  PRIMARY_VIDEO_SLOT_IDS,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import {
  buildComposerModeToggles,
  coerceFormState,
  findGenerateAudioField,
  framesToSeconds,
  getComposerWorkflowNotice,
  getEngineModeOptions,
  getModeCaps,
  getPreferredEngineMode,
  matchesEngineToken,
} from '../_lib/workspace-engine-helpers';
import {
  buildMultiPromptSummary,
  createMultiPromptScene,
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
} from '../_lib/workspace-input-helpers';
import {
  STORAGE_KEYS,
} from '../_lib/workspace-storage';
import {
  UNIFIED_VEO_FIRST_LAST_ENGINE_IDS,
} from '../_lib/workspace-client-helpers';

type ShotType = 'customize' | 'intelligent';
type ReferenceInputStatus = ReturnType<typeof getReferenceInputStatus>;
type WorkspaceComposerWorkflowCopy = Parameters<typeof buildComposerModeToggles>[0]['workflowCopy'] & {
  removeAudioToUseEdit: string;
};

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
  referenceInputStatus: ReferenceInputStatus;
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
  composerModeToggles: ReturnType<typeof buildComposerModeToggles>;
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

function hasFormStateChanged(previous: FormState, next: FormState): boolean {
  return (
    previous.engineId !== next.engineId ||
    previous.mode !== next.mode ||
    previous.durationSec !== next.durationSec ||
    previous.durationOption !== next.durationOption ||
    previous.numFrames !== next.numFrames ||
    previous.resolution !== next.resolution ||
    previous.aspectRatio !== next.aspectRatio ||
    previous.fps !== next.fps ||
    previous.iterations !== next.iterations ||
    previous.seedLocked !== next.seedLocked ||
    previous.loop !== next.loop ||
    previous.audio !== next.audio ||
    previous.seed !== next.seed ||
    previous.cameraFixed !== next.cameraFixed ||
    previous.safetyChecker !== next.safetyChecker
  );
}

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
  const engineOverride = useMemo<EngineCaps | null>(() => {
    if (!effectiveRequestedEngineToken) return null;
    if (!engines.length) return null;
    if (hasStoredFormRef.current) return null;
    return (
      engines.find((engine) => matchesEngineToken(engine, effectiveRequestedEngineToken)) ?? null
    );
  }, [engines, effectiveRequestedEngineToken, hasStoredFormRef]);

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    if (!engines.length) return null;
    if (engineOverride) return engineOverride;
    if (form && engines.some((engine) => engine.id === form.engineId)) {
      return engines.find((engine) => engine.id === form.engineId) ?? engines[0];
    }
    return engines[0];
  }, [engines, form, engineOverride]);

  const supportsKlingV3Controls =
    selectedEngine?.id === 'kling-3-pro' ||
    selectedEngine?.id === 'kling-3-standard' ||
    selectedEngine?.id === 'kling-3-4k';
  const supportsKlingV3VoiceControl =
    selectedEngine?.id === 'kling-3-pro' || selectedEngine?.id === 'kling-3-standard';
  const isSeedance = selectedEngine?.id === 'seedance-1-5-pro';
  const isUnifiedSeedance = isUnifiedSeedanceEngineId(selectedEngine?.id);
  const isUnifiedHappyHorse = isHappyHorseEngineId(selectedEngine?.id);

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

  const primaryAudioDurationSec = useMemo(() => {
    for (const entries of Object.values(inputAssets)) {
      for (const asset of entries) {
        if (asset?.kind === 'audio' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);
  const primaryVideoDurationSec = useMemo(() => {
    for (const fieldId of PRIMARY_VIDEO_SLOT_IDS) {
      const entries = inputAssets[fieldId] ?? [];
      for (const asset of entries) {
        if (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);

  useEffect(() => {
    if (!supportsKlingV3Controls && multiPromptEnabled) {
      setMultiPromptEnabled(false);
    }
  }, [supportsKlingV3Controls, multiPromptEnabled, setMultiPromptEnabled]);

  useEffect(() => {
    if (form?.engineId === 'pika-image-to-video') {
      setForm((current) => {
        if (!current || current.engineId !== 'pika-image-to-video') return current;
        return { ...current, engineId: 'pika-text-to-video' };
      });
    }
  }, [form?.engineId, setForm]);

  const engineModeOptions = useMemo(() => getEngineModeOptions(selectedEngine), [selectedEngine]);

  const referenceInputStatus = useMemo(() => getReferenceInputStatus(inputAssets), [inputAssets]);
  const seedanceAssetState = useMemo(() => getSeedanceAssetState(inputAssets), [inputAssets]);
  const hasPrimaryImageInput = useMemo(
    () => hasInputAssetInSlots(inputAssets, PRIMARY_IMAGE_SLOT_IDS, 'image'),
    [inputAssets]
  );
  const hasLastFrameInput = useMemo(
    () => hasInputAssetInSlots(inputAssets, ['last_frame_url'], 'image'),
    [inputAssets]
  );

  const implicitMode = useMemo<Mode>(() => {
    if (!selectedEngine) return form?.mode ?? 't2v';
    if (isUnifiedSeedance) {
      return getUnifiedSeedanceMode(inputAssets);
    }
    if (isUnifiedHappyHorse && (form?.mode === 't2v' || !form?.mode)) {
      return getUnifiedHappyHorseMode(inputAssets);
    }
    const modes = selectedEngine.modes;
    if (referenceInputStatus.hasAudio && modes.includes('a2v')) return 'a2v';
    if (referenceInputStatus.hasVideo && modes.includes('v2v')) return 'v2v';
    if (referenceInputStatus.hasVideo && modes.includes('r2v')) return 'r2v';
    if (referenceInputStatus.hasVideo && modes.includes('reframe')) return 'reframe';
    if (referenceInputStatus.hasImage && modes.includes('i2v')) return 'i2v';
    if (modes.includes('t2v')) return 't2v';
    return modes[0] ?? 't2v';
  }, [form?.mode, inputAssets, isUnifiedHappyHorse, isUnifiedSeedance, referenceInputStatus.hasAudio, referenceInputStatus.hasImage, referenceInputStatus.hasVideo, selectedEngine]);

  const audioToVideoSupported = Boolean(selectedEngine?.modes.includes('a2v'));
  const audioWorkflowLocked = referenceInputStatus.hasAudio && audioToVideoSupported;
  const audioWorkflowUnsupported =
    referenceInputStatus.hasAudio &&
    Boolean(selectedEngine) &&
    !audioToVideoSupported &&
    !(isUnifiedSeedance && seedanceAssetState.hasReferenceAudio);

  const activeManualMode = useMemo<Mode | null>(() => {
    if (!selectedEngine) return null;
    if (isUnifiedSeedance) return null;
    if (referenceInputStatus.hasAudio && !isUnifiedSeedance) return null;
    const currentMode = form?.mode ?? null;
    if (
      (currentMode === 'v2v' ||
        currentMode === 'reframe' ||
        currentMode === 'ref2v' ||
        currentMode === 'extend' ||
        currentMode === 'retake') &&
        selectedEngine.modes.includes(currentMode)
    ) {
      return currentMode;
    }
    return null;
  }, [form?.mode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine]);

  const activeMode: Mode = activeManualMode ?? implicitMode;
  const allowsUnifiedVeoFirstLast = useMemo(() => {
    return Boolean(
      selectedEngine &&
        UNIFIED_VEO_FIRST_LAST_ENGINE_IDS.has(selectedEngine.id) &&
        activeManualMode === null &&
        (activeMode === 't2v' || activeMode === 'i2v')
    );
  }, [activeManualMode, activeMode, selectedEngine]);
  const submissionMode = useMemo<Mode>(() => {
    if (allowsUnifiedVeoFirstLast && hasPrimaryImageInput && hasLastFrameInput) {
      return 'fl2v';
    }
    return activeMode;
  }, [activeMode, allowsUnifiedVeoFirstLast, hasLastFrameInput, hasPrimaryImageInput]);
  const showSafetyCheckerControl = useMemo(() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) return false;
    return [...(schema.required ?? []), ...(schema.optional ?? [])].some((field) => {
      if (field.id !== 'enable_safety_checker') return false;
      return !field.modes || field.modes.includes(submissionMode);
    });
  }, [selectedEngine, submissionMode]);
  const effectiveDurationSec = useMemo(() => {
    if (multiPromptActive) return multiPromptTotalSec;
    if (submissionMode === 'a2v' && typeof primaryAudioDurationSec === 'number') return primaryAudioDurationSec;
    if ((submissionMode === 'v2v' || submissionMode === 'reframe') && typeof primaryVideoDurationSec === 'number') {
      return primaryVideoDurationSec;
    }
    return form?.durationSec ?? 0;
  }, [multiPromptActive, multiPromptTotalSec, submissionMode, primaryAudioDurationSec, primaryVideoDurationSec, form?.durationSec]);

  useEffect(() => {
    if (!selectedEngine || !form) return;
    if (activeManualMode) return;
    if (form.mode === implicitMode) return;
    setForm((current) => {
      if (!current || current.mode === implicitMode) return current;
      return coerceFormState(selectedEngine, implicitMode, { ...current, mode: implicitMode });
    });
  }, [activeManualMode, form, implicitMode, selectedEngine, setForm]);

  useEffect(() => {
    if (!supportsKlingV3Controls) return;
    if (activeMode !== 'i2v') return;
    if (shotType !== 'customize') {
      setShotType('customize');
    }
  }, [activeMode, setShotType, shotType, supportsKlingV3Controls]);

  const capability = useMemo(() => {
    if (!selectedEngine) return undefined;
    return getModeCaps(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const generateAudioField = useMemo(() => {
    if (!selectedEngine) return null;
    return findGenerateAudioField(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const supportsAudioToggle =
    Boolean(selectedEngine && capability?.audioToggle && generateAudioField && supportsAudioPricingToggle(selectedEngine));

  useEffect(() => {
    if (!voiceControlEnabled) return;
    setForm((current) => {
      if (!current || current.audio) return current;
      return { ...current, audio: true };
    });
  }, [setForm, voiceControlEnabled]);

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      requestedEngineOverrideIdRef.current = null;
      requestedEngineOverrideTokenRef.current = null;
      requestedModeOverrideRef.current = null;
      preserveStoredDraftRef.current = false;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = getPreferredEngineMode(nextEngine, candidate?.mode ?? null);
        const normalizedPrevious = candidate ? { ...candidate, engineId: nextEngine.id, mode: nextMode } : null;
        return coerceFormState(nextEngine, nextMode, normalizedPrevious);
      });
    },
    [engines, preserveStoredDraftRef, requestedEngineOverrideIdRef, requestedEngineOverrideTokenRef, requestedModeOverrideRef, setForm]
  );

  useEffect(() => {
    if (!engineOverride) return;
    if (hasStoredFormRef.current) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (candidate?.engineId === engineOverride.id) return candidate;
      const preferredMode = getPreferredEngineMode(engineOverride, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, engineId: engineOverride.id, mode: preferredMode } : null;
      const nextState = coerceFormState(engineOverride, preferredMode, normalizedPrevious);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[generate] engine override applied', {
          previous: candidate?.engineId,
          next: nextState.engineId,
        });
      }
      queueMicrotask(() => {
        try {
          writeStorage(STORAGE_KEYS.form, JSON.stringify(nextState));
        } catch {
          // noop
        }
      });
      return nextState;
    });
  }, [engineOverride, hasStoredFormRef, setForm, writeStorage]);

  useEffect(() => {
    const pinnedToken = requestedEngineOverrideTokenRef.current;
    if (!pinnedToken) return;
    if (!authChecked) return;
    if (hydratedForScope !== storageScope) return;
    if (!selectedEngine) return;
    if (matchesEngineToken(selectedEngine, pinnedToken)) return;
    const pinnedEngine = engines.find((engine) => matchesEngineToken(engine, pinnedToken));
    if (!pinnedEngine) return;
    setForm((current) => {
      const candidate = current ?? null;
      const nextMode = getPreferredEngineMode(pinnedEngine, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, engineId: pinnedEngine.id, mode: nextMode } : null;
      return coerceFormState(pinnedEngine, nextMode, normalizedPrevious);
    });
  }, [authChecked, engines, hydratedForScope, requestedEngineOverrideTokenRef, selectedEngine, setForm, storageScope]);

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      const nextMode = getPreferredEngineMode(selectedEngine, mode);
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine, setForm]
  );

  const composerModeToggles = useMemo(
    () =>
      buildComposerModeToggles({
        selectedEngine,
        audioWorkflowLocked,
        uiLocale,
        workflowCopy,
      }),
    [audioWorkflowLocked, selectedEngine, uiLocale, workflowCopy]
  );

  const showRetakeWorkflowAction = Boolean(selectedEngine?.id === 'ltx-2-3' && selectedEngine.modes.includes('retake'));

  const composerWorkflowNotice = useMemo(
    () =>
      getComposerWorkflowNotice({
        selectedEngine,
        hasAudioInput: referenceInputStatus.hasAudio,
        audioWorkflowUnsupported,
        workflowCopy,
      }),
    [audioWorkflowUnsupported, referenceInputStatus.hasAudio, selectedEngine, workflowCopy]
  );

  const handleComposerModeToggle = useCallback(
    (mode: Mode | null) => {
      if (!selectedEngine) return;
      if (
        referenceInputStatus.hasAudio &&
        !isUnifiedSeedance &&
        (mode === 'v2v' || mode === 'reframe' || mode === 'extend' || mode === 'retake')
      ) {
        showNotice(workflowCopy.removeAudioToUseEdit);
        return;
      }
      const nextMode = mode ?? implicitMode;
      setForm((current) =>
        coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null)
      );
    },
    [implicitMode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine, setForm, showNotice, workflowCopy]
  );

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

  useEffect(() => {
    if (!selectedEngine || !authChecked) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (!candidate) return candidate;
      const nextMode = getPreferredEngineMode(selectedEngine, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, mode: nextMode } : null;
      const nextState = coerceFormState(selectedEngine, nextMode, normalizedPrevious);
      return hasFormStateChanged(candidate, nextState) ? nextState : candidate;
    });
  }, [selectedEngine, authChecked, setForm]);

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
