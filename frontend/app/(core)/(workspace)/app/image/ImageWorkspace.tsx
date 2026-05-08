'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ImageGenerationMode } from '@/types/image-generation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { FEATURES } from '@/content/feature-flags';
import { clampRequestedImageCount } from '@/lib/image/inputSchema';
import {
  parseGptImage2SizeKey,
} from '@/lib/image/gptImage2';
import { ImageAuthGateModal } from './_components/ImageAuthGateModal';
import { ImageLibraryModal } from './_components/ImageLibraryModal';
import { ImageWorkspaceComposerSurface } from './_components/ImageWorkspaceComposerSurface';
import { ImageWorkspaceGalleryRail } from './_components/ImageWorkspaceGalleryRail';
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
import {
  DEFAULT_COPY,
  mergeCopy,
  type ImageWorkspaceCopy,
} from './_lib/image-workspace-copy';
import {
  type HistoryEntry,
  type ImageEngineOption,
} from './_lib/image-workspace-types';

export type { ImageEngineOption } from './_lib/image-workspace-types';

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
}

export default function ImageWorkspace({ engines }: ImageWorkspaceProps) {
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawCopy = t('workspace.image', DEFAULT_COPY);
  const resolvedCopy = useMemo<ImageWorkspaceCopy>(() => {
    return mergeCopy(DEFAULT_COPY, (rawCopy ?? {}) as Partial<ImageWorkspaceCopy>);
  }, [rawCopy]);
  const loginRedirectTarget = useMemo(() => {
    const params = searchParams?.toString() ?? '';
    const base = pathname ?? '/app/image';
    return params ? `${base}?${params}` : base;
  }, [pathname, searchParams]);
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
  const [maskUrl, setMaskUrl] = useState<string>('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<string | null>(null);
  const [limitGenerations, setLimitGenerations] = useState(false);
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [selectedPreviewEntryId, setSelectedPreviewEntryId] = useState<string | null>(null);
  const [selectedPreviewImageIndex, setSelectedPreviewImageIndex] = useState(0);
  const isDesktopLayout = useImageWorkspaceDesktopLayout();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const {
    closeViewer,
    handleOpenHistoryEntry,
    handleSaveVariantToLibrary,
    viewerGroup,
  } = useImageWorkspaceViewer();
  const engineCapsList = useMemo(() => engines.map((engine) => engine.engineCaps), [engines]);
  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const autoModeFromReferences = Boolean(
    selectedEngine && selectedEngine.modes.includes('t2i') && selectedEngine.modes.includes('i2i')
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;
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
    showThinkingLevelControl,
    supportedReferenceFormats,
    supportedReferenceFormatsLabel,
    thinkingLevelField,
    thinkingLevelSelectOptions,
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
    setThinkingLevel,
  });
  const {
    canCollapseReferenceSlots,
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
    referenceToggleLabel,
    selectedCharacterReferences,
    setAreReferenceSlotsExpanded,
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
  const {
    pricingError,
    pricingSnapshot,
  } = useImageWorkspacePricing({
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
  const {
    historyEntries,
    isImageJob,
    mutateJobs,
    pendingGroups,
    setPendingGroups,
  } = useImageWorkspaceHistory({ engines, localHistory });

  const referenceNoteText = resolvedCopy.composer.referenceNote;

  useEffect(() => {
    if (!selectedEngine || !autoModeFromReferences) return;
    const desiredMode: ImageGenerationMode =
      hasAnyReferenceSelection && selectedEngine.modes.includes('i2i')
        ? 'i2i'
        : selectedEngine.modes.includes('t2i')
          ? 't2i'
          : (selectedEngine.modes[0] as ImageGenerationMode);
    if (mode !== desiredMode) {
      setMode(desiredMode);
    }
  }, [autoModeFromReferences, hasAnyReferenceSelection, mode, selectedEngine]);

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
    maskUrl,
    enableWebSearch,
    thinkingLevel,
    limitGenerations,
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
    setMaskUrl,
    setEnableWebSearch,
    setThinkingLevel,
    setLimitGenerations,
    setReferenceSlots,
  });

  const { applyImageSettingsSnapshot } = useImageWorkspaceQueryHydration({
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
    setSelectedPreviewEntryId,
    setSelectedPreviewImageIndex,
    setStatusMessage,
    setThinkingLevel,
  });

  const setNumImagesPreset = useCallback((value: number) => {
    setNumImages(clampRequestedImageCount(selectedEngineCaps ?? null, mode, value));
  }, [selectedEngineCaps, mode]);

  const setResolutionPreset = useCallback((value: string) => {
    setResolution(value);
    const parsedSize = parseGptImage2SizeKey(value);
    if (parsedSize) {
      setCustomImageWidth(String(parsedSize.width));
      setCustomImageHeight(String(parsedSize.height));
    }
  }, []);

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
    hasThinkingLevelField: Boolean(thinkingLevelField),
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
    setAuthModalOpen,
    setError,
    setLocalHistory,
    setPendingGroups,
    setSelectedPreviewEntryId,
    setSelectedPreviewImageIndex,
    setStatusMessage,
    thinkingLevel,
  });

  const handleSelectGalleryGroup = useImageGallerySelection({
    applyImageSettingsSnapshot,
    engines,
    historyEntries,
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
    previewEntry,
    removedFromLibraryMessage: t(
      'workspace.image.messages.removedFromLibrary',
      DEFAULT_COPY.messages.removedFromLibrary
    ) as string,
    savedToLibraryMessage: t(
      'workspace.image.messages.savedToLibrary',
      DEFAULT_COPY.messages.savedToLibrary
    ) as string,
    selectedPreviewImageIndex,
    setError,
    setStatusMessage,
  });

  const advancedSettingsTitle = t('workspace.generate.controls.advancedTitle', 'Advanced settings') as string;
  const {
    composerReferenceAssets,
    referenceAssetFields,
  } = useImageWorkspaceReferenceAssets({
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

  if (!selectedEngine || !selectedEngineCaps) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
        {resolvedCopy.general.emptyEngines}
      </main>
    );
  }

  return (
    <>
      <div className={clsx('flex w-full flex-1 min-w-0', isDesktopLayout ? 'flex-row' : 'flex-col')}>
        <div className="flex w-full flex-1 min-w-0 flex-col overflow-hidden">
          <main className="flex w-full flex-1 min-w-0 flex-col gap-[var(--stack-gap-lg)] p-4 sm:p-6">
            <ImageWorkspaceComposerSurface
              advancedSettingsTitle={advancedSettingsTitle}
              aspectRatio={aspectRatio}
              aspectRatioSelectOptions={aspectRatioSelectOptions}
              booleanSelectOptions={booleanSelectOptions}
              canCollapseReferenceSlots={canCollapseReferenceSlots}
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
              handleOpenHistoryEntry={handleOpenHistoryEntry}
              handleReferenceFile={handleReferenceFile}
              handleReferenceUrl={handleReferenceUrl}
              handleRemoveFromLibrary={handleRemoveFromLibrary}
              handleRemoveReferenceSlot={handleRemoveReferenceSlot}
              handleRun={handleRun}
              imageCountOptions={imageCountOptions}
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
              referenceToggleLabel={referenceToggleLabel}
              resolution={resolution}
              resolutionSelectOptions={resolutionSelectOptions}
              resolvedCopy={resolvedCopy}
              seed={seed}
              selectedEngineCaps={selectedEngineCaps}
              selectedEngineId={selectedEngine.id}
              selectedPreviewImageIndex={selectedPreviewImageIndex}
              setAreReferenceSlotsExpanded={setAreReferenceSlotsExpanded}
              setAspectRatio={setAspectRatio}
              setCustomImageHeight={setCustomImageHeight}
              setCustomImageWidth={setCustomImageWidth}
              setEnableWebSearch={setEnableWebSearch}
              setEngineId={setEngineId}
              setError={setError}
              setLimitGenerations={setLimitGenerations}
              setMaskUrl={setMaskUrl}
              setMode={setMode}
              setNumImagesPreset={setNumImagesPreset}
              setOutputFormat={setOutputFormat}
              setPrompt={setPrompt}
              setQuality={setQuality}
              setResolutionPreset={setResolutionPreset}
              setSeed={setSeed}
              setSelectedPreviewImageIndex={setSelectedPreviewImageIndex}
              setThinkingLevel={setThinkingLevel}
              showAspectRatioControl={showAspectRatioControl}
              showCustomImageSizeControl={showCustomImageSizeControl}
              showEnableWebSearchControl={showEnableWebSearchControl}
              showLimitGenerationsControl={showLimitGenerationsControl}
              showMaskUrlControl={Boolean(maskUrlField)}
              showNumImagesControl={showNumImagesControl}
              showOutputFormatControl={showOutputFormatControl}
              showQualityControl={showQualityControl}
              showResolutionControl={showResolutionControl}
              showSeedControl={showSeedControl}
              showThinkingLevelControl={showThinkingLevelControl}
              statusMessage={statusMessage}
              thinkingLevel={thinkingLevel}
              thinkingLevelSelectOptions={thinkingLevelSelectOptions}
            />
          </main>
        </div>
        {isDesktopLayout ? (
          <ImageWorkspaceGalleryRail
            activeGroups={pendingGroups}
            engineCapsList={engineCapsList}
            isImageJob={isImageJob}
            onOpenGroup={handleSelectGalleryGroup}
            selectedEngineCaps={selectedEngineCaps}
            variant="desktop"
          />
        ) : null}
      </div>
      {!isDesktopLayout ? (
        <ImageWorkspaceGalleryRail
          activeGroups={pendingGroups}
          engineCapsList={engineCapsList}
          isImageJob={isImageJob}
          onOpenGroup={handleSelectGalleryGroup}
          selectedEngineCaps={selectedEngineCaps}
          variant="mobile"
        />
      ) : null}
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={closeViewer}
          onSaveToLibrary={handleSaveVariantToLibrary}
        />
      ) : null}
      <ImageAuthGateModal
        open={authModalOpen}
        copy={resolvedCopy.authGate}
        loginRedirectTarget={loginRedirectTarget}
        onClose={() => setAuthModalOpen(false)}
      />
      {libraryModal.open ? (
        <ImageLibraryModal
          open={libraryModal.open}
          onClose={closeLibraryModal}
          onSelect={handleLibrarySelect}
          onToggleCharacter={toggleCharacterReference}
          selectedCharacterReferences={selectedCharacterReferences}
          characterSelectionLimit={characterSelectionLimit}
          copy={resolvedCopy.library}
          characterCopy={resolvedCopy.characterPicker}
          selectionMode={libraryModal.selectionMode}
          initialSource={libraryModal.initialSource}
          supportedFormats={supportedReferenceFormats}
          supportedFormatsLabel={supportedReferenceFormatsLabel}
          toolsEnabled={toolsEnabled}
        />
      ) : null}
    </>
  );
}
