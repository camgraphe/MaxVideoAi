'use client';
import { useCallback, useMemo, useState } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';
import { ImageMediaHandoff } from './_components/ImageMediaHandoff.client';
import { ImageWorkspaceComposerSurface } from './_components/ImageWorkspaceComposerSurface';
import { ImageWorkspaceEmptyState, ImageWorkspaceLoadingState } from './_components/ImageWorkspaceEmptyState';
import { ImageWorkspaceRuntimeModals } from './_components/ImageWorkspaceRuntimeModals';
import { ImageWorkspaceShell } from './_components/ImageWorkspaceShell';
import { useImageWorkspaceDisplayState } from './_hooks/useImageWorkspaceDisplayState';
import { useImageGallerySelection } from './_hooks/useImageGallerySelection';
import { useImageGenerationRunner } from './_hooks/useImageGenerationRunner';
import { useImageWorkspaceHistory } from './_hooks/useImageWorkspaceHistory';
import { useImageModelPicker } from './_hooks/useImageModelPicker';
import { useImageWorkspacePricing } from './_hooks/useImageWorkspacePricing';
import { useImageSettingsFields } from './_hooks/useImageSettingsFields';
import { useImageWorkspaceDesktopLayout } from './_hooks/useImageWorkspaceDesktopLayout';
import { useImagePreviewActions } from './_hooks/useImagePreviewActions';
import { useImageWorkspaceQueryHydration } from './_hooks/useImageWorkspaceQueryHydration';
import { useImageReferenceSlots } from './_hooks/useImageReferenceSlots';
import { useImageComposerPersistence } from './_hooks/useImageComposerPersistence';
import { useImageWorkspaceReferenceAssets } from './_hooks/useImageWorkspaceReferenceAssets';
import { useImageWorkspaceViewer } from './_hooks/useImageWorkspaceViewer';
import { useImageWorkspaceRouteContext } from './_hooks/useImageWorkspaceRouteContext';
import { useImageWorkspaceModeSync } from './_hooks/useImageWorkspaceModeSync';
import { useImageWorkspacePresetHandlers } from './_hooks/useImageWorkspacePresetHandlers';
import { useImageWorkspaceSelectedEngine } from './_hooks/useImageWorkspaceSelectedEngine';
import { useImageReferenceAwareImageCounts } from './_hooks/useImageReferenceAwareImageCounts';
import { type HistoryEntry, type ImageEngineOption } from './_lib/image-workspace-types';

export type { ImageEngineOption } from './_lib/image-workspace-types';

type ImageWorkspaceProps = { accountId: string | null; engines: ImageEngineOption[] };

export default function ImageWorkspace({ engines, accountId }: ImageWorkspaceProps) {
  const { advancedSettingsTitle, loginRedirectTarget, resolvedCopy, searchParams, toolsEnabled } = useImageWorkspaceRouteContext();
  const [engineId, setEngineId] = useState(() => engines[0]?.id ?? '');
  const [mode, setMode] = useState<ImageGenerationMode>('t2i');
  const [prompt, setPrompt] = useState('');
  const [numImages, setNumImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [customImageWidth, setCustomImageWidth] = useState<string>('');
  const [customImageHeight, setCustomImageHeight] = useState<string>('');
  const [seed, setSeed] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [maskUrl, setMaskUrl] = useState<string>('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<string | null>(null);
  const [limitGenerations, setLimitGenerations] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [selectedPreviewEntryId, setSelectedPreviewEntryId] = useState<string | null>(null);
  const [selectedPreviewImageIndex, setSelectedPreviewImageIndex] = useState(0);
  const isDesktopLayout = useImageWorkspaceDesktopLayout();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { closeViewer, handleOpenHistoryEntry, handleSaveVariantToLibrary, viewerGroup } = useImageWorkspaceViewer();
  const { autoModeFromReferences, engineCapsList, selectedEngine, selectedEngineCaps } = useImageWorkspaceSelectedEngine(engines, engineId);
  const {
    aspectRatioField,
    aspectRatioSelectOptions,
    booleanSelectOptions,
    backgroundField,
    backgroundSelectOptions,
    enableWebSearchField,
    imageCountOptions,
    isResolutionLocked,
    limitGenerationsField,
    maskUrlField,
    outputFormatField,
    outputFormatSelectOptions,
    qualityField,
    qualitySelectOptions,
    resolutionSelectOptions,
    seedField,
    showAspectRatioControl,
    showBackgroundControl,
    showCustomImageSizeControl,
    showEnableWebSearchControl,
    showLimitGenerationsControl,
    showNumImagesControl,
    showOutputFormatControl,
    showQualityControl,
    showResolutionControl,
    showSeedControl,
    showStyleControl,
    showThinkingLevelControl,
    supportedReferenceFormats,
    supportedReferenceFormatsLabel,
    styleField,
    styleSelectOptions,
    thinkingLevelField,
    thinkingLevelSelectOptions,
    watermarkField,
    showWatermarkControl,
  } = useImageSettingsFields({
    mode,
    resolution,
    resolvedCopy,
    selectedEngineCaps,
    setAspectRatio,
    setBackground,
    setCustomImageHeight,
    setCustomImageWidth,
    setEnableWebSearch,
    setLimitGenerations,
    setMaskUrl,
    setNumImages,
    setOutputFormat,
    setQuality,
    setResolution,
    setSeed,
    setStyle,
    setThinkingLevel,
    setWatermark,
  });
  const {
    characterSelectionLimit,
    closeLibraryModal,
    combinedReferenceUrls,
    displayedReferenceSlotCount,
    displayedReferenceSlots,
    handleLibrarySelect,
    handleReferenceFile,
    handleReferenceUrl,
    handleRemoveReferenceSlot,
    hasAnyReferenceSelection,
    libraryModal,
    openCharacterLibrary,
    openLibraryForSlot,
    persistableReferenceSlots,
    readyReferenceSizes,
    readyReferenceUrls,
    referenceHelperText,
    referenceMinRequired,
    referenceSizeSignature,
    referenceSlotLimit,
    selectedReferenceCount,
    selectedCharacterReferences,
    setReferenceSlots,
    supportsCharacterReferences,
    toggleCharacterReference,
  } = useImageReferenceSlots({
    accountId,
    autoModeFromReferences,
    mode,
    resolvedCopy,
    selectedEngineCaps,
    setError,
    supportedReferenceFormats,
    supportedReferenceFormatsLabel,
    toolsEnabled,
  });
  const { pricingError, pricingSnapshot } = useImageWorkspacePricing({
    aspectRatio,
    referenceImageCount: combinedReferenceUrls.length,
    customImageHeight,
    customImageWidth,
    enableWebSearch,
    mode,
    numImages,
    quality,
    readyReferenceSizes,
    referenceSizeSignature,
    resolution,
    selectedEngineId: selectedEngine?.id,
  });
  const { historyEntries, isImageJob, mutateJobs, pendingGroups, setPendingGroups } = useImageWorkspaceHistory({
    engines,
    localHistory,
  });
  const referenceNoteText = resolvedCopy.composer.referenceNote;

  useImageWorkspaceModeSync({
    autoModeFromReferences,
    hasAnyReferenceSelection,
    mode,
    selectedEngine,
    setMode,
  });

  const { storageHydrated } = useImageComposerPersistence({
    accountId,
    engines,
    engineId,
    mode,
    prompt,
    numImages,
    aspectRatio,
    background,
    resolution,
    customImageWidth,
    customImageHeight,
    seed,
    outputFormat,
    quality,
    style,
    maskUrl,
    enableWebSearch,
    thinkingLevel,
    limitGenerations,
    watermark,
    persistableReferenceSlots,
    setEngineId,
    setMode,
    setPrompt,
    setNumImages,
    setAspectRatio,
    setBackground,
    setResolution,
    setCustomImageWidth,
    setCustomImageHeight,
    setSeed,
    setOutputFormat,
    setQuality,
    setStyle,
    setMaskUrl,
    setEnableWebSearch,
    setThinkingLevel,
    setLimitGenerations,
    setWatermark,
    setReferenceSlots,
  });

  const { applyImageSettingsSnapshot, librarySource } = useImageWorkspaceQueryHydration({
    engines,
    genericError: resolvedCopy.errors.generic,
    searchParams,
    setAspectRatio,
    setBackground,
    setCustomImageHeight,
    setCustomImageWidth,
    setEnableWebSearch,
    setEngineId,
    setError,
    setLimitGenerations,
    setMaskUrl,
    setMode,
    setNumImages,
    setOutputFormat,
    setPrompt,
    setQuality,
    setReferenceSlots,
    setResolution,
    setSeed,
    setStyle,
    setSelectedPreviewEntryId,
    setSelectedPreviewImageIndex,
    setStatusMessage,
    setThinkingLevel,
    setWatermark,
  });

  const handleEditSelectedPreview = useCallback(
    (url: string) => {
      handleReferenceUrl(0, url, 'library');
      setMode(selectedEngine?.modes.includes('i2i') ? 'i2i' : selectedEngine?.modes[0] ?? 't2i');
      setPrompt('');
      setError(null);
      setStatusMessage(null);
    },
    [handleReferenceUrl, selectedEngine?.modes, setMode, setPrompt]
  );

  const { setNumImagesPreset, setResolutionPreset } = useImageWorkspacePresetHandlers({
    mode,
    selectedEngineCaps,
    setCustomImageHeight,
    setCustomImageWidth,
    setNumImages,
    setResolution,
  });
  const { effectiveImageCountOptions, setReferenceAwareNumImagesPreset } = useImageReferenceAwareImageCounts({
    imageCountOptions,
    referenceCount: selectedReferenceCount,
    resolvedCopy,
    selectedEngineId: selectedEngine?.id,
    setNumImages,
    setNumImagesPreset,
  });

  const handleRun = useImageGenerationRunner({
    pricingSnapshot,
    aspectRatio,
    background,
    combinedReferenceUrls,
    customImageHeight,
    customImageWidth,
    enableWebSearch,
    hasAspectRatioField: Boolean(aspectRatioField),
    hasBackgroundField: Boolean(backgroundField),
    hasEnableWebSearchField: Boolean(enableWebSearchField),
    hasLimitGenerationsField: Boolean(limitGenerationsField),
    hasMaskUrlField: Boolean(maskUrlField),
    hasOutputFormatField: Boolean(outputFormatField),
    hasQualityField: Boolean(qualityField),
    hasSeedField: Boolean(seedField),
    hasStyleField: Boolean(styleField),
    hasThinkingLevelField: Boolean(thinkingLevelField),
    hasWatermarkField: Boolean(watermarkField),
    limitGenerations,
    maskUrl,
    mode,
    mutateJobs,
    numImages,
    outputFormat,
    prompt,
    quality,
    readyReferenceSizes,
    readyReferenceUrls,
    referenceMinRequired,
    resolution,
    resolvedCopy,
    seed,
    selectedCharacterReferences,
    selectedEngine,
    style,
    setAuthModalOpen,
    setError,
    setLocalHistory,
    setPendingGroups,
    setSelectedPreviewEntryId,
    setSelectedPreviewImageIndex,
    setStatusMessage,
    thinkingLevel,
    watermark,
  });

  const { handleSelectGalleryGroup, guardComposerActions } = useImageGallerySelection({
    accountId,
    applyImageSettingsSnapshot,
    engines,
    historyEntries,
    onOpenHistoryEntry: handleOpenHistoryEntry,
    setAspectRatio,
    setEngineId,
    setLocalHistory,
    setMode,
    setPrompt,
    setSelectedPreviewEntryId,
    setSelectedPreviewImageIndex,
  });

  const {
    canUseWorkspace,
    composerError,
    compositePreviewEntry,
    estimatedCostAmount,
    estimatedCostCurrency,
    pendingGenerations,
    previewEntry, starterPreview, starterNavigation, selectStarter,
  } = useImageWorkspaceDisplayState({
    guestStarter: { ready: !accountId && storageHydrated && !hasAnyReferenceSelection &&
      !searchParams?.get('job') && !searchParams?.get('engine') && !searchParams?.get('tool'), prompt, setPrompt },
    error,
    historyEntries,
    numImages,
    pendingGroups,
    pricingErrorMessage: pricingError?.message ?? null,
    pricingSnapshot,
    selectedEngine,
    selectedPreviewEntryId,
    suppressDefaultPreview: librarySource === 'storyboard',
  });
  const {
    copiedUrl,
    handleAddToLibrary,
    handleCopy,
    handleDownload,
    handleRemoveFromLibrary,
    isInLibrary,
    isRemovingFromLibrary,
    isSavingToLibrary,
  } = useImagePreviewActions({
    canUseWorkspace,
    genericError: resolvedCopy.errors.generic,
    librarySource,
    previewEntry,
    removedFromLibraryMessage: resolvedCopy.messages.removedFromLibrary,
    savedToLibraryMessage: resolvedCopy.messages.savedToLibrary,
    selectedPreviewImageIndex,
    setError,
    setStatusMessage,
  });

  const { composerReferenceAssets, referenceAssetFields } = useImageWorkspaceReferenceAssets({
    displayedReferenceSlotCount,
    displayedReferenceSlots,
    mode,
    openCharacterLibrary,
    referenceHelperText,
    referenceMinRequired,
    referenceNoteText,
    referenceSlotLimit,
    resolvedCopy,
    supportsCharacterReferences,
  });
  const pickerSettings = useMemo(() => ({ mode, numImages, resolution, aspectRatio, quality, enableWebSearch, maskUrl, outputFormat, background, style, thinkingLevel, seed, limitGenerations, watermark,
    referenceIndices: displayedReferenceSlots.flatMap((slot, index) => slot ? [index] : []),
    customImageWidth, customImageHeight, referenceImageCount: combinedReferenceUrls.length, selectedReferenceCount, readyReferenceSizes }),
    [mode, numImages, resolution, aspectRatio, quality, enableWebSearch, maskUrl, outputFormat, background, style, thinkingLevel, seed, limitGenerations, watermark, displayedReferenceSlots, customImageWidth, customImageHeight, combinedReferenceUrls.length, selectedReferenceCount, readyReferenceSizes]);
  const modelPicker = useImageModelPicker({ engines: engineCapsList, engineId, accountId, settings: pickerSettings,
    apply: (id, settings) => { setEngineId(id); setResolution(settings.resolution); setAspectRatio(settings.aspectRatio);
      setQuality(settings.quality); setEnableWebSearch(settings.enableWebSearch); setNumImages(settings.numImages); setOutputFormat(settings.outputFormat); setBackground(settings.background); setStyle(settings.style);
      setThinkingLevel(settings.thinkingLevel); setSeed(settings.seed); setLimitGenerations(settings.limitGenerations); setWatermark(settings.watermark);
      setCustomImageWidth(settings.customImageWidth); setCustomImageHeight(settings.customImageHeight); } });
  const composerActionProps = guardComposerActions({
    setAspectRatio, setBackground, setCustomImageHeight, setCustomImageWidth, setEnableWebSearch, setEngineId: modelPicker.select,
    setLimitGenerations, setMaskUrl, setMode, setNumImagesPreset: setReferenceAwareNumImagesPreset, setOutputFormat,
    setPrompt, setQuality, setResolutionPreset, setSeed, setStyle, setThinkingLevel, setWatermark,
    handleEditSelectedPreview, handleReferenceFile, handleReferenceUrl, handleRemoveReferenceSlot, handleRun,
    handleLibrarySelect, toggleCharacterReference, selectStarter,
  });
  const composerVisibilityProps = {
    showAspectRatioControl, showBackgroundControl, showCustomImageSizeControl, showEnableWebSearchControl, showLimitGenerationsControl,
    showMaskUrlControl: Boolean(maskUrlField), showNumImagesControl, showOutputFormatControl, showQualityControl,
    showResolutionControl, showSeedControl, showStyleControl, showThinkingLevelControl, showWatermarkControl,
  };
  const composerSettingsProps = {
    aspectRatio, aspectRatioSelectOptions, background, backgroundSelectOptions, booleanSelectOptions,
    customImageHeight, customImageWidth, enableWebSearch, limitGenerations, maskUrl, numImages,
    outputFormat, outputFormatSelectOptions, quality, qualitySelectOptions, resolution, resolutionSelectOptions,
    seed, style, styleSelectOptions, thinkingLevel, thinkingLevelSelectOptions, watermark,
  };

  if (!storageHydrated) return <ImageWorkspaceLoadingState />;
  if (!selectedEngine || !selectedEngineCaps) {
    return <ImageWorkspaceEmptyState message={resolvedCopy.general.emptyEngines} />;
  }

  return (
    <>
      <ImageMediaHandoff modelName={selectedEngine?.name} slots={displayedReferenceSlots} limit={referenceSlotLimit} onInsert={composerActionProps.handleLibrarySelect}>
      {(recentMedia, openRecentMedia) => (
      <ImageWorkspaceShell
        recentMedia={recentMedia} onOpenRecentMedia={openRecentMedia}
        isDesktopLayout={isDesktopLayout}
        galleryRailProps={{
          activeGroups: pendingGroups,
          engineCapsList,
          isImageJob,
          onOpenGroup: handleSelectGalleryGroup,
          selectedEngineCaps,
          onSelectStarter: composerActionProps.selectStarter,
        }}
      >
        <ImageWorkspaceComposerSurface
          assistanceAccountId={accountId}
              starterPreview={starterPreview} starterNavigation={{ ...starterNavigation, ...guardComposerActions({
                onPrev: starterNavigation.onPrev, onNext: starterNavigation.onNext,
              }) }}
              advancedSettingsTitle={advancedSettingsTitle}
              composerError={composerError}
              composerReferenceAssets={composerReferenceAssets}
              compositePreviewEntry={compositePreviewEntry}
              copiedUrl={copiedUrl}
              currency={estimatedCostCurrency}
              engineCapsList={engineCapsList}
              modelPicker={modelPicker.context}
              estimatedCostAmount={estimatedCostAmount}
              handleAddToLibrary={handleAddToLibrary}
              handleCopy={handleCopy}
              handleDownload={handleDownload}
              handleOpenHistoryEntry={handleOpenHistoryEntry}
              handleRemoveFromLibrary={handleRemoveFromLibrary}
              imageCountOptions={effectiveImageCountOptions}
              pendingGenerations={pendingGenerations}
              isInLibrary={isInLibrary}
              isRemovingFromLibrary={isRemovingFromLibrary}
              isResolutionLocked={isResolutionLocked}
              isSavingToLibrary={isSavingToLibrary}
              mode={mode}
              openLibraryForSlot={openLibraryForSlot}
              previewEntry={previewEntry}
              prompt={prompt}
              referenceAssetFields={referenceAssetFields}
              resolvedCopy={resolvedCopy}
              selectedEngineCaps={selectedEngineCaps}
              selectedEngineId={selectedEngine.id}
              selectedPreviewImageIndex={selectedPreviewImageIndex}
              setError={setError} setSelectedPreviewImageIndex={setSelectedPreviewImageIndex}
              {...composerActionProps}
              {...composerSettingsProps}
              {...composerVisibilityProps}
              statusMessage={statusMessage}
        />
      </ImageWorkspaceShell>
      )}</ImageMediaHandoff>
      <ImageWorkspaceRuntimeModals
        referenceSlotLimit={referenceSlotLimit}
        authModalOpen={authModalOpen}
        characterSelectionLimit={characterSelectionLimit}
        closeLibraryModal={closeLibraryModal}
        closeViewer={closeViewer}
        handleLibrarySelect={composerActionProps.handleLibrarySelect}
        handleSaveVariantToLibrary={handleSaveVariantToLibrary}
        libraryModal={libraryModal}
        loginRedirectTarget={loginRedirectTarget}
        resolvedCopy={resolvedCopy}
        selectedCharacterReferences={selectedCharacterReferences}
        setAuthModalOpen={setAuthModalOpen}
        supportedReferenceFormats={supportedReferenceFormats}
        supportedReferenceFormatsLabel={supportedReferenceFormatsLabel}
        toggleCharacterReference={composerActionProps.toggleCharacterReference}
        toolsEnabled={toolsEnabled}
        viewerGroup={viewerGroup}
      />
    </>
  );
}
