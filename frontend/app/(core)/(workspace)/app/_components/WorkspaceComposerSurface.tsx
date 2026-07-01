'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Composer, type ComposerPromotedAction, type MultiPromptScene } from '@/components/Composer';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import { SettingsControls } from '@/components/SettingsControls';
import type { KlingElementState, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import { Button } from '@/components/ui/Button';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import { getSeedanceFieldBlockKey } from '@/lib/seedance-workflow';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import {
  buildComposerAttachments,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import {
  getKlingO3AssetState,
  isKlingO3FrameFieldId,
  KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE,
  KLING_O3_VIDEO_FRAME_IGNORED_MESSAGE,
  supportsKlingO3VideoToVideo,
} from '../_lib/kling-o3-unified-workflow';
import type { FormState } from '../_lib/workspace-form-state';
import { normalizeExtraInputValue } from '../_lib/workspace-form-state';
import {
  buildComposerPromotedActions,
  type WorkspaceInputSchemaSummary,
} from '../_lib/workspace-input-schema';
import { supportsModeLoopControl } from '../_lib/workspace-engine-helpers';
import {
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
} from '../_lib/workspace-input-helpers';
import { KLING_MULTI_PROMPT_SCENE_MAX_CHARS } from '../_lib/workspace-multi-prompt-state';
import { LumaRay32KeyframeEditor } from './LumaRay32KeyframeEditor';
import { OmniStudioPanel, OMNI_CUSTOM_FIELD_IDS } from './omni/OmniStudioPanel.client';
import { StoryboardLaunchModal } from './StoryboardLaunchModal';

const KlingElementsBuilder = dynamic<KlingElementsBuilderProps>(
  () => import('@/components/KlingElementsBuilder').then((mod) => mod.KlingElementsBuilder),
  { ssr: false }
);

type ComposerProps = ComponentProps<typeof Composer>;
type ShotType = 'customize' | 'intelligent';
type SeedanceReferenceGuidance = { label: string; tooltip: string };
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
  isUnifiedKlingO3: boolean;
  klingO3UnsupportedVideoReason: string | null;
  workflowCopy: WorkflowCopy;
  guestUploadLockedReason: string | null;
  uiLocale: string;
  composerModeToggles: ComposerProps['modeToggles'];
  activeManualMode: Mode | null;
  handleComposerModeToggle: (mode: Mode | null) => void;
  composerWorkflowNotice: string | null;
  inProgressMessage: string | null;
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
  handleOpenKlingAssetLibrary: (elementId: string, slot: 'frontal' | 'reference' | 'video', slotIndex?: number) => void;
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
};

function isStoryboardLaunchEngine(engineId: string): boolean {
  const normalized = engineId.toLowerCase();
  return normalized.includes('seedance') || normalized.includes('kling');
}

const LUMA_RAY32_MODIFY_ASSET_FIELD_IDS = new Set(['video_url', 'start_image_url', 'edit_keyframe_urls']);
const LUMA_RAY32_MODIFY_ADVANCED_FIELD_IDS = new Set(['edit_keyframe_indexes']);
const HDR_FIELD_ID = 'hdr';
const SEEDANCE_REFERENCE_GUIDANCE_COPY = {
  en: {
    label: 'Seedance may reject recognizable people in reference images.',
    tooltip:
      'Use Seedream text-to-image to create consistent character references, or upload an illustrated/stylized reference and ask Seedance in the prompt to render it realistically.',
  },
  fr: {
    label: 'Seedance peut refuser les personnes reconnaissables dans les images de référence.',
    tooltip:
      "Pour des personnages de référence, crée d'abord des images cohérentes avec Seedream text-to-image, ou importe un dessin/stylisé et demande à Seedance dans le prompt de le rendre réaliste.",
  },
  es: {
    label: 'Seedance puede rechazar personas reconocibles en las imágenes de referencia.',
    tooltip:
      'Para personajes de referencia, crea primero imágenes coherentes con Seedream text-to-image, o sube una referencia ilustrada/estilizada y pide a Seedance en el prompt que la haga realista.',
  },
} as const;

function getSeedanceReferenceGuidance(locale: string): SeedanceReferenceGuidance {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'fr' || language === 'es') return SEEDANCE_REFERENCE_GUIDANCE_COPY[language];
  return SEEDANCE_REFERENCE_GUIDANCE_COPY.en;
}

function shouldShowSeedanceReferenceGuidance(field: EngineInputField): boolean {
  return field.type === 'image';
}

function isTruthyExtraInputValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

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
  isUnifiedKlingO3,
  klingO3UnsupportedVideoReason,
  workflowCopy,
  guestUploadLockedReason,
  uiLocale,
  composerModeToggles,
  activeManualMode,
  handleComposerModeToggle,
  composerWorkflowNotice,
  inProgressMessage,
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
  const [storyboardModalOpen, setStoryboardModalOpen] = useState(false);
  const klingO3AssetState = useMemo(
    () => getKlingO3AssetState({ inputAssets, klingElements }),
    [inputAssets, klingElements]
  );
  const klingO3VideoToVideoSupported = supportsKlingO3VideoToVideo(selectedEngine);
  const klingO3VideoReferenceDisabledReason =
    isUnifiedKlingO3 && !klingO3VideoToVideoSupported ? KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE : null;
  const showLumaRay32KeyframeEditor = selectedEngine.id === 'luma-ray-3-2' && submissionMode === 'v2v';
  const showOmniStudioPanel = selectedEngine.id === 'gemini-omni-flash';
  const hdrFieldEntry = useMemo(
    () =>
      inputSchemaSummary.secondaryFields.find(({ field }) => field.id === HDR_FIELD_ID) ??
      inputSchemaSummary.promotedFields.find(({ field }) => field.id === HDR_FIELD_ID) ??
      null,
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );

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
      const klingO3DisabledReason =
        isUnifiedKlingO3 && entry.field.type === 'video' && entry.field.id === 'video_url' && !klingO3VideoToVideoSupported
          ? KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE
          : isUnifiedKlingO3 && klingO3AssetState.hasAnyVideoInput && isKlingO3FrameFieldId(entry.field.id)
            ? KLING_O3_VIDEO_FRAME_IGNORED_MESSAGE
            : null;
      const disabledReason = klingO3DisabledReason ?? workflowDisabledReason ?? guestUploadLockedReason;
      return {
        ...entry,
        guidance: isUnifiedSeedance && shouldShowSeedanceReferenceGuidance(entry.field)
          ? getSeedanceReferenceGuidance(uiLocale)
          : entry.guidance,
        disabled: Boolean(disabledReason),
        disabledReason,
      };
    }).filter((entry) => {
      if (showOmniStudioPanel) return false;
      if (!showLumaRay32KeyframeEditor) return true;
      return !LUMA_RAY32_MODIFY_ASSET_FIELD_IDS.has(entry.field.id);
    });
  }, [
    guestUploadLockedReason,
    inputAssets,
    inputSchemaSummary.assetFields,
    isUnifiedSeedance,
    isUnifiedKlingO3,
    klingO3AssetState.hasAnyVideoInput,
    klingO3VideoToVideoSupported,
    showLumaRay32KeyframeEditor,
    showOmniStudioPanel,
    uiLocale,
    workflowCopy.clearReferencesToUseStartEnd,
    workflowCopy.clearStartEndToUseReferences,
  ]);

  const omniExtraFields = useMemo(
    () => [...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields],
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );
  const advancedFields = useMemo(() => {
    const shouldHideInlineField = (field: EngineInputField) =>
      Boolean(hdrFieldEntry && field.id === hdrFieldEntry.field.id) ||
      (showOmniStudioPanel && OMNI_CUSTOM_FIELD_IDS.has(field.id));
    if (!showLumaRay32KeyframeEditor) {
      return inputSchemaSummary.secondaryFields.filter(({ field }) => !shouldHideInlineField(field));
    }
    return inputSchemaSummary.secondaryFields.filter(
      ({ field }) => !LUMA_RAY32_MODIFY_ADVANCED_FIELD_IDS.has(field.id) && !shouldHideInlineField(field)
    );
  }, [hdrFieldEntry, inputSchemaSummary.secondaryFields, showLumaRay32KeyframeEditor, showOmniStudioPanel]);

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
  const hdrEnabled = hdrFieldEntry ? isTruthyExtraInputValue(form.extraInputValues[hdrFieldEntry.field.id]) : false;
  const handleHdrChange = useCallback(
    (enabled: boolean) => {
      if (!hdrFieldEntry) return;
      handleExtraInputValueChange(hdrFieldEntry.field, enabled);
    },
    [handleExtraInputValueChange, hdrFieldEntry]
  );
  const storyboardLaunchAction = useMemo<ComposerPromotedAction | null>(() => {
    if (!isStoryboardLaunchEngine(selectedEngine.id)) return null;
    const tooltip =
      uiLocale === 'fr'
        ? 'Ouvre le Storyboarder avant de générer avec Seedance ou Kling.'
        : uiLocale === 'es'
          ? 'Abre Storyboarder antes de generar con Seedance o Kling.'
          : 'Open Storyboarder before generating with Seedance or Kling.';
    return {
      id: 'storyboard-launch',
      label: 'Storyboard',
      tooltip,
      active: false,
      icon: 'sparkles',
      onToggle: () => setStoryboardModalOpen(true),
    };
  }, [selectedEngine.id, uiLocale]);
  const composerPromotedActions = useMemo(
    () => {
      const actions = buildComposerPromotedActions({
        form,
        promotedFields: inputSchemaSummary.promotedFields,
        uiLocale,
        onToggle: handleExtraInputValueChange,
      });
      return storyboardLaunchAction ? [storyboardLaunchAction, ...actions] : actions;
    },
    [form, handleExtraInputValueChange, inputSchemaSummary.promotedFields, storyboardLaunchAction, uiLocale]
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
  const showLoopControl = supportsModeLoopControl(selectedEngine, submissionMode);
  const showKlingElementsBuilder =
    supportsKlingV3Controls &&
    (isUnifiedKlingO3 || activeMode === 'i2v' || activeMode === 'ref2v');
  const resolvedWorkflowNotice = klingO3UnsupportedVideoReason ?? composerWorkflowNotice;

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
    <>
      {inProgressMessage ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-card border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
        >
          {inProgressMessage}
        </p>
      ) : null}
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
        workflowNotice={resolvedWorkflowNotice}
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
                maxPromptChars: KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
                onToggle: setMultiPromptEnabled,
                onAddScene: handleMultiPromptAddScene,
                onRemoveScene: handleMultiPromptRemoveScene,
                onUpdateScene: handleMultiPromptUpdateScene,
                error: multiPromptError,
              }
            : null
        }
        disableGenerate={multiPromptInvalid || audioWorkflowUnsupported || Boolean(klingO3UnsupportedVideoReason)}
        extraFields={
          <>
            {showLumaRay32KeyframeEditor ? (
              <LumaRay32KeyframeEditor
                engine={selectedEngine}
                caps={capability}
                form={form}
                setForm={setForm}
                assetFields={inputSchemaSummary.assetFields}
                inputAssets={inputAssets}
                onAssetAdd={handleAssetAdd}
                onAssetRemove={handleAssetRemove}
                onOpenLibrary={handleOpenAssetLibrary}
                onNotice={showNotice}
                disabledReason={guestUploadLockedReason}
              />
            ) : null}
            {showOmniStudioPanel ? (
              <OmniStudioPanel
                engine={selectedEngine}
                caps={capability}
                form={form}
                setForm={setForm}
                submissionMode={submissionMode}
                assetFields={inputSchemaSummary.assetFields}
                extraFields={omniExtraFields}
                inputAssets={inputAssets}
                onAssetAdd={handleAssetAdd}
                onAssetRemove={handleAssetRemove}
                onOpenLibrary={handleOpenAssetLibrary}
                onNotice={showNotice}
                disabledReason={guestUploadLockedReason}
              />
            ) : null}
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
            {showKlingElementsBuilder ? (
              <KlingElementsBuilder
                elements={klingElements}
                onAddElement={handleKlingElementAdd}
                onRemoveElement={handleKlingElementRemove}
                onAddAsset={handleKlingElementAssetAdd}
                onRemoveAsset={handleKlingElementAssetRemove}
                onOpenLibrary={handleOpenKlingAssetLibrary}
                videoReferenceDisabledReason={klingO3VideoReferenceDisabledReason}
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
              showLoopControl={showLoopControl}
              loopEnabled={showLoopControl ? Boolean(form.loop) : undefined}
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
              advancedFields={advancedFields}
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
            showHdrControl={Boolean(hdrFieldEntry)}
            hdrEnabled={hdrEnabled}
            onHdrChange={handleHdrChange}
            durationManaged={multiPromptActive}
            durationManagedLabel={durationManagedLabel}
          />
        }
      />
      <StoryboardLaunchModal
        open={storyboardModalOpen}
        selectedEngineId={selectedEngine.id}
        selectedEngineLabel={selectedEngine.label}
        onClose={() => setStoryboardModalOpen(false)}
      />
    </>
  );
}
