import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { formatAspectRatioLabel } from '@/lib/image/aspectRatios';
import {
  formatSupportedImageFormatsLabel,
  getSupportedImageFormats,
} from '@/lib/image/formats';
import {
  clampRequestedImageCount,
  getAspectRatioOptions,
  getDefaultAspectRatio,
  getDefaultResolution,
  getImageCountConstraints,
  getImageFieldDefaultBoolean,
  getImageFieldDefaultNumber,
  getImageFieldDefaultString,
  getImageFieldValues,
  getImageInputField,
} from '@/lib/image/inputSchema';
import { GPT_IMAGE_2_SIZE_CONSTRAINTS } from '@/lib/image/gptImage2';
import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { formatTemplate, type ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import { QUICK_IMAGE_COUNT_OPTIONS } from '../_lib/image-workspace-types';
import {
  formatImageSizeLabel,
  formatQualityLabel,
} from '../_lib/image-workspace-utils';

type UseImageSettingsFieldsParams = {
  mode: ImageGenerationMode;
  resolution: string | null;
  resolvedCopy: ImageWorkspaceCopy;
  selectedEngineCaps: EngineCaps | undefined;
  setAspectRatio: Dispatch<SetStateAction<string | null>>;
  setCustomImageHeight: Dispatch<SetStateAction<string>>;
  setCustomImageWidth: Dispatch<SetStateAction<string>>;
  setEnableWebSearch: Dispatch<SetStateAction<boolean>>;
  setLimitGenerations: Dispatch<SetStateAction<boolean>>;
  setMaskUrl: Dispatch<SetStateAction<string>>;
  setNumImages: Dispatch<SetStateAction<number>>;
  setOutputFormat: Dispatch<SetStateAction<string | null>>;
  setQuality: Dispatch<SetStateAction<string | null>>;
  setResolution: Dispatch<SetStateAction<string | null>>;
  setSeed: Dispatch<SetStateAction<string>>;
  setThinkingLevel: Dispatch<SetStateAction<string | null>>;
};

export function useImageSettingsFields({
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
}: UseImageSettingsFieldsParams) {
  const imageCountField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'num_images', mode),
    [selectedEngineCaps, mode]
  );
  const imageCountConstraints = useMemo(
    () => getImageCountConstraints(selectedEngineCaps ?? null, mode),
    [selectedEngineCaps, mode]
  );
  const aspectRatioField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'aspect_ratio', mode),
    [selectedEngineCaps, mode]
  );
  const aspectRatioOptions = useMemo(
    () => getAspectRatioOptions(selectedEngineCaps ?? null, mode),
    [selectedEngineCaps, mode]
  );
  const resolutionField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'resolution', mode),
    [selectedEngineCaps, mode]
  );
  const customImageWidthField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'image_width', mode),
    [selectedEngineCaps, mode]
  );
  const customImageHeightField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'image_height', mode),
    [selectedEngineCaps, mode]
  );
  const resolutionOptions = useMemo(
    () =>
      getImageFieldValues(
        selectedEngineCaps ?? null,
        'resolution',
        mode,
        Array.isArray(selectedEngineCaps?.resolutions) ? [...selectedEngineCaps.resolutions] : []
      ),
    [selectedEngineCaps, mode]
  );
  const outputFormatField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'output_format', mode),
    [selectedEngineCaps, mode]
  );
  const outputFormatOptions = useMemo(
    () => getImageFieldValues(selectedEngineCaps ?? null, 'output_format', mode),
    [selectedEngineCaps, mode]
  );
  const qualityField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'quality', mode),
    [selectedEngineCaps, mode]
  );
  const qualityOptions = useMemo(
    () => getImageFieldValues(selectedEngineCaps ?? null, 'quality', mode),
    [selectedEngineCaps, mode]
  );
  const maskUrlField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'mask_url', mode),
    [selectedEngineCaps, mode]
  );
  const seedField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'seed', mode),
    [selectedEngineCaps, mode]
  );
  const enableWebSearchField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'enable_web_search', mode),
    [selectedEngineCaps, mode]
  );
  const thinkingLevelField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'thinking_level', mode),
    [selectedEngineCaps, mode]
  );
  const thinkingLevelOptions = useMemo(
    () => getImageFieldValues(selectedEngineCaps ?? null, 'thinking_level', mode),
    [selectedEngineCaps, mode]
  );
  const limitGenerationsField = useMemo(
    () => getImageInputField(selectedEngineCaps ?? null, 'limit_generations', mode),
    [selectedEngineCaps, mode]
  );

  const isResolutionLocked = Boolean(resolutionField && resolutionOptions.length === 1);
  const supportedReferenceFormats = useMemo(
    () => getSupportedImageFormats(selectedEngineCaps ?? null),
    [selectedEngineCaps]
  );
  const supportedReferenceFormatsLabel = useMemo(
    () => formatSupportedImageFormatsLabel(supportedReferenceFormats),
    [supportedReferenceFormats]
  );

  useEffect(() => {
    setNumImages((previous) => clampRequestedImageCount(selectedEngineCaps ?? null, mode, previous));
  }, [selectedEngineCaps, mode, setNumImages]);

  useEffect(() => {
    if (!aspectRatioField || !aspectRatioOptions.length) {
      setAspectRatio(null);
      return;
    }
    const defaultValue = getDefaultAspectRatio(selectedEngineCaps ?? null, mode);
    setAspectRatio((previous) => {
      if (previous && aspectRatioOptions.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [aspectRatioField, aspectRatioOptions, selectedEngineCaps, mode, setAspectRatio]);

  useEffect(() => {
    if (!resolutionField || !resolutionOptions.length) {
      setResolution(null);
      return;
    }
    const defaultValue = getDefaultResolution(selectedEngineCaps ?? null, mode);
    setResolution((previous) => {
      if (previous && resolutionOptions.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [resolutionField, resolutionOptions, selectedEngineCaps, mode, setResolution]);

  useEffect(() => {
    if (!customImageWidthField || !customImageHeightField) {
      setCustomImageWidth('');
      setCustomImageHeight('');
      return;
    }
    const defaultWidth =
      getImageFieldDefaultNumber(selectedEngineCaps ?? null, 'image_width', mode) ??
      GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultWidth;
    const defaultHeight =
      getImageFieldDefaultNumber(selectedEngineCaps ?? null, 'image_height', mode) ??
      GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultHeight;
    setCustomImageWidth((previous) => (previous.trim().length ? previous : String(defaultWidth)));
    setCustomImageHeight((previous) => (previous.trim().length ? previous : String(defaultHeight)));
  }, [
    customImageHeightField,
    customImageWidthField,
    selectedEngineCaps,
    mode,
    setCustomImageHeight,
    setCustomImageWidth,
  ]);

  useEffect(() => {
    if (!seedField) {
      setSeed('');
      return;
    }
    const defaultValue = getImageFieldDefaultNumber(selectedEngineCaps ?? null, 'seed', mode);
    setSeed((previous) => {
      if (previous.trim().length) {
        const parsed = Number(previous);
        if (Number.isFinite(parsed)) {
          return String(Math.round(parsed));
        }
      }
      return defaultValue == null ? '' : String(defaultValue);
    });
  }, [seedField, selectedEngineCaps, mode, setSeed]);

  useEffect(() => {
    if (!outputFormatField || !outputFormatOptions.length) {
      setOutputFormat(null);
      return;
    }
    const defaultValue =
      getImageFieldDefaultString(selectedEngineCaps ?? null, 'output_format', mode) ?? outputFormatOptions[0] ?? null;
    setOutputFormat((previous) => {
      if (previous && outputFormatOptions.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [outputFormatField, outputFormatOptions, selectedEngineCaps, mode, setOutputFormat]);

  useEffect(() => {
    if (!qualityField || !qualityOptions.length) {
      setQuality(null);
      return;
    }
    const defaultValue =
      getImageFieldDefaultString(selectedEngineCaps ?? null, 'quality', mode) ?? qualityOptions[0] ?? null;
    setQuality((previous) => {
      if (previous && qualityOptions.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [qualityField, qualityOptions, selectedEngineCaps, mode, setQuality]);

  useEffect(() => {
    if (!maskUrlField) {
      setMaskUrl('');
    }
  }, [maskUrlField, setMaskUrl]);

  useEffect(() => {
    if (!enableWebSearchField) {
      setEnableWebSearch(false);
      return;
    }
    const defaultValue = getImageFieldDefaultBoolean(selectedEngineCaps ?? null, 'enable_web_search', mode);
    setEnableWebSearch((previous) => previous ?? defaultValue ?? false);
  }, [enableWebSearchField, selectedEngineCaps, mode, setEnableWebSearch]);

  useEffect(() => {
    if (!thinkingLevelField || !thinkingLevelOptions.length) {
      setThinkingLevel(null);
      return;
    }
    const defaultValue =
      getImageFieldDefaultString(selectedEngineCaps ?? null, 'thinking_level', mode) ?? thinkingLevelOptions[0] ?? null;
    setThinkingLevel((previous) => {
      if (previous && thinkingLevelOptions.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [thinkingLevelField, thinkingLevelOptions, selectedEngineCaps, mode, setThinkingLevel]);

  useEffect(() => {
    if (!limitGenerationsField) {
      setLimitGenerations(false);
      return;
    }
    const defaultValue = getImageFieldDefaultBoolean(selectedEngineCaps ?? null, 'limit_generations', mode);
    setLimitGenerations((previous) => previous ?? defaultValue ?? false);
  }, [limitGenerationsField, selectedEngineCaps, mode, setLimitGenerations]);

  const imageCountOptions = useMemo(
    () => {
      const options = Array.from(
        new Set<number>([
          ...QUICK_IMAGE_COUNT_OPTIONS.filter(
            (option) => option >= imageCountConstraints.min && option <= imageCountConstraints.max
          ),
          imageCountConstraints.max,
        ])
      );
      return options.map((option) => ({
        value: option,
        label: formatTemplate(resolvedCopy.composer.numImagesCount, {
          count: option,
          unit: option === 1 ? resolvedCopy.composer.numImagesUnit.singular : resolvedCopy.composer.numImagesUnit.plural,
        }),
      }));
    },
    [imageCountConstraints.max, imageCountConstraints.min, resolvedCopy.composer.numImagesCount, resolvedCopy.composer.numImagesUnit]
  );
  const aspectRatioSelectOptions = useMemo(
    () =>
      aspectRatioOptions.map((option) => ({
        value: option,
        label: formatAspectRatioLabel(option) ?? option,
      })),
    [aspectRatioOptions]
  );
  const resolutionSelectOptions = useMemo(
    () =>
      resolutionOptions.map((option) => ({
        value: option,
        label: formatImageSizeLabel(option),
      })),
    [resolutionOptions]
  );
  const qualitySelectOptions = useMemo(
    () =>
      qualityOptions.map((option) => ({
        value: option,
        label: formatQualityLabel(option),
      })),
    [qualityOptions]
  );
  const outputFormatSelectOptions = useMemo(
    () =>
      outputFormatOptions.map((option) => ({
        value: option,
        label: option.toUpperCase(),
      })),
    [outputFormatOptions]
  );
  const thinkingLevelSelectOptions = useMemo(
    () =>
      thinkingLevelOptions.map((option) => ({
        value: option,
        label: option === 'high' ? 'High' : option === 'minimal' ? 'Minimal' : option,
      })),
    [thinkingLevelOptions]
  );
  const booleanSelectOptions = useMemo(
    () => [
      { value: false, label: resolvedCopy.composer.toggleDisabled },
      { value: true, label: resolvedCopy.composer.toggleEnabled },
    ],
    [resolvedCopy.composer.toggleDisabled, resolvedCopy.composer.toggleEnabled]
  );

  const showNumImagesControl = Boolean(imageCountField);
  const showAspectRatioControl = Boolean(aspectRatioField) && aspectRatioSelectOptions.length > 0;
  const showResolutionControl = Boolean(resolutionField) && resolutionSelectOptions.length > 0;
  const showQualityControl = Boolean(qualityField) && qualitySelectOptions.length > 0;
  const showSeedControl = Boolean(seedField);
  const showOutputFormatControl = Boolean(outputFormatField) && outputFormatSelectOptions.length > 0;
  const showCustomImageSizeControl =
    Boolean(customImageWidthField && customImageHeightField) && resolution === 'custom';
  const showEnableWebSearchControl = Boolean(enableWebSearchField);
  const showThinkingLevelControl = Boolean(thinkingLevelField) && thinkingLevelSelectOptions.length > 0;
  const showLimitGenerationsControl = Boolean(limitGenerationsField);

  return {
    aspectRatioField,
    aspectRatioOptions,
    aspectRatioSelectOptions,
    booleanSelectOptions,
    customImageHeightField,
    customImageWidthField,
    enableWebSearchField,
    imageCountConstraints,
    imageCountField,
    imageCountOptions,
    isResolutionLocked,
    limitGenerationsField,
    maskUrlField,
    outputFormatField,
    outputFormatOptions,
    outputFormatSelectOptions,
    qualityField,
    qualityOptions,
    qualitySelectOptions,
    resolutionField,
    resolutionOptions,
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
    thinkingLevelOptions,
    thinkingLevelSelectOptions,
  };
}
