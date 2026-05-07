'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Composer, type MultiPromptScene } from '@/components/Composer';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import { SettingsControls } from '@/components/SettingsControls';
import type { KlingElementState, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import { Button } from '@/components/ui/Button';
import {
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
} from '@/lib/luma-ray2';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import { getSeedanceFieldBlockKey } from '@/lib/seedance-workflow';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import {
  buildComposerAttachments,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { normalizeExtraInputValue } from '../_lib/workspace-form-state';
import {
  buildComposerPromotedActions,
  type WorkspaceInputSchemaSummary,
} from '../_lib/workspace-input-schema';
import {
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
} from '../_lib/workspace-input-helpers';

const KlingElementsBuilder = dynamic<KlingElementsBuilderProps>(
  () => import('@/components/KlingElementsBuilder').then((mod) => mod.KlingElementsBuilder),
  { ssr: false }
);

type ComposerProps = ComponentProps<typeof Composer>;
type ShotType = 'customize' | 'intelligent';
type WorkflowCopy = {
  clearReferencesToUseStartEnd: string;
  clearStartEndToUseReferences: string;
  removeAudioToUnlock: string;
};

type WorkspaceComposerSurfaceProps = {
  selectedEngine: EngineCaps;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  negativePrompt: string;
  setNegativePrompt: Dispatch<SetStateAction<string>>;
  price: ComposerProps['price'];
  currency: ComposerProps['currency'];
  isPricing: boolean;
  preflightError: ComposerProps['error'];
  preflight: ComposerProps['preflight'];
  composerRef: ComposerProps['textareaRef'];
  startRender: ComposerProps['onGenerate'];
  inputSchemaSummary: WorkspaceInputSchemaSummary;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  isUnifiedSeedance: boolean;
  workflowCopy: WorkflowCopy;
  guestUploadLockedReason: string | null;
  uiLocale: string;
  composerModeToggles: ComposerProps['modeToggles'];
  activeManualMode: Mode | null;
  handleComposerModeToggle: (mode: Mode | null) => void;
  composerWorkflowNotice: string | null;
  handleAssetAdd: NonNullable<ComposerProps['onAssetAdd']>;
  handleAssetRemove: NonNullable<ComposerProps['onAssetRemove']>;
  handleOpenAssetLibrary: NonNullable<ComposerProps['onOpenLibrary']>;
  showNotice: (message: string) => void;
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  multiPromptEnabled: boolean;
  setMultiPromptEnabled: Dispatch<SetStateAction<boolean>>;
  multiPromptScenes: MultiPromptScene[];
  multiPromptTotalSec: number;
  multiPromptActive: boolean;
  multiPromptInvalid: boolean;
  multiPromptError: string | null;
  handleMultiPromptAddScene: () => void;
  handleMultiPromptRemoveScene: (id: string) => void;
  handleMultiPromptUpdateScene: (
    id: string,
    patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>
  ) => void;
  audioWorkflowUnsupported: boolean;
  audioWorkflowLocked: boolean;
  showRetakeWorkflowAction: boolean;
  activeMode: Mode;
  submissionMode: Mode;
  capability: EngineModeUiCaps | undefined;
  handleDurationChange: (raw: number | string) => void;
  handleFramesChange: (value: number) => void;
  handleResolutionChange: (resolution: string) => void;
  handleAspectRatioChange: (ratio: string) => void;
  handleFpsChange: (fps: number) => void;
  supportsAudioToggle: boolean;
  voiceControlEnabled: boolean;
  cfgScale: number | null;
  setCfgScale: Dispatch<SetStateAction<number | null>>;
  shotType: ShotType;
  setShotType: Dispatch<SetStateAction<ShotType>>;
  voiceIdsInput: string;
  setVoiceIdsInput: Dispatch<SetStateAction<string>>;
  isSeedance: boolean;
  seedValue: string;
  handleSeedChange: (value: string) => void;
  cameraFixedValue: boolean;
  handleCameraFixedChange: (value: boolean) => void;
  safetyCheckerValue: boolean;
  handleSafetyCheckerChange: (value: boolean) => void;
  showSafetyCheckerControl: boolean;
  klingElements: KlingElementState[];
  handleKlingElementAdd: () => void;
  handleKlingElementRemove: (id: string) => void;
  handleKlingElementAssetAdd: KlingElementsBuilderProps['onAddAsset'];
  handleKlingElementAssetRemove: KlingElementsBuilderProps['onRemoveAsset'];
  handleOpenKlingAssetLibrary: (elementId: string, slot: 'frontal' | 'reference', slotIndex?: number) => void;
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
};

export function WorkspaceComposerSurface({
  selectedEngine,
  form,
  setForm,
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  price,
  currency,
  isPricing,
  preflightError,
  preflight,
  composerRef,
  startRender,
  inputSchemaSummary,
  inputAssets,
  isUnifiedSeedance,
  workflowCopy,
  guestUploadLockedReason,
  uiLocale,
  composerModeToggles,
  activeManualMode,
  handleComposerModeToggle,
  composerWorkflowNotice,
  handleAssetAdd,
  handleAssetRemove,
  handleOpenAssetLibrary,
  showNotice,
  supportsKlingV3Controls,
  supportsKlingV3VoiceControl,
  multiPromptEnabled,
  setMultiPromptEnabled,
  multiPromptScenes,
  multiPromptTotalSec,
  multiPromptActive,
  multiPromptInvalid,
  multiPromptError,
  handleMultiPromptAddScene,
  handleMultiPromptRemoveScene,
  handleMultiPromptUpdateScene,
  audioWorkflowUnsupported,
  audioWorkflowLocked,
  showRetakeWorkflowAction,
  activeMode,
  submissionMode,
  capability,
  handleDurationChange,
  handleFramesChange,
  handleResolutionChange,
  handleAspectRatioChange,
  handleFpsChange,
  supportsAudioToggle,
  voiceControlEnabled,
  cfgScale,
  setCfgScale,
  shotType,
  setShotType,
  voiceIdsInput,
  setVoiceIdsInput,
  isSeedance,
  seedValue,
  handleSeedChange,
  cameraFixedValue,
  handleCameraFixedChange,
  safetyCheckerValue,
  handleSafetyCheckerChange,
  showSafetyCheckerControl,
  klingElements,
  handleKlingElementAdd,
  handleKlingElementRemove,
  handleKlingElementAssetAdd,
  handleKlingElementAssetRemove,
  handleOpenKlingAssetLibrary,
  setViewMode,
}: WorkspaceComposerSurfaceProps) {
  const composerAssetFields = useMemo(() => {
    return inputSchemaSummary.assetFields.map((entry) => {
      const fieldHasOwnAssets = (inputAssets[entry.field.id] ?? []).some((asset) => asset !== null);
      const blockKey = isUnifiedSeedance
        ? getSeedanceFieldBlockKey(entry.field.id, inputAssets, fieldHasOwnAssets)
        : null;
      const workflowDisabledReason =
        blockKey === 'clearReferences'
          ? workflowCopy.clearReferencesToUseStartEnd
          : blockKey === 'clearStartEnd'
            ? workflowCopy.clearStartEndToUseReferences
            : null;
      const disabledReason = workflowDisabledReason ?? guestUploadLockedReason;
      return {
        ...entry,
        disabled: Boolean(disabledReason),
        disabledReason,
      };
    });
  }, [
    guestUploadLockedReason,
    inputAssets,
    inputSchemaSummary.assetFields,
    isUnifiedSeedance,
    workflowCopy.clearReferencesToUseStartEnd,
    workflowCopy.clearStartEndToUseReferences,
  ]);

  const handleExtraInputValueChange = useCallback(
    (field: EngineInputField, value: unknown) => {
      setForm((current) => {
        if (!current) return current;
        const normalized = normalizeExtraInputValue(field, value);
        const next = { ...current.extraInputValues };
        if (normalized === undefined) {
          delete next[field.id];
        } else {
          next[field.id] = normalized;
        }
        return { ...current, extraInputValues: next };
      });
    },
    [setForm]
  );

  const composerAssets = useMemo(() => buildComposerAttachments(inputAssets), [inputAssets]);
  const composerPromotedActions = useMemo(
    () =>
      buildComposerPromotedActions({
        form,
        promotedFields: inputSchemaSummary.promotedFields,
        uiLocale,
        onToggle: handleExtraInputValueChange,
      }),
    [form, handleExtraInputValueChange, inputSchemaSummary.promotedFields, uiLocale]
  );

  useEffect(() => {
    const cfgParam = selectedEngine.params?.cfg_scale;
    if (cfgParam) {
      if (cfgScale === null) {
        setCfgScale(cfgParam.default ?? null);
      }
      return;
    }
    if (cfgScale !== null) {
      setCfgScale(null);
    }
  }, [cfgScale, selectedEngine, form.mode, setCfgScale]);

  const durationSec = multiPromptActive ? multiPromptTotalSec : form.durationSec;
  const durationManagedLabel = `Duration managed by multi-prompt · ${multiPromptTotalSec}s`;
  const audioControlNote = voiceControlEnabled ? 'Audio locked by voice control' : undefined;

  const handleAudioChange = useCallback(
    (audio: boolean) => {
      setForm((current) => (current ? { ...current, audio } : current));
    },
    [setForm]
  );
  const handleLoopChange = useCallback(
    (loop: boolean) => {
      setForm((current) => (current ? { ...current, loop } : current));
    },
    [setForm]
  );
  const handleSeedLockedChange = useCallback(
    (seedLocked: boolean) => {
      setForm((current) => (current ? { ...current, seedLocked } : current));
    },
    [setForm]
  );
  const handleIterationsChange = useCallback(
    (iterations: number) => {
      setForm((current) => {
        const next = current ? { ...current, iterations } : current;
        if (iterations <= 1) {
          setViewMode('single');
        }
        return next;
      });
    },
    [setForm, setViewMode]
  );

  return (
    <Composer
      engine={selectedEngine}
      prompt={prompt}
      onPromptChange={setPrompt}
      negativePrompt={negativePrompt}
      onNegativePromptChange={setNegativePrompt}
      price={price}
      currency={currency}
      isLoading={isPricing}
      error={preflightError}
      messages={preflight?.ok ? preflight.messages : undefined}
      textareaRef={composerRef}
      onGenerate={startRender}
      preflight={preflight}
      promptField={inputSchemaSummary.promptField}
      promptRequired={inputSchemaSummary.promptRequired}
      negativePromptField={inputSchemaSummary.negativePromptField}
      negativePromptRequired={inputSchemaSummary.negativePromptRequired}
      modeToggles={composerModeToggles}
      activeManualMode={activeManualMode}
      onModeToggle={handleComposerModeToggle}
      workflowNotice={composerWorkflowNotice}
      promotedActions={composerPromotedActions}
      assetFields={composerAssetFields}
      assets={composerAssets}
      onAssetAdd={handleAssetAdd}
      onAssetRemove={handleAssetRemove}
      onNotice={showNotice}
      onOpenLibrary={handleOpenAssetLibrary}
      multiPrompt={
        supportsKlingV3Controls
          ? {
              enabled: multiPromptEnabled,
              scenes: multiPromptScenes,
              totalDurationSec: multiPromptTotalSec,
              minDurationSec: MULTI_PROMPT_MIN_SEC,
              maxDurationSec: MULTI_PROMPT_MAX_SEC,
              onToggle: setMultiPromptEnabled,
              onAddScene: handleMultiPromptAddScene,
              onRemoveScene: handleMultiPromptRemoveScene,
              onUpdateScene: handleMultiPromptUpdateScene,
              error: multiPromptError,
            }
          : null
      }
      disableGenerate={multiPromptInvalid || audioWorkflowUnsupported}
      extraFields={
        <>
          {showRetakeWorkflowAction ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Edit workflow</p>
                <p className="text-xs text-text-secondary">Use retake when you want to reinterpret an existing clip.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={form.mode === 'retake' ? 'primary' : 'outline'}
                onClick={() => handleComposerModeToggle(form.mode === 'retake' ? null : 'retake')}
                disabled={audioWorkflowLocked}
                title={audioWorkflowLocked ? workflowCopy.removeAudioToUnlock : undefined}
                className="min-h-0 h-auto rounded-full px-3 py-2 text-[11px] font-semibold tracking-micro"
              >
                {getLocalizedModeLabel('retake', uiLocale)}
              </Button>
            </div>
          ) : null}
          {supportsKlingV3Controls && activeMode === 'i2v' ? (
            <KlingElementsBuilder
              elements={klingElements}
              onAddElement={handleKlingElementAdd}
              onRemoveElement={handleKlingElementRemove}
              onAddAsset={handleKlingElementAssetAdd}
              onRemoveAsset={handleKlingElementAssetRemove}
              onOpenLibrary={handleOpenKlingAssetLibrary}
            />
          ) : null}
          <SettingsControls
            engine={selectedEngine}
            caps={capability}
            durationSec={durationSec}
            durationOption={form.durationOption ?? null}
            onDurationChange={handleDurationChange}
            numFrames={form.numFrames ?? undefined}
            onNumFramesChange={handleFramesChange}
            resolution={form.resolution}
            onResolutionChange={handleResolutionChange}
            aspectRatio={form.aspectRatio}
            onAspectRatioChange={handleAspectRatioChange}
            fps={form.fps}
            onFpsChange={handleFpsChange}
            mode={submissionMode}
            showAudioControl={supportsAudioToggle}
            audioEnabled={form.audio}
            audioControlDisabled={voiceControlEnabled}
            audioControlNote={audioControlNote}
            onAudioChange={handleAudioChange}
            showLoopControl={isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)}
            loopEnabled={
              isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)
                ? Boolean(form.loop)
                : undefined
            }
            onLoopChange={handleLoopChange}
            showExtendControl={false}
            seedLocked={form.seedLocked}
            onSeedLockedChange={handleSeedLockedChange}
            cfgScale={cfgScale}
            onCfgScaleChange={setCfgScale}
            durationManaged={multiPromptActive}
            durationManagedLabel={durationManagedLabel}
            showKlingV3Controls={supportsKlingV3Controls}
            showKlingV3VoiceControls={supportsKlingV3VoiceControl}
            klingShotType={shotType}
            onKlingShotTypeChange={setShotType}
            voiceIdsValue={voiceIdsInput}
            onVoiceIdsChange={setVoiceIdsInput}
            voiceControlActive={voiceControlEnabled}
            showSeedanceControls={isSeedance}
            seedValue={seedValue}
            onSeedChange={handleSeedChange}
            cameraFixed={cameraFixedValue}
            onCameraFixedChange={handleCameraFixedChange}
            safetyChecker={safetyCheckerValue}
            onSafetyCheckerChange={handleSafetyCheckerChange}
            showSafetyCheckerControl={showSafetyCheckerControl}
            advancedFields={inputSchemaSummary.secondaryFields}
            advancedFieldValues={form.extraInputValues}
            onAdvancedFieldChange={handleExtraInputValueChange}
            variant="advanced"
          />
        </>
      }
      settingsBar={
        <CoreSettingsBar
          engine={selectedEngine}
          mode={submissionMode}
          caps={capability}
          iterations={form.iterations}
          onIterationsChange={handleIterationsChange}
          durationSec={durationSec}
          durationOption={form.durationOption ?? null}
          onDurationChange={handleDurationChange}
          numFrames={form.numFrames ?? undefined}
          onNumFramesChange={handleFramesChange}
          resolution={form.resolution}
          onResolutionChange={handleResolutionChange}
          aspectRatio={form.aspectRatio}
          onAspectRatioChange={handleAspectRatioChange}
          fps={form.fps}
          onFpsChange={handleFpsChange}
          showAudioControl={supportsAudioToggle}
          audioEnabled={form.audio}
          audioControlDisabled={voiceControlEnabled}
          audioControlNote={audioControlNote}
          onAudioChange={handleAudioChange}
          durationManaged={multiPromptActive}
          durationManagedLabel={durationManagedLabel}
        />
      }
    />
  );
}
