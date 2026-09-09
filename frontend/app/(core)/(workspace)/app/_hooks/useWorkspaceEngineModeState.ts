import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';
import { getKlingO3DisabledEngineReasons } from '../_lib/kling-o3-unified-workflow';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { resolveWorkspaceWorkflow, type WorkspaceWorkflowProjection } from '../_lib/workspace-workflow-projection';
import {
  buildComposerModeToggles,
  coerceFormState,
  coerceFormStateForEngineChange,
  getComposerWorkflowNotice,
  getPreferredEngineModeForEngineRequest,
  getPreferredEngineMode,
  isWorkspaceModeAvailable,
  matchesEngineToken,
  resolveSelectedWorkspaceEngine,
} from '../_lib/workspace-engine-helpers';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type ShotType = 'customize' | 'intelligent';

export function supportsWorkspaceMultiPrompt(engine: EngineCaps, mode?: Mode): boolean {
  const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
  return fields.some((field) =>
    field.id === 'multi_prompt'
    && (!mode || !field.modes?.length || field.modes.includes(mode)));
}

export type WorkspaceComposerWorkflowCopy = Parameters<typeof buildComposerModeToggles>[0]['workflowCopy'] & {
  removeAudioToUseEdit: string;
};
export type WorkspaceReferenceInputStatus = WorkspaceWorkflowProjection['referenceInputStatus'];
export type WorkspaceComposerModeToggles = ReturnType<typeof buildComposerModeToggles>;

type UseWorkspaceEngineModeStateOptions = {
  engines: EngineCaps[];
  form: FormState | null;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
  shotType: ShotType;
  setShotType: Dispatch<SetStateAction<ShotType>>;
  effectiveRequestedEngineToken: string | null;
  authChecked: boolean;
  hydratedForScope: string | null;
  storageScope: string;
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
  isUnifiedKlingO3: boolean;
  isUnifiedGeminiOmni: boolean;
  klingO3UnsupportedVideoReason: string | null;
  klingO3DisabledEngineReasons: Record<string, string>;
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
  applyPreparedForm: (form: FormState) => void;
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
  klingElements,
  shotType,
  setShotType,
  effectiveRequestedEngineToken,
  authChecked,
  hydratedForScope,
  storageScope,
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
    return engines.find((engine) => matchesEngineToken(engine, effectiveRequestedEngineToken)) ?? null;
  }, [engines, effectiveRequestedEngineToken]);

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    return resolveSelectedWorkspaceEngine({ engines, form, engineOverride });
  }, [engines, form, engineOverride]);
  const {
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    isUnifiedHappyHorse,
    isUnifiedKlingO3,
    isUnifiedGeminiOmni,
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
    supportsAudioToggle,
    isUnifiedMinimaxH3,
  } = useMemo(
    () => resolveWorkspaceWorkflow({ engine: selectedEngine, form, inputAssets, klingElements }),
    [selectedEngine, form, inputAssets, klingElements]
  );

  const klingO3DisabledEngineReasons = useMemo(
    () => getKlingO3DisabledEngineReasons({ engines, inputAssets, klingElements }),
    [engines, inputAssets, klingElements]
  );

  useEffect(() => {
    if (form?.engineId === 'pika-image-to-video') {
      setForm((current) => {
        if (!current || current.engineId !== 'pika-image-to-video') return current;
        return { ...current, engineId: 'pika-text-to-video' };
      });
    }
  }, [form?.engineId, setForm]);

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

  const applyPreparedForm = useCallback((prepared: FormState) => {
    requestedEngineOverrideIdRef.current = null;
    requestedEngineOverrideTokenRef.current = null;
    requestedModeOverrideRef.current = null;
    preserveStoredDraftRef.current = false;
    setForm(prepared);
  }, [requestedEngineOverrideIdRef, requestedEngineOverrideTokenRef, requestedModeOverrideRef, preserveStoredDraftRef, setForm]);

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      const disabledReason = klingO3DisabledEngineReasons[nextEngine.id];
      if (disabledReason) {
        showNotice(disabledReason);
        return;
      }
      requestedEngineOverrideIdRef.current = null;
      requestedEngineOverrideTokenRef.current = null;
      requestedModeOverrideRef.current = null;
      preserveStoredDraftRef.current = false;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = getPreferredEngineModeForEngineRequest({
          engine: nextEngine,
          requestedMode: null,
          carryoverMode: candidate?.mode ?? null,
        });
        return coerceFormStateForEngineChange(nextEngine, nextMode, candidate);
      });
    },
    [
      engines,
      klingO3DisabledEngineReasons,
      preserveStoredDraftRef,
      requestedEngineOverrideIdRef,
      requestedEngineOverrideTokenRef,
      requestedModeOverrideRef,
      setForm,
      showNotice,
    ]
  );

  useEffect(() => {
    if (!engineOverride) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (candidate?.engineId === engineOverride.id) return candidate;
      const preferredMode = getPreferredEngineModeForEngineRequest({
        engine: engineOverride,
        requestedMode: requestedModeOverrideRef.current,
        carryoverMode: candidate?.mode ?? null,
      });
      const nextState = coerceFormStateForEngineChange(engineOverride, preferredMode, candidate);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[generate] engine override applied', {
          previous: candidate?.engineId,
          next: nextState.engineId,
        });
      }
      const shouldPersistRequestedEngine =
        !preserveStoredDraftRef.current ||
        candidate?.engineId !== nextState.engineId ||
        candidate?.mode !== nextState.mode;
      if (shouldPersistRequestedEngine) {
        queueMicrotask(() => {
          try {
            writeStorage(STORAGE_KEYS.form, JSON.stringify(nextState));
          } catch {
            // noop
          }
        });
      }
      return nextState;
    });
  }, [engineOverride, preserveStoredDraftRef, requestedModeOverrideRef, setForm, writeStorage]);

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
      const nextMode = getPreferredEngineModeForEngineRequest({
        engine: pinnedEngine,
        requestedMode: requestedModeOverrideRef.current,
        carryoverMode: candidate?.mode ?? null,
      });
      return coerceFormStateForEngineChange(pinnedEngine, nextMode, candidate);
    });
  }, [
    authChecked,
    engines,
    hydratedForScope,
    requestedEngineOverrideTokenRef,
    requestedModeOverrideRef,
    selectedEngine,
    setForm,
    storageScope,
  ]);

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      if (!workspaceExecutableModes.includes(mode) || !isWorkspaceModeAvailable(selectedEngine, mode)) return;
      const nextMode = getPreferredEngineMode(selectedEngine, mode);
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine, setForm, workspaceExecutableModes]
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
        !isUnifiedMinimaxH3 &&
        (mode === 'v2v' || mode === 'reframe' || mode === 'extend' || mode === 'retake')
      ) {
        showNotice(workflowCopy.removeAudioToUseEdit);
        return;
      }
      if (mode && (!workspaceExecutableModes.includes(mode) || !isWorkspaceModeAvailable(selectedEngine, mode))) return;
      const nextMode = mode ?? implicitMode;
      setForm((current) =>
        coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null)
      );
    },
    [implicitMode, isUnifiedMinimaxH3, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine, setForm, showNotice, workflowCopy, workspaceExecutableModes]
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
    isUnifiedKlingO3,
    isUnifiedGeminiOmni,
    klingO3UnsupportedVideoReason,
    klingO3DisabledEngineReasons,
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
    applyPreparedForm,
    handleModeChange,
    handleComposerModeToggle,
  };
}
