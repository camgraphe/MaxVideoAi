'use client';

import { useCallback, useState } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';
import { ImageWorkspaceComposerSurface } from './_components/ImageWorkspaceComposerSurface';
import { ImageWorkspaceEmptyState } from './_components/ImageWorkspaceEmptyState';
import { ImageWorkspaceRuntimeModals } from './_components/ImageWorkspaceRuntimeModals';
import { ImageWorkspaceShell } from './_components/ImageWorkspaceShell';
import { useImageWorkspaceDisplayState } from './_hooks/useImageWorkspaceDisplayState';
import { useImageGallerySelection } from './_hooks/useImageGallerySelection';
import { useImageGenerationRunner } from './_hooks/useImageGenerationRunner';
import { useImageWorkspaceHistory } from './_hooks/useImageWorkspaceHistory';
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

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
}

export default function ImageWorkspace({ engines }: ImageWorkspaceProps) {
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

  useImageComposerPersistence({
    engines,
    engineId,
    mode,
    prompt,
    numImages,
    aspectRatio,
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
    aspectRatio,
    combinedReferenceUrls,
    customImageHeight,
    customImageWidth,
    enableWebSearch,
    hasAspectRatioField: Boolean(aspectRatioField),
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

  const handleSelectGalleryGroup = useImageGallerySelection({
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
    inProgressMessage,
    previewEntry,
  } = useImageWorkspaceDisplayState({
    error,
    historyEntries,
    numImages,
    pendingGroups,
    pricingErrorMessage: pricingError?.message ?? null,
    pricingSnapshot,
    resolvedCopy,
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
  const composerSetterProps = {
    setAspectRatio, setCustomImageHeight, setCustomImageWidth, setEnableWebSearch, setEngineId, setError,
    setLimitGenerations, setMaskUrl, setMode, setNumImagesPreset: setReferenceAwareNumImagesPreset, setOutputFormat,
    setPrompt, setQuality, setResolutionPreset, setSeed, setSelectedPreviewImageIndex, setStyle, setThinkingLevel,
    setWatermark,
  };
  const composerVisibilityProps = {
    showAspectRatioControl, showCustomImageSizeControl, showEnableWebSearchControl, showLimitGenerationsControl,
    showMaskUrlControl: Boolean(maskUrlField), showNumImagesControl, showOutputFormatControl, showQualityControl,
    showResolutionControl, showSeedControl, showStyleControl, showThinkingLevelControl, showWatermarkControl,
  };

  if (!selectedEngine || !selectedEngineCaps) {
    return <ImageWorkspaceEmptyState message={resolvedCopy.general.emptyEngines} />;
  }

  return (
    <>
      <ImageWorkspaceShell
        isDesktopLayout={isDesktopLayout}
        galleryRailProps={{
          activeGroups: pendingGroups,
          engineCapsList,
          isImageJob,
          onOpenGroup: handleSelectGalleryGroup,
          selectedEngineCaps,
        }}
      >
        <ImageWorkspaceComposerSurface
              advancedSettingsTitle={advancedSettingsTitle}
              aspectRatio={aspectRatio}
              aspectRatioSelectOptions={aspectRatioSelectOptions}
              booleanSelectOptions={booleanSelectOptions}
              composerError={composerError}
              composerReferenceAssets={composerReferenceAssets}
              compositePreviewEntry={compositePreviewEntry}
              copiedUrl={copiedUrl}
              currency={estimatedCostCurrency}
              customImageHeight={customImageHeight}
              customImageWidth={customImageWidth}
              enableWebSearch={enableWebSearch}
              engineCapsList={engineCapsList}
              estimatedCostAmount={estimatedCostAmount}
              handleAddToLibrary={handleAddToLibrary}
              handleCopy={handleCopy}
              handleDownload={handleDownload}
              handleEditSelectedPreview={handleEditSelectedPreview}
              handleOpenHistoryEntry={handleOpenHistoryEntry}
              handleReferenceFile={handleReferenceFile}
              handleReferenceUrl={handleReferenceUrl}
              handleRemoveFromLibrary={handleRemoveFromLibrary}
              handleRemoveReferenceSlot={handleRemoveReferenceSlot}
              handleRun={handleRun}
              imageCountOptions={effectiveImageCountOptions}
              inProgressMessage={inProgressMessage}
              isInLibrary={isInLibrary}
              isRemovingFromLibrary={isRemovingFromLibrary}
              isResolutionLocked={isResolutionLocked}
              isSavingToLibrary={isSavingToLibrary}
              limitGenerations={limitGenerations}
              maskUrl={maskUrl}
              mode={mode}
              numImages={numImages}
              openLibraryForSlot={openLibraryForSlot}
              outputFormat={outputFormat}
              outputFormatSelectOptions={outputFormatSelectOptions}
              previewEntry={previewEntry}
              prompt={prompt}
              quality={quality}
              qualitySelectOptions={qualitySelectOptions}
              referenceAssetFields={referenceAssetFields}
              resolution={resolution}
              resolutionSelectOptions={resolutionSelectOptions}
              resolvedCopy={resolvedCopy}
              seed={seed}
              selectedEngineCaps={selectedEngineCaps}
              selectedEngineId={selectedEngine.id}
              selectedPreviewImageIndex={selectedPreviewImageIndex}
              style={style}
              styleSelectOptions={styleSelectOptions}
              {...composerSetterProps}
              {...composerVisibilityProps}
              statusMessage={statusMessage}
              thinkingLevel={thinkingLevel}
              thinkingLevelSelectOptions={thinkingLevelSelectOptions}
              watermark={watermark}
        />
      </ImageWorkspaceShell>
      <ImageWorkspaceRuntimeModals
        authModalOpen={authModalOpen}
        characterSelectionLimit={characterSelectionLimit}
        closeLibraryModal={closeLibraryModal}
        closeViewer={closeViewer}
        handleLibrarySelect={handleLibrarySelect}
        handleSaveVariantToLibrary={handleSaveVariantToLibrary}
        libraryModal={libraryModal}
        loginRedirectTarget={loginRedirectTarget}
        resolvedCopy={resolvedCopy}
        selectedCharacterReferences={selectedCharacterReferences}
        setAuthModalOpen={setAuthModalOpen}
        supportedReferenceFormats={supportedReferenceFormats}
        supportedReferenceFormatsLabel={supportedReferenceFormatsLabel}
        toggleCharacterReference={toggleCharacterReference}
        toolsEnabled={toolsEnabled}
        viewerGroup={viewerGroup}
      />
    </>
  );
}
