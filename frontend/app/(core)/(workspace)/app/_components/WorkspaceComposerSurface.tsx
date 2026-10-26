'use client';
import { OwnedGenerationSourcePicker } from './OwnedGenerationSourcePicker.client';
import { VideoOperationSelector } from './VideoOperationSelector';
import { supportsVideoCfgScaleControl } from '@/lib/video-input-schema';
import { getSeedanceAutomaticPricingNote } from '@/lib/seedance-modelark-options';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { WorkspaceOptionsButton } from '@/components/composer/WorkspaceOptionsButton.client';
import { Composer, type MultiPromptScene } from '@/components/Composer';
import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { SeedanceDraftLocalPreviewMode } from './SeedanceDraftLocalPreviewMode.client';
import { getSeedanceDraftCopy } from '../_lib/seedance-draft-copy';
import { CoreIterationsControl, CoreSettingsBar } from '@/components/CoreSettingsBar';
import { SettingsControls } from '@/components/SettingsControls';
// Subject slots occupy the initial form. A nested lazy boundary inserts the
// panel late and moves the mobile results rail.
import { getWorkspaceKlingV4ActiveAssets, getWorkspaceKlingV4MediaError } from '../_lib/workspace-kling-v4-media';
import { buildKlingElementsPayload } from '../_lib/workspace-generation-inputs';
import { KlingElementsBuilder, type KlingElementState, type KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import { Button } from '@/components/ui/Button';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import { getEngineModeUnavailableMessage, isEngineModeQuoteReady } from '@/lib/engine-mode-availability';
import { resolveSeedanceEditSourceFacts } from '@/lib/seedance-edit-source';
import { seedanceEditSourceLabel } from '@/lib/seedance-edit-source-copy';
import { getWorkspaceReferenceFields } from '../_lib/workspace-reference-fields';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import {
  buildComposerAttachments,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import {
  getKlingO3AssetState,
  KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE,
  supportsKlingO3VideoToVideo,
} from '../_lib/kling-o3-unified-workflow';
import { OMNI_CUSTOM_FIELD_IDS } from '../_lib/gemini-omni-unified-workflow';
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
import { supportsWorkspaceMultiPrompt } from '../_hooks/useWorkspaceEngineModeState';
import type { LumaRay32KeyframeEditorProps } from './LumaRay32KeyframeEditor';
import type { OmniStudioPanelProps } from './omni/OmniStudioPanel.client';

const LumaRay32KeyframeEditor = dynamic<LumaRay32KeyframeEditorProps>(
  () => import('./LumaRay32KeyframeEditor').then((mod) => mod.LumaRay32KeyframeEditor),
  { ssr: false }
);

const OmniStudioPanel = dynamic<OmniStudioPanelProps>(
  () => import('./omni/OmniStudioPanel.client').then((mod) => mod.OmniStudioPanel),
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
  sourceAccount?: {userId:string;token:string}|null;
  localDraftPreview?: SeedanceDraftControls;
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
  isSubmitting: boolean;
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
  referenceAuthAction?: ComposerProps['referenceAuthAction'];
  uiLocale: string;
  composerModeToggles: ComposerProps['modeToggles'];
  activeManualMode: Mode | null;
  handleComposerModeToggle: (mode: Mode | null) => void;
  composerWorkflowNotice: string | null;
  pendingGenerations: ComposerProps['pendingGenerations'];
  handleAssetAdd: NonNullable<ComposerProps['onAssetAdd']>;
  handlePrepareVideoExcerpt: NonNullable<ComposerProps['onPrepareVideoExcerpt']>;
  handleVideoExcerptEditorChange: NonNullable<ComposerProps['onVideoExcerptEditorChange']>;
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
  sourceAccount = null,
  localDraftPreview: candidateDraftControls,
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
  isSubmitting,
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
  referenceAuthAction,
  uiLocale,
  composerModeToggles,
  activeManualMode,
  handleComposerModeToggle,
  composerWorkflowNotice,
  pendingGenerations,
  handleAssetAdd,
  handlePrepareVideoExcerpt,
  handleVideoExcerptEditorChange,
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
  const localDraftPreview = candidateDraftControls?.available ? candidateDraftControls : undefined;
  const draftCopy = getSeedanceDraftCopy(uiLocale);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const klingO3AssetState = useMemo(
    () => getKlingO3AssetState({ inputAssets, klingElements }),
    [inputAssets, klingElements]
  );
  const klingO3VideoToVideoSupported = supportsKlingO3VideoToVideo(selectedEngine);
  const klingO3VideoReferenceDisabledReason =
    isUnifiedKlingO3 && !klingO3VideoToVideoSupported ? KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE : null;
  const showFlux3MaxKeyframeEditor = selectedEngine.id.startsWith('flux-3') && submissionMode === 'ref2v';
  const showLumaRay32KeyframeEditor = selectedEngine.id === 'luma-ray-3-2' && submissionMode === 'v2v';
  const showOmniStudioPanel = selectedEngine.id === 'gemini-omni-flash';
  const isKlingV4 = selectedEngine.id === 'kling-v4';
  const klingV4Error = useMemo(() => {
    if (!isKlingV4) return null;
    const elements = buildKlingElementsPayload({
      selectedEngineId: selectedEngine.id, supportsKlingV3Controls, submissionMode, klingElements,
    });
    if (!elements.ok) return elements.message;
    if (!multiPromptActive && (!Number.isInteger(form.durationSec) || form.durationSec < 3 || form.durationSec > 30)) {
      return 'Kling 4.0 output duration must be 3–30 whole seconds.';
    }
    return getWorkspaceKlingV4MediaError({ mode: submissionMode, inputAssets, klingElements });
  }, [isKlingV4, selectedEngine.id, supportsKlingV3Controls, submissionMode, klingElements, multiPromptActive, form.durationSec, inputAssets]);
  const activeKlingV4Fields = isKlingV4 ? Object.keys(getWorkspaceKlingV4ActiveAssets(submissionMode, inputAssets)) : [];
  const hasInactiveKlingV4Media = isKlingV4 && (
    Object.entries(inputAssets).some(([field, assets]) => !activeKlingV4Fields.includes(field) && assets.some(Boolean)) ||
    ((submissionMode === 't2v' || submissionMode === 'i2v') && klingElements.some((element) => element.frontal || element.video || element.references.some(Boolean)))
  );
  const showMultiPrompt = supportsWorkspaceMultiPrompt(selectedEngine, submissionMode);
  const hdrFieldEntry = useMemo(
    () =>
      inputSchemaSummary.secondaryFields.find(({ field }) => field.id === HDR_FIELD_ID) ??
      inputSchemaSummary.promotedFields.find(({ field }) => field.id === HDR_FIELD_ID) ??
      null,
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );

  const composerAssetFields = useMemo(() => getWorkspaceReferenceFields(inputSchemaSummary.assetFields, {
    inputAssets, isUnifiedSeedance, isUnifiedKlingO3, klingO3VideoToVideoSupported,
    hasAnyVideoInput: klingO3AssetState.hasAnyVideoInput, guestUploadLockedReason, workflowCopy,
    showOmniStudioPanel, showLumaRay32KeyframeEditor, showFlux3MaxKeyframeEditor,
    previousInteractionId: form.extraInputValues.previous_interaction_id,
  }).map((entry) => ({ ...entry,
    guidance: isUnifiedSeedance && shouldShowSeedanceReferenceGuidance(entry.field)
      ? getSeedanceReferenceGuidance(uiLocale) : entry.guidance,
  })), [inputSchemaSummary.assetFields, inputAssets, isUnifiedSeedance, isUnifiedKlingO3,
    klingO3VideoToVideoSupported, klingO3AssetState.hasAnyVideoInput, guestUploadLockedReason,
    workflowCopy, showOmniStudioPanel, showLumaRay32KeyframeEditor, showFlux3MaxKeyframeEditor, uiLocale, form.extraInputValues.previous_interaction_id]);

  const settingsCaps = localDraftPreview?.selected
    ? { ...capability, modes: capability?.modes ?? [submissionMode], resolution: ['480p'], resolutionLocked: true }
    : capability;
  const draftSettingsLocked = Boolean(localDraftPreview?.selected && localDraftPreview.phase !== 'setup');
  const omniExtraFields = useMemo(
    () => [...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields],
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );
  const advancedFields = useMemo(() => {
    const shouldHideInlineField = (field: EngineInputField) =>
      field.id === 'source_job_id' ||
      Boolean(hdrFieldEntry && field.id === hdrFieldEntry.field.id) ||
      (showMultiPrompt && field.id === 'multi_prompt') ||
      (showOmniStudioPanel && OMNI_CUSTOM_FIELD_IDS.has(field.id)) ||
      (showFlux3MaxKeyframeEditor && field.id === 'keyframe_indexes');
    if (!showLumaRay32KeyframeEditor) {
      return inputSchemaSummary.secondaryFields.filter(({ field }) => !shouldHideInlineField(field));
    }
    return inputSchemaSummary.secondaryFields.filter(
      ({ field }) => !LUMA_RAY32_MODIFY_ADVANCED_FIELD_IDS.has(field.id) && !shouldHideInlineField(field)
    );
  }, [hdrFieldEntry, inputSchemaSummary.secondaryFields, showLumaRay32KeyframeEditor, showFlux3MaxKeyframeEditor, showMultiPrompt, showOmniStudioPanel]);

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

  const inheritsSourceVideo = selectedEngine.modeAvailability?.[submissionMode]?.inheritsSourceVideo === true;
  const inheritedSource = useMemo(() => {
    if (!inheritsSourceVideo) return undefined;
    const source = inputAssets.video_url?.find(asset => asset?.kind === 'video' && asset.status === 'ready');
    try { return source ? resolveSeedanceEditSourceFacts(source) : undefined; } catch { return undefined; }
  }, [inheritsSourceVideo, inputAssets.video_url]);
  const durationSec = inheritedSource?.billedDurationSec ?? (multiPromptActive ? multiPromptTotalSec : form.durationSec);
  const durationManagedLabel = inheritsSourceVideo ? seedanceEditSourceLabel(inheritedSource, uiLocale)
    : `Duration managed by multi-prompt · ${multiPromptTotalSec}s`;
  const audioControlNote = voiceControlEnabled ? 'Audio locked by voice control' : undefined;
  const showLoopControl = supportsModeLoopControl(selectedEngine, submissionMode);
  const showOptionsControl = Boolean(
    showLoopControl ||
    supportsKlingV3Controls ||
    supportsKlingV3VoiceControl ||
    isSeedance ||
    showSafetyCheckerControl ||
    selectedEngine.params?.promptStrength ||
    selectedEngine.params?.guidance ||
    (submissionMode === 'i2v' && selectedEngine.params?.initInfluence) ||
    supportsVideoCfgScaleControl(selectedEngine, submissionMode) ||
    advancedFields.length
  );
  const showKlingElementsBuilder =
    (isKlingV4 && (submissionMode === 'ref2v' || submissionMode === 'v2v')) ||
    (supportsKlingV3Controls && (isUnifiedKlingO3 || activeMode === 'i2v' || activeMode === 'ref2v'));
  const showExtraFields = Boolean(
    klingV4Error || showLumaRay32KeyframeEditor || showFlux3MaxKeyframeEditor ||
    showOmniStudioPanel ||
    showRetakeWorkflowAction ||
    (showOptionsControl && optionsOpen)
  );
  const modeUnavailableMessage = getEngineModeUnavailableMessage(selectedEngine, submissionMode, uiLocale);
  const ownedGenerationRequired = (selectedEngine.id === 'luma-ray-3-2' && submissionMode === 'extend') || form.operation === 'flux-draft-enhance';
  const quoteUnavailable = !isEngineModeQuoteReady(selectedEngine, submissionMode, preflight)
    || (ownedGenerationRequired && (!form.extraInputValues.source_job_id || preflight?.ok !== true));
  const automaticPricingNote = getSeedanceAutomaticPricingNote({ engineId: selectedEngine.id, mode: submissionMode,
    durationOption: form.durationOption, aspectRatio: form.aspectRatio, locale: uiLocale, inheritsSourceVideo });
  const resolvedWorkflowNotice = modeUnavailableMessage ?? klingO3UnsupportedVideoReason
    ?? ([composerWorkflowNotice, automaticPricingNote, hasInactiveKlingV4Media ? 'Media from other modes stays saved. Only this mode’s references will be used.' : null].filter(Boolean).join(' ') || undefined);

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
      <Composer
        density="workspace"
        engine={selectedEngine}
        caps={capability}
        prompt={selectedEngine.activeVideoOperation && !inputSchemaSummary.promptField ? '' : prompt}
        onPromptChange={setPrompt}
        negativePrompt={negativePrompt}
        onNegativePromptChange={setNegativePrompt}
        price={price}
        currency={currency}
        isLoading={isSubmitting}
        isPricing={isPricing}
        pendingGenerations={pendingGenerations}
        error={preflightError}
        messages={preflight?.ok ? preflight.messages : undefined}
        textareaRef={composerRef}
        onGenerate={startRender}
        generateLabel={localDraftPreview?.selected ? draftSettingsLocked ? draftCopy.generated : 'Draft 480p' : undefined}
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
        referenceAuthAction={referenceAuthAction}
        assets={composerAssets}
        onAssetAdd={handleAssetAdd}
        onPrepareVideoExcerpt={handlePrepareVideoExcerpt}
        onVideoExcerptEditorChange={handleVideoExcerptEditorChange}
        onAssetRemove={handleAssetRemove}
        onNotice={showNotice}
        onOpenLibrary={handleOpenAssetLibrary}
        multiPrompt={
          showMultiPrompt
            ? {
                enabled: multiPromptEnabled,
                scenes: multiPromptScenes,
                totalDurationSec: multiPromptTotalSec,
                minDurationSec: MULTI_PROMPT_MIN_SEC,
                maxDurationSec: isKlingV4 ? 30 : MULTI_PROMPT_MAX_SEC,
                minSceneDurationSec: isKlingV4 ? 1 : undefined,
                strictIntegerDurations: isKlingV4,
                maxPromptChars: KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
                onToggle: setMultiPromptEnabled,
                onAddScene: handleMultiPromptAddScene,
                onRemoveScene: handleMultiPromptRemoveScene,
                onUpdateScene: handleMultiPromptUpdateScene,
                error: multiPromptError,
              }
            : null
        }
        disableGenerate={Boolean(klingV4Error) || Boolean(modeUnavailableMessage) || quoteUnavailable || draftSettingsLocked || multiPromptInvalid || audioWorkflowUnsupported || Boolean(klingO3UnsupportedVideoReason)}
        beforeAssets={<>
            <VideoOperationSelector locale={uiLocale} engine={selectedEngine} mode={submissionMode} form={form} setForm={setForm} />
            {ownedGenerationRequired ?
              <OwnedGenerationSourcePicker key={`${sourceAccount?.userId ?? ''}:${form.operation ?? 'luma-extend'}`} account={sourceAccount}
                operation={form.operation === 'flux-draft-enhance' ? 'flux-draft-enhance' : 'luma-extend'} locale={uiLocale}
                sourceJobId={String(form.extraInputValues.source_job_id ?? '')}
                onSelect={source => setForm(current => current ? {...current,extraInputValues:{...current.extraInputValues,
                  source_job_id:source?.sourceJobId ?? '',source_output_id:source?.sourceOutputId ?? ''}} : current)} /> : null}
            {showLumaRay32KeyframeEditor || showFlux3MaxKeyframeEditor ? (
              <LumaRay32KeyframeEditor
                uiLocale={uiLocale}
                engine={selectedEngine}
                caps={capability}
                form={form}
                setForm={setForm}
                assetFields={inputSchemaSummary.assetFields}
                inputAssets={inputAssets}
                onAssetAdd={handleAssetAdd}
                onPrepareVideoExcerpt={handlePrepareVideoExcerpt}
                onVideoExcerptEditorChange={handleVideoExcerptEditorChange}
                onAssetRemove={handleAssetRemove}
                onOpenLibrary={handleOpenAssetLibrary}
                onNotice={showNotice}
                disabledReason={guestUploadLockedReason}
              />
            ) : null}
        </>}
        subjectReferences={showKlingElementsBuilder ? {
          hasSubjects: klingElements.length > 1 || klingElements.some(element => Boolean(element.frontal || element.video || element.references.some(Boolean))),
          content: <KlingElementsBuilder
            elements={klingElements}
            variant={isKlingV4 ? submissionMode === 'v2v' ? 'kling-v4-edit' : 'kling-v4-reference' : 'legacy'}
            onAddElement={handleKlingElementAdd}
            onRemoveElement={handleKlingElementRemove}
            onAddAsset={handleKlingElementAssetAdd}
            onRemoveAsset={handleKlingElementAssetRemove}
            onOpenLibrary={handleOpenKlingAssetLibrary}
            videoReferenceDisabledReason={klingO3VideoReferenceDisabledReason}
          />,
        } : undefined}
        extraFields={showExtraFields ? (
          <>
            {klingV4Error ? <p role="alert" className="text-xs text-error">{klingV4Error}</p> : null}
            {showOmniStudioPanel ? (
              <OmniStudioPanel
                form={form}
                setForm={setForm}
                submissionMode={submissionMode}
                extraFields={omniExtraFields}
                inputAssets={inputAssets}
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
            <fieldset disabled={draftSettingsLocked} className="min-w-0">
              <SettingsControls
                advancedOpen={showOptionsControl && optionsOpen}
                engine={selectedEngine}
                caps={settingsCaps}
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
                durationManaged={multiPromptActive || inheritsSourceVideo}
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
            </fieldset>
          </>
        ) : undefined}
        optionsControl={showOptionsControl ? <WorkspaceOptionsButton open={optionsOpen} onToggle={() => setOptionsOpen((value) => !value)} /> : undefined}
        settingsNotice={localDraftPreview ? (
          <div className="mt-2 border-t border-hairline pt-2">
            <SeedanceDraftLocalPreviewMode preview={localDraftPreview} locale={uiLocale} />
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {localDraftPreview.selected
                ? draftSettingsLocked
                  ? draftCopy.locked
                  : draftCopy.selected
                : draftCopy.inactive}
            </p>
            {!localDraftPreview.live ? <p className="mt-1 text-[10px] text-text-muted">{draftCopy.prototype}</p> : null}
          </div>
        ) : undefined}
        settingsBar={ownedGenerationRequired && !form.extraInputValues.source_job_id ? undefined : (
          <>
            <fieldset disabled={draftSettingsLocked} className="contents [&>div]:contents" title={draftSettingsLocked ? draftCopy.lockTitle : undefined}>
              <CoreSettingsBar
                density="workspace"
                engine={selectedEngine}
                mode={submissionMode}
                caps={settingsCaps}
                durationSec={durationSec}
                durationOption={form.durationOption ?? null}
                onDurationChange={handleDurationChange}
                numFrames={form.numFrames ?? undefined}
                onNumFramesChange={handleFramesChange}
                resolution={form.resolution}
                resolutionDisplayLabel={localDraftPreview?.selected ? 'Draft 480p 🔒' : undefined}
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
                durationManaged={multiPromptActive || inheritsSourceVideo}
                durationManagedLabel={durationManagedLabel}
              />
            </fieldset>
          </>
        )}
        generateControl={
          <fieldset disabled={localDraftPreview?.selected} className="contents" title={localDraftPreview?.selected ? 'Un seul Draft à la fois' : undefined}>
            <CoreIterationsControl
              density="workspace"
              iterations={form.iterations}
              onIterationsChange={handleIterationsChange}
              action
            />
          </fieldset>
        }
      />
    </>
  );
}
