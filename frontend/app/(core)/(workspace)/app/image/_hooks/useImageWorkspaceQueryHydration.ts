import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { authFetch } from '@/lib/authFetch';
import {
  clampRequestedImageCount,
  getAspectRatioOptions,
  getDefaultAspectRatio,
  getDefaultResolution,
  getImageFieldDefaultNumber,
  getImageFieldDefaultString,
  getImageFieldValues,
  getImageInputField,
} from '@/lib/image/inputSchema';
import {
  GPT_IMAGE_2_SIZE_CONSTRAINTS,
  parseGptImage2SizeKey,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import type {
  CharacterReferenceSelection,
  ImageGenerationMode,
} from '@/types/image-generation';
import {
  mergeCharacterReferencesIntoSlots,
  parseCharacterReferenceEntry,
} from '../_lib/image-workspace-character-references';
import { findImageEngine } from '../_lib/image-workspace-utils';
import {
  MAX_REFERENCE_SLOTS,
  type ImageEngineOption,
  type ReferenceSlotValue,
} from '../_lib/image-workspace-types';
import { IMAGE_STORYBOARD_PRESET } from '../_lib/image-workspace-storyboard';

type SearchParamsReader = {
  get(name: string): string | null;
} | null | undefined;

interface UseImageWorkspaceQueryHydrationParams {
  engines: ImageEngineOption[];
  genericError: string;
  searchParams: SearchParamsReader;
  setAspectRatio: Dispatch<SetStateAction<string | null>>;
  setCustomImageHeight: Dispatch<SetStateAction<string>>;
  setCustomImageWidth: Dispatch<SetStateAction<string>>;
  setEnableWebSearch: Dispatch<SetStateAction<boolean>>;
  setEngineId: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLimitGenerations: Dispatch<SetStateAction<boolean>>;
  setMaskUrl: Dispatch<SetStateAction<string>>;
  setMode: Dispatch<SetStateAction<ImageGenerationMode>>;
  setNumImages: Dispatch<SetStateAction<number>>;
  setOutputFormat: Dispatch<SetStateAction<string | null>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setQuality: Dispatch<SetStateAction<string | null>>;
  setReferenceSlots: Dispatch<SetStateAction<Array<ReferenceSlotValue | null>>>;
  setResolution: Dispatch<SetStateAction<string | null>>;
  setSeed: Dispatch<SetStateAction<string>>;
  setStyle: Dispatch<SetStateAction<string | null>>;
  setSelectedPreviewEntryId: Dispatch<SetStateAction<string | null>>;
  setSelectedPreviewImageIndex: Dispatch<SetStateAction<number>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  setThinkingLevel: Dispatch<SetStateAction<string | null>>;
  setWatermark: Dispatch<SetStateAction<boolean>>;
}

export function useImageWorkspaceQueryHydration({
  engines,
  genericError,
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
}: UseImageWorkspaceQueryHydrationParams) {
  const hydratedJobRef = useRef<string | null>(null);

  const requestedJobId = useMemo(() => {
    const raw = searchParams?.get('job');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : null;
  }, [searchParams]);

  const requestedEngineId = useMemo(() => {
    const raw = searchParams?.get('engine');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : null;
  }, [searchParams]);

  const requestedTool = useMemo(() => {
    const raw = searchParams?.get('tool');
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();
    return trimmed.length ? trimmed : null;
  }, [searchParams]);

  useEffect(() => {
    if (!requestedEngineId) return;
    const engineMatch = findImageEngine(engines, requestedEngineId);
    if (!engineMatch) return;
    setEngineId(engineMatch.id);
    setMode((previous) => (engineMatch.modes.includes(previous) ? previous : engineMatch.modes[0] ?? 't2i'));
  }, [engines, requestedEngineId, setEngineId, setMode]);

  useEffect(() => {
    if (requestedTool !== IMAGE_STORYBOARD_PRESET.tool) return;
    const engineMatch = findImageEngine(engines, IMAGE_STORYBOARD_PRESET.engineId);
    if (!engineMatch) return;
    setEngineId(engineMatch.id);
    setMode(
      engineMatch.modes.includes(IMAGE_STORYBOARD_PRESET.mode)
        ? IMAGE_STORYBOARD_PRESET.mode
        : engineMatch.modes[0] ?? 't2i'
    );
    setPrompt(IMAGE_STORYBOARD_PRESET.prompt);
    setNumImages(1);
    setReferenceSlots(() => Array(MAX_REFERENCE_SLOTS).fill(null) as Array<ReferenceSlotValue | null>);
  }, [engines, requestedTool, setEngineId, setMode, setNumImages, setPrompt, setReferenceSlots]);

  const applyImageSettingsSnapshot = useCallback(
    (snapshot: unknown, { selectJobId }: { selectJobId?: string } = {}) => {
      if (!snapshot || typeof snapshot !== 'object') {
        throw new Error('Job settings snapshot missing');
      }
      const record = snapshot as {
        schemaVersion?: unknown;
        surface?: unknown;
        engineId?: unknown;
        inputMode?: unknown;
        prompt?: unknown;
        core?: unknown;
        refs?: unknown;
      };
      if (record.schemaVersion !== 1) {
        throw new Error('Unsupported job snapshot version');
      }
      if (record.surface !== 'image') {
        throw new Error('This snapshot is not for image');
      }
      const snapshotEngineId = typeof record.engineId === 'string' ? record.engineId : null;
      const engineMatch = snapshotEngineId ? findImageEngine(engines, snapshotEngineId) : null;
      const snapshotMode = record.inputMode === 't2i' || record.inputMode === 'i2i' ? record.inputMode : null;
      if (engineMatch) {
        setEngineId(engineMatch.id);
        if (snapshotMode) {
          setMode(engineMatch.modes.includes(snapshotMode) ? snapshotMode : engineMatch.modes[0] ?? 't2i');
        }
      } else if (snapshotMode) {
        setMode(snapshotMode);
      }
      const snapshotPrompt = typeof record.prompt === 'string' ? record.prompt : null;
      if (snapshotPrompt !== null) {
        setPrompt(snapshotPrompt);
      }

      const core = record.core && typeof record.core === 'object' ? (record.core as Record<string, unknown>) : {};
      const numImagesRaw = core.numImages;
      if (typeof numImagesRaw === 'number' && Number.isFinite(numImagesRaw)) {
        setNumImages(
          engineMatch
            ? clampRequestedImageCount(
                engineMatch.engineCaps,
                snapshotMode && engineMatch.modes.includes(snapshotMode) ? snapshotMode : engineMatch.modes[0] ?? 't2i',
                numImagesRaw
              )
            : Math.max(1, Math.round(numImagesRaw))
        );
      }
      const aspectRatioRaw = typeof core.aspectRatio === 'string' ? core.aspectRatio : null;
      const resolutionRaw = typeof core.resolution === 'string' ? core.resolution : null;
      const customImageSizeRaw =
        core.customImageSize && typeof core.customImageSize === 'object'
          ? (core.customImageSize as Partial<GptImage2ImageSize>)
          : null;
      const customImageSizeRawParsed =
        typeof customImageSizeRaw?.width === 'number' &&
        Number.isFinite(customImageSizeRaw.width) &&
        typeof customImageSizeRaw?.height === 'number' &&
        Number.isFinite(customImageSizeRaw.height)
          ? {
              width: Math.round(customImageSizeRaw.width),
              height: Math.round(customImageSizeRaw.height),
            }
          : null;
      const seedRaw =
        typeof core.seed === 'number' && Number.isFinite(core.seed) ? Math.round(core.seed) : null;
      const outputFormatRaw = typeof core.outputFormat === 'string' ? core.outputFormat : null;
      const qualityRaw = typeof core.quality === 'string' ? core.quality : null;
      const styleRaw = typeof core.style === 'string' ? core.style : null;
      const maskUrlRaw = typeof core.maskUrl === 'string' ? core.maskUrl : null;
      const enableWebSearchRaw = core.enableWebSearch === true;
      const thinkingLevelRaw = typeof core.thinkingLevel === 'string' ? core.thinkingLevel : null;
      const limitGenerationsRaw = core.limitGenerations === true;
      const watermarkRaw = core.watermark === true;
      if (engineMatch) {
        const resolvedMode =
          snapshotMode && engineMatch.modes.includes(snapshotMode) ? snapshotMode : engineMatch.modes[0] ?? 't2i';
        const allowedResolutions = getImageFieldValues(
          engineMatch.engineCaps,
          'resolution',
          resolvedMode,
          Array.isArray(engineMatch.engineCaps?.resolutions) ? [...engineMatch.engineCaps.resolutions] : []
        );
        const defaultResolution = getImageInputField(engineMatch.engineCaps, 'resolution', resolvedMode)
          ? getDefaultResolution(engineMatch.engineCaps, resolvedMode)
          : null;
        const nextResolution =
          resolutionRaw && allowedResolutions.includes(resolutionRaw) ? resolutionRaw : defaultResolution;
        setResolution(nextResolution);
        const parsedSizeFromResolution = parseGptImage2SizeKey(nextResolution);
        const restoredCustomSize = customImageSizeRawParsed ?? parsedSizeFromResolution;
        const defaultCustomWidth =
          getImageFieldDefaultNumber(engineMatch.engineCaps, 'image_width', resolvedMode) ??
          GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultWidth;
        const defaultCustomHeight =
          getImageFieldDefaultNumber(engineMatch.engineCaps, 'image_height', resolvedMode) ??
          GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultHeight;
        setCustomImageWidth(String(restoredCustomSize?.width ?? defaultCustomWidth));
        setCustomImageHeight(String(restoredCustomSize?.height ?? defaultCustomHeight));
        const allowedAspectRatios = getAspectRatioOptions(engineMatch.engineCaps, resolvedMode);
        const defaultAspectRatio = getDefaultAspectRatio(engineMatch.engineCaps, resolvedMode);
        setAspectRatio(
          aspectRatioRaw && allowedAspectRatios.includes(aspectRatioRaw) ? aspectRatioRaw : defaultAspectRatio
        );
        const seedDefault = getImageFieldDefaultNumber(engineMatch.engineCaps, 'seed', resolvedMode);
        setSeed(seedRaw == null ? (seedDefault == null ? '' : String(seedDefault)) : String(seedRaw));
        const outputFormats = getImageFieldValues(engineMatch.engineCaps, 'output_format', resolvedMode);
        const defaultOutputFormat =
          getImageFieldDefaultString(engineMatch.engineCaps, 'output_format', resolvedMode) ?? outputFormats[0] ?? null;
        setOutputFormat(
          outputFormatRaw && outputFormats.includes(outputFormatRaw) ? outputFormatRaw : defaultOutputFormat
        );
        const qualityValues = getImageFieldValues(engineMatch.engineCaps, 'quality', resolvedMode);
        const defaultQuality =
          getImageFieldDefaultString(engineMatch.engineCaps, 'quality', resolvedMode) ?? qualityValues[0] ?? null;
        setQuality(qualityRaw && qualityValues.includes(qualityRaw) ? qualityRaw : defaultQuality);
        const styleValues = getImageFieldValues(engineMatch.engineCaps, 'style', resolvedMode);
        const defaultStyle =
          getImageFieldDefaultString(engineMatch.engineCaps, 'style', resolvedMode) ?? styleValues[0] ?? null;
        setStyle(styleRaw && styleValues.includes(styleRaw) ? styleRaw : defaultStyle);
        setMaskUrl(getImageInputField(engineMatch.engineCaps, 'mask_url', resolvedMode) ? maskUrlRaw ?? '' : '');
        setEnableWebSearch(
          getImageInputField(engineMatch.engineCaps, 'enable_web_search', resolvedMode)
            ? enableWebSearchRaw
            : false
        );
        const thinkingLevels = getImageFieldValues(engineMatch.engineCaps, 'thinking_level', resolvedMode);
        const defaultThinkingLevel =
          getImageFieldDefaultString(engineMatch.engineCaps, 'thinking_level', resolvedMode) ??
          thinkingLevels[0] ??
          null;
        setThinkingLevel(
          thinkingLevelRaw && thinkingLevels.includes(thinkingLevelRaw) ? thinkingLevelRaw : defaultThinkingLevel
        );
        setLimitGenerations(
          getImageInputField(engineMatch.engineCaps, 'limit_generations', resolvedMode)
            ? limitGenerationsRaw
            : false
        );
        setWatermark(getImageInputField(engineMatch.engineCaps, 'watermark', resolvedMode) ? watermarkRaw : false);
      } else {
        setResolution(resolutionRaw);
        const restoredCustomSize = customImageSizeRawParsed ?? parseGptImage2SizeKey(resolutionRaw);
        setCustomImageWidth(restoredCustomSize ? String(restoredCustomSize.width) : '');
        setCustomImageHeight(restoredCustomSize ? String(restoredCustomSize.height) : '');
        setAspectRatio(aspectRatioRaw);
        setSeed(seedRaw == null ? '' : String(seedRaw));
        setOutputFormat(outputFormatRaw);
        setQuality(qualityRaw);
        setStyle(styleRaw);
        setMaskUrl(maskUrlRaw ?? '');
        setEnableWebSearch(enableWebSearchRaw);
        setThinkingLevel(thinkingLevelRaw);
        setLimitGenerations(limitGenerationsRaw);
        setWatermark(watermarkRaw);
      }

      const refs = record.refs && typeof record.refs === 'object' ? (record.refs as Record<string, unknown>) : {};
      const imageUrlsRaw = refs.imageUrls;
      const imageUrls = Array.isArray(imageUrlsRaw)
        ? imageUrlsRaw.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter((entry) => entry.length)
        : [];
      setReferenceSlots(() => {
        const next = Array(MAX_REFERENCE_SLOTS).fill(null) as Array<ReferenceSlotValue | null>;
        imageUrls.slice(0, MAX_REFERENCE_SLOTS).forEach((url, index) => {
          next[index] = {
            id: `snapshot-${index}`,
            url,
            previewUrl: url,
            status: 'ready',
            source: 'library',
          };
        });
        const characterReferencesRaw = Array.isArray(refs.characterReferences) ? refs.characterReferences : [];
        const characterReferences = characterReferencesRaw.reduce<CharacterReferenceSelection[]>((acc, entry) => {
          const parsedEntry = parseCharacterReferenceEntry(entry);
          if (!parsedEntry) return acc;
          acc.push(parsedEntry);
          return acc;
        }, []);
        return mergeCharacterReferencesIntoSlots(next, characterReferences, MAX_REFERENCE_SLOTS);
      });

      if (selectJobId) {
        setSelectedPreviewEntryId(selectJobId);
        setSelectedPreviewImageIndex(0);
      }
    },
    [
      engines,
      setAspectRatio,
      setCustomImageHeight,
      setCustomImageWidth,
      setEnableWebSearch,
      setEngineId,
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
      setStyle,
      setThinkingLevel,
      setWatermark,
    ]
  );

  useEffect(() => {
    if (!requestedJobId) return;
    if (hydratedJobRef.current === requestedJobId) return;
    hydratedJobRef.current = requestedJobId;
    setError(null);
    setStatusMessage(null);
    void authFetch(`/api/jobs/${encodeURIComponent(requestedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              settingsSnapshot?: unknown;
            }
          | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }
        applyImageSettingsSnapshot(payload.settingsSnapshot, { selectJobId: requestedJobId });
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : genericError);
      });
  }, [applyImageSettingsSnapshot, genericError, requestedJobId, setError, setStatusMessage]);

  return {
    applyImageSettingsSnapshot,
    librarySource:
      requestedTool === IMAGE_STORYBOARD_PRESET.tool ? IMAGE_STORYBOARD_PRESET.librarySource : 'generated',
  };
}
