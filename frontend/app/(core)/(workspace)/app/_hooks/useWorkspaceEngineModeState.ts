import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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
  getComposerWorkflowNotice,
  getEngineModeOptions,
  getModeCaps,
  getPreferredEngineMode,
  matchesEngineToken,
} from '../_lib/workspace-engine-helpers';
import { STORAGE_KEYS } from '../_lib/workspace-storage';
import { UNIFIED_VEO_FIRST_LAST_ENGINE_IDS } from '../_lib/workspace-client-helpers';

type ShotType = 'customize' | 'intelligent';

export type WorkspaceComposerWorkflowCopy = Parameters<typeof buildComposerModeToggles>[0]['workflowCopy'] & {
  removeAudioToUseEdit: string;
};
export type WorkspaceReferenceInputStatus = ReturnType<typeof getReferenceInputStatus>;
export type WorkspaceComposerModeToggles = ReturnType<typeof buildComposerModeToggles>;

type UseWorkspaceEngineModeStateOptions = {
  engines: EngineCaps[];
  form: FormState | null;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
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

type UseWorkspaceEngineModeStateResult = {
  selectedEngine: EngineCaps | null;
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  isSeedance: boolean;
  isUnifiedSeedance: boolean;
  isUnifiedHappyHorse: boolean;
  referenceInputStatus: WorkspaceReferenceInputStatus;
  primaryAudioDurationSec: number | null;
  primaryVideoDurationSec: number | null;
  hasLastFrameInput: boolean;
  audioWorkflowLocked: boolean;
  audioWorkflowUnsupported: boolean;
  activeManualMode: Mode | null;
  activeMode: Mode;
  allowsUnifiedVeoFirstLast: boolean;
  submissionMode: Mode;
  showSafetyCheckerControl: boolean;
  capability: EngineModeUiCaps | undefined;
  supportsAudioToggle: boolean;
  engineModeOptions: Mode[] | undefined;
  composerModeToggles: WorkspaceComposerModeToggles;
  showRetakeWorkflowAction: boolean;
  composerWorkflowNotice: string | null;
  handleEngineChange: (engineId: string) => void;
  handleModeChange: (mode: Mode) => void;
  handleComposerModeToggle: (mode: Mode | null) => void;
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

export function useWorkspaceEngineModeState({
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
}: UseWorkspaceEngineModeStateOptions): UseWorkspaceEngineModeStateResult {
  const engineOverride = useMemo<EngineCaps | null>(() => {
    if (!effectiveRequestedEngineToken) return null;
    if (!engines.length) return null;
    if (hasStoredFormRef.current) return null;
    return engines.find((engine) => matchesEngineToken(engine, effectiveRequestedEngineToken)) ?? null;
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
  }, [
    form?.mode,
    inputAssets,
    isUnifiedHappyHorse,
    isUnifiedSeedance,
    referenceInputStatus.hasAudio,
    referenceInputStatus.hasImage,
    referenceInputStatus.hasVideo,
    selectedEngine,
  ]);

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
    [
      engines,
      preserveStoredDraftRef,
      requestedEngineOverrideIdRef,
      requestedEngineOverrideTokenRef,
      requestedModeOverrideRef,
      setForm,
    ]
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
  };
}
