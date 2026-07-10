'use client';

import type { FormEvent } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { Composer, type AssetFieldConfig, type ComposerAttachment } from '@/components/Composer';
import { ImageAdvancedSettings } from '@/components/ImageAdvancedSettings';
import { ImageSettingsBar } from '@/components/ImageSettingsBar';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { ImageCompositePreviewDock, type ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import { GPT_IMAGE_2_SIZE_CONSTRAINTS } from '@/lib/image/gptImage2';
import type { ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import type { HistoryEntry } from '../_lib/image-workspace-types';

type ControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface ImageWorkspaceComposerSurfaceProps {
  advancedSettingsTitle: string;
  aspectRatio: string | null;
  aspectRatioSelectOptions: ControlOption[];
  booleanSelectOptions: ControlOption[];
  composerError: string | null;
  composerReferenceAssets: Record<string, (ComposerAttachment | null)[]>;
  compositePreviewEntry: ImageCompositePreviewEntry | null;
  copiedUrl: string | null;
  currency: string;
  customImageHeight: string;
  customImageWidth: string;
  enableWebSearch: boolean;
  engineCapsList: EngineCaps[];
  estimatedCostAmount: number;
  handleAddToLibrary: (url: string) => void;
  handleCopy: (url: string) => void;
  handleDownload: (url: string) => void;
  handleEditSelectedPreview: (url: string) => void;
  handleOpenHistoryEntry: (entry: HistoryEntry) => void;
  handleReferenceFile: (slotIndex: number, file: File) => Promise<void> | void;
  handleReferenceUrl: (slotIndex: number, url: string, source: 'paste' | 'library') => void;
  handleRemoveFromLibrary: () => void;
  handleRemoveReferenceSlot: (index: number) => void;
  handleRun: (event?: FormEvent<HTMLFormElement> | null) => Promise<void> | void;
  imageCountOptions: ControlOption[];
  inProgressMessage: string | null;
  isInLibrary: boolean;
  isRemovingFromLibrary: boolean;
  isResolutionLocked: boolean;
  isSavingToLibrary: boolean;
  limitGenerations: boolean;
  maskUrl: string;
  mode: ImageGenerationMode;
  numImages: number;
  openLibraryForSlot: (slotIndex: number) => void;
  outputFormat: string | null;
  outputFormatSelectOptions: ControlOption[];
  previewEntry: HistoryEntry | undefined;
  prompt: string;
  quality: string | null;
  qualitySelectOptions: ControlOption[];
  referenceAssetFields: AssetFieldConfig[];
  resolution: string | null;
  resolutionSelectOptions: ControlOption[];
  resolvedCopy: ImageWorkspaceCopy;
  seed: string;
  selectedEngineCaps: EngineCaps;
  selectedEngineId: string;
  selectedPreviewImageIndex: number;
  style: string | null;
  styleSelectOptions: ControlOption[];
  setAspectRatio: (value: string | null) => void;
  setCustomImageHeight: (value: string) => void;
  setCustomImageWidth: (value: string) => void;
  setEnableWebSearch: (value: boolean) => void;
  setEngineId: (value: string) => void;
  setError: (value: string | null) => void;
  setLimitGenerations: (value: boolean) => void;
  setMaskUrl: (value: string) => void;
  setMode: (value: ImageGenerationMode) => void;
  setNumImagesPreset: (value: number) => void;
  setOutputFormat: (value: string | null) => void;
  setPrompt: (value: string) => void;
  setQuality: (value: string | null) => void;
  setResolutionPreset: (value: string) => void;
  setSeed: (value: string) => void;
  setSelectedPreviewImageIndex: (value: number) => void;
  setStyle: (value: string | null) => void;
  setThinkingLevel: (value: string | null) => void;
  setWatermark: (value: boolean) => void;
  showAspectRatioControl: boolean;
  showCustomImageSizeControl: boolean;
  showEnableWebSearchControl: boolean;
  showLimitGenerationsControl: boolean;
  showMaskUrlControl: boolean;
  showNumImagesControl: boolean;
  showOutputFormatControl: boolean;
  showQualityControl: boolean;
  showResolutionControl: boolean;
  showSeedControl: boolean;
  showStyleControl: boolean;
  showThinkingLevelControl: boolean;
  showWatermarkControl: boolean;
  statusMessage: string | null;
  thinkingLevel: string | null;
  thinkingLevelSelectOptions: ControlOption[];
  watermark: boolean;
}

export function ImageWorkspaceComposerSurface({
  advancedSettingsTitle,
  aspectRatio,
  aspectRatioSelectOptions,
  booleanSelectOptions,
  composerError,
  composerReferenceAssets,
  compositePreviewEntry,
  copiedUrl,
  currency,
  customImageHeight,
  customImageWidth,
  enableWebSearch,
  engineCapsList,
  estimatedCostAmount,
  handleAddToLibrary,
  handleCopy,
  handleDownload,
  handleEditSelectedPreview,
  handleOpenHistoryEntry,
  handleReferenceFile,
  handleReferenceUrl,
  handleRemoveFromLibrary,
  handleRemoveReferenceSlot,
  handleRun,
  imageCountOptions,
  inProgressMessage,
  isInLibrary,
  isRemovingFromLibrary,
  isResolutionLocked,
  isSavingToLibrary,
  limitGenerations,
  maskUrl,
  mode,
  numImages,
  openLibraryForSlot,
  outputFormat,
  outputFormatSelectOptions,
  previewEntry,
  prompt,
  quality,
  qualitySelectOptions,
  referenceAssetFields,
  resolution,
  resolutionSelectOptions,
  resolvedCopy,
  seed,
  selectedEngineCaps,
  selectedEngineId,
  selectedPreviewImageIndex,
  style,
  styleSelectOptions,
  setAspectRatio,
  setCustomImageHeight,
  setCustomImageWidth,
  setEnableWebSearch,
  setEngineId,
  setError,
  setLimitGenerations,
  setMaskUrl,
  setMode,
  setNumImagesPreset,
  setOutputFormat,
  setPrompt,
  setQuality,
  setResolutionPreset,
  setSeed,
  setSelectedPreviewImageIndex,
  setStyle,
  setThinkingLevel,
  setWatermark,
  showAspectRatioControl,
  showCustomImageSizeControl,
  showEnableWebSearchControl,
  showLimitGenerationsControl,
  showMaskUrlControl,
  showNumImagesControl,
  showOutputFormatControl,
  showQualityControl,
  showResolutionControl,
  showSeedControl,
  showStyleControl,
  showThinkingLevelControl,
  showWatermarkControl,
  statusMessage,
  thinkingLevel,
  thinkingLevelSelectOptions,
  watermark,
}: ImageWorkspaceComposerSurfaceProps) {
  return (
    <div className="flex flex-col gap-1">
      <ImageCompositePreviewDock
        density="workspace"
        entry={compositePreviewEntry}
        selectedIndex={selectedPreviewImageIndex}
        onSelectIndex={setSelectedPreviewImageIndex}
        onOpenModal={previewEntry ? () => handleOpenHistoryEntry(previewEntry) : undefined}
        onDownload={handleDownload}
        onCopyLink={handleCopy}
        onEditImage={handleEditSelectedPreview}
        onAddToLibrary={handleAddToLibrary}
        onRemoveFromLibrary={handleRemoveFromLibrary}
        isInLibrary={isInLibrary}
        isSavingToLibrary={isSavingToLibrary}
        isRemovingFromLibrary={isRemovingFromLibrary}
        copiedUrl={copiedUrl}
        showTitle={false}
        engineSettings={
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
            <EngineSelect
              engines={engineCapsList}
              engineId={selectedEngineId}
              onEngineChange={setEngineId}
              mode={mode}
              onModeChange={(nextMode) => setMode(nextMode as ImageGenerationMode)}
              modeOptions={['t2i', 'i2i']}
              modeLabelOverrides={{
                t2i: resolvedCopy.modeTabs.generate,
                i2i: resolvedCopy.modeTabs.edit,
              }}
              showModeSelect={false}
              modeLayout="stacked"
              showBillingNote={false}
              variant="bar"
              controlPresentation="workspace"
              density="compact"
              className="min-w-0 flex-1"
            />
          </div>
        }
      />

      <form onSubmit={handleRun} className="space-y-4">
        {inProgressMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-card border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
          >
            {inProgressMessage}
          </p>
        ) : statusMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-card border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
          >
            {statusMessage}
          </p>
        ) : null}

        <Composer
          density="workspace"
          compactPrompt
          engine={selectedEngineCaps}
          prompt={prompt}
          onPromptChange={setPrompt}
          price={estimatedCostAmount}
          currency={currency}
          isLoading={false}
          error={composerError ?? undefined}
          promptField={{
            id: 'prompt',
            type: 'text',
            label: resolvedCopy.composer.promptLabel,
          }}
          promptRequired
          promptPlaceholder={resolvedCopy.composer.promptPlaceholder}
          promptPlaceholderWithAsset={
            resolvedCopy.composer.promptPlaceholderWithImage ?? resolvedCopy.composer.promptPlaceholder
          }
          assetFields={referenceAssetFields}
          assets={composerReferenceAssets}
          onAssetAdd={(_, file, slotIndex = 0) => {
            void handleReferenceFile(slotIndex, file);
          }}
          onAssetRemove={(_, index) => handleRemoveReferenceSlot(index)}
          onAssetUrlSelect={(_, url, slotIndex) => handleReferenceUrl(slotIndex, url, 'paste')}
          onOpenLibrary={(_, index) => openLibraryForSlot(index)}
          onNotice={setError}
          settingsBar={
            <ImageSettingsBar
              density="workspace"
              numImages={
                showNumImagesControl
                  ? {
                      value: numImages,
                      options: imageCountOptions,
                      onChange: setNumImagesPreset,
                    }
                  : undefined
              }
              aspectRatio={
                showAspectRatioControl
                  ? {
                      value: aspectRatio ?? String(aspectRatioSelectOptions[0]?.value ?? ''),
                      options: aspectRatioSelectOptions,
                      onChange: setAspectRatio,
                    }
                  : undefined
              }
              resolution={
                showResolutionControl
                  ? {
                      value: resolution ?? String(resolutionSelectOptions[0]?.value ?? ''),
                      options: resolutionSelectOptions,
                      onChange: setResolutionPreset,
                      disabled: isResolutionLocked,
                    }
                  : undefined
              }
              quality={
                showQualityControl
                  ? {
                      value: quality ?? String(qualitySelectOptions[0]?.value ?? ''),
                      options: qualitySelectOptions,
                      onChange: setQuality,
                    }
                  : undefined
              }
              style={
                showStyleControl
                  ? {
                      value: style ?? String(styleSelectOptions[0]?.value ?? ''),
                      options: styleSelectOptions,
                      onChange: setStyle,
                    }
                  : undefined
              }
              outputFormat={
                showOutputFormatControl
                  ? {
                      value: outputFormat ?? String(outputFormatSelectOptions[0]?.value ?? ''),
                      options: outputFormatSelectOptions,
                      onChange: setOutputFormat,
                    }
                  : undefined
              }
            />
          }
          onGenerate={() => {
            void handleRun();
          }}
          generateLabel={resolvedCopy.runButton.idle}
          generateLoadingLabel={resolvedCopy.runButton.running}
          extraFields={
            <div className="space-y-6">
              <ImageAdvancedSettings
                title={advancedSettingsTitle}
                seed={
                  showSeedControl
                    ? {
                        label: resolvedCopy.composer.seedLabel,
                        placeholder: resolvedCopy.composer.seedPlaceholder,
                        value: seed,
                        onChange: setSeed,
                      }
                    : undefined
                }
                thinkingLevel={
                  showThinkingLevelControl
                    ? {
                        label: resolvedCopy.composer.thinkingLevelLabel,
                        value: thinkingLevel ?? String(thinkingLevelSelectOptions[0]?.value ?? ''),
                        options: thinkingLevelSelectOptions,
                        onChange: setThinkingLevel,
                      }
                    : undefined
                }
                customImageSize={
                  showCustomImageSizeControl
                    ? {
                        widthLabel: resolvedCopy.composer.customWidthLabel,
                        heightLabel: resolvedCopy.composer.customHeightLabel,
                        widthValue: customImageWidth,
                        heightValue: customImageHeight,
                        min: 16,
                        max: GPT_IMAGE_2_SIZE_CONSTRAINTS.maxEdge,
                        step: GPT_IMAGE_2_SIZE_CONSTRAINTS.multipleOf,
                        onWidthChange: setCustomImageWidth,
                        onHeightChange: setCustomImageHeight,
                      }
                    : undefined
                }
                maskUrl={
                  showMaskUrlControl
                    ? {
                        label: resolvedCopy.composer.maskUrlLabel,
                        placeholder: resolvedCopy.composer.maskUrlPlaceholder,
                        value: maskUrl,
                        onChange: setMaskUrl,
                      }
                    : undefined
                }
                enableWebSearch={
                  showEnableWebSearchControl
                    ? {
                        label: resolvedCopy.composer.enableWebSearchLabel,
                        value: enableWebSearch,
                        options: booleanSelectOptions,
                        onChange: setEnableWebSearch,
                      }
                    : undefined
                }
                limitGenerations={
                  showLimitGenerationsControl
                    ? {
                        label: resolvedCopy.composer.limitGenerationsLabel,
                        value: limitGenerations,
                        options: booleanSelectOptions,
                        onChange: setLimitGenerations,
                      }
                    : undefined
                }
                watermark={
                  showWatermarkControl
                    ? {
                        label: resolvedCopy.composer.watermarkLabel,
                        value: watermark,
                        options: booleanSelectOptions,
                        onChange: setWatermark,
                      }
                    : undefined
                }
              />
            </div>
          }
        />
      </form>
    </div>
  );
}
