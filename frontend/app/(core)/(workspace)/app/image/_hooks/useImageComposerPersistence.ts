import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ImageGenerationMode } from '@/types/image-generation';
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
} from '@/lib/image/gptImage2';
import {
  createCharacterReferenceSlot,
  mergeCharacterReferencesIntoSlots,
} from '../_lib/image-workspace-character-references';
import { parsePersistedImageComposerState } from '../_lib/image-workspace-persistence';
import {
  buildCustomImageSize,
  findImageEngine,
} from '../_lib/image-workspace-utils';
import {
  IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS,
  IMAGE_COMPOSER_STORAGE_KEY,
  IMAGE_COMPOSER_STORAGE_VERSION,
  MAX_REFERENCE_SLOTS,
  type ImageEngineOption,
  type PersistedImageComposerState,
  type PersistedReferenceSlot,
  type ReferenceSlotValue,
} from '../_lib/image-workspace-types';

type UseImageComposerPersistenceParams = {
  engines: ImageEngineOption[];
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  aspectRatio: string | null;
  resolution: string | null;
  customImageWidth: string;
  customImageHeight: string;
  seed: string;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  persistableReferenceSlots: PersistedReferenceSlot[];
  setEngineId: Dispatch<SetStateAction<string>>;
  setMode: Dispatch<SetStateAction<ImageGenerationMode>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setNumImages: Dispatch<SetStateAction<number>>;
  setAspectRatio: Dispatch<SetStateAction<string | null>>;
  setResolution: Dispatch<SetStateAction<string | null>>;
  setCustomImageWidth: Dispatch<SetStateAction<string>>;
  setCustomImageHeight: Dispatch<SetStateAction<string>>;
  setSeed: Dispatch<SetStateAction<string>>;
  setOutputFormat: Dispatch<SetStateAction<string | null>>;
  setQuality: Dispatch<SetStateAction<string | null>>;
  setMaskUrl: Dispatch<SetStateAction<string>>;
  setEnableWebSearch: Dispatch<SetStateAction<boolean>>;
  setThinkingLevel: Dispatch<SetStateAction<string | null>>;
  setLimitGenerations: Dispatch<SetStateAction<boolean>>;
  setReferenceSlots: Dispatch<SetStateAction<Array<ReferenceSlotValue | null>>>;
};

export function useImageComposerPersistence({
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
}: UseImageComposerPersistenceParams) {
  const hasHydratedStorageRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const persistedSignatureRef = useRef<string | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!engines.length) return;
    if (hasHydratedStorageRef.current) return;
    hasHydratedStorageRef.current = true;
    let parsed: PersistedImageComposerState | null = null;
    try {
      const stored = window.localStorage.getItem(IMAGE_COMPOSER_STORAGE_KEY);
      if (stored) {
        parsed = parsePersistedImageComposerState(stored);
        if (parsed) {
          persistedSignatureRef.current = stored;
        }
      }
    } catch {
      // ignore storage failures
    }

    if (parsed && engines.length) {
      const engineMatch = findImageEngine(engines, parsed.engineId) ?? engines[0] ?? null;
      if (engineMatch) {
        setEngineId(engineMatch.id);
        const nextMode = engineMatch.modes.includes(parsed.mode) ? parsed.mode : engineMatch.modes[0] ?? 't2i';
        setMode(nextMode);
        setPrompt(parsed.prompt);
        setNumImages(clampRequestedImageCount(engineMatch.engineCaps, nextMode, parsed.numImages));
        const allowedResolutions = getImageFieldValues(
          engineMatch.engineCaps,
          'resolution',
          nextMode,
          Array.isArray(engineMatch.engineCaps?.resolutions) ? [...engineMatch.engineCaps.resolutions] : []
        );
        const defaultResolution = getImageInputField(engineMatch.engineCaps, 'resolution', nextMode)
          ? getDefaultResolution(engineMatch.engineCaps, nextMode)
          : null;
        const nextResolution =
          parsed.resolution && allowedResolutions.includes(parsed.resolution) ? parsed.resolution : defaultResolution;
        setResolution(nextResolution);
        const parsedSizeFromResolution = parseGptImage2SizeKey(nextResolution);
        const restoredCustomSize = parsed.customImageSize ?? parsedSizeFromResolution;
        const defaultCustomWidth =
          getImageFieldDefaultNumber(engineMatch.engineCaps, 'image_width', nextMode) ??
          GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultWidth;
        const defaultCustomHeight =
          getImageFieldDefaultNumber(engineMatch.engineCaps, 'image_height', nextMode) ??
          GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultHeight;
        setCustomImageWidth(String(restoredCustomSize?.width ?? defaultCustomWidth));
        setCustomImageHeight(String(restoredCustomSize?.height ?? defaultCustomHeight));
        const allowedAspectRatios = getAspectRatioOptions(engineMatch.engineCaps, nextMode);
        const defaultAspectRatio = getDefaultAspectRatio(engineMatch.engineCaps, nextMode);
        setAspectRatio(
          parsed.aspectRatio && allowedAspectRatios.includes(parsed.aspectRatio) ? parsed.aspectRatio : defaultAspectRatio
        );
        const seedDefault = getImageFieldDefaultNumber(engineMatch.engineCaps, 'seed', nextMode);
        setSeed(parsed.seed == null ? (seedDefault == null ? '' : String(seedDefault)) : String(parsed.seed));
        const outputFormats = getImageFieldValues(engineMatch.engineCaps, 'output_format', nextMode);
        const defaultOutputFormat =
          getImageFieldDefaultString(engineMatch.engineCaps, 'output_format', nextMode) ?? outputFormats[0] ?? null;
        setOutputFormat(
          parsed.outputFormat && outputFormats.includes(parsed.outputFormat) ? parsed.outputFormat : defaultOutputFormat
        );
        const qualityValues = getImageFieldValues(engineMatch.engineCaps, 'quality', nextMode);
        const defaultQuality =
          getImageFieldDefaultString(engineMatch.engineCaps, 'quality', nextMode) ?? qualityValues[0] ?? null;
        setQuality(parsed.quality && qualityValues.includes(parsed.quality) ? parsed.quality : defaultQuality);
        setMaskUrl(getImageInputField(engineMatch.engineCaps, 'mask_url', nextMode) ? parsed.maskUrl ?? '' : '');
        setEnableWebSearch(
          getImageInputField(engineMatch.engineCaps, 'enable_web_search', nextMode)
            ? parsed.enableWebSearch
            : false
        );
        const thinkingLevels = getImageFieldValues(engineMatch.engineCaps, 'thinking_level', nextMode);
        const defaultThinkingLevel =
          getImageFieldDefaultString(engineMatch.engineCaps, 'thinking_level', nextMode) ?? thinkingLevels[0] ?? null;
        setThinkingLevel(
          parsed.thinkingLevel && thinkingLevels.includes(parsed.thinkingLevel)
            ? parsed.thinkingLevel
            : defaultThinkingLevel
        );
        setLimitGenerations(
          getImageInputField(engineMatch.engineCaps, 'limit_generations', nextMode)
            ? parsed.limitGenerations
            : false
        );
      }

      if (parsed.referenceSlots.length || (parsed.characterReferences?.length ?? 0) > 0) {
        setReferenceSlots((previous) => {
          const next = Array(MAX_REFERENCE_SLOTS).fill(null) as Array<ReferenceSlotValue | null>;
          parsed.referenceSlots.slice(0, MAX_REFERENCE_SLOTS).forEach((slot, index) => {
            if (!slot) return;
            next[index] = slot.characterReference
              ? createCharacterReferenceSlot(slot.characterReference, `stored-${index}`)
              : {
                  id: `stored-${index}`,
                  url: slot.url,
                  previewUrl: slot.url,
                  status: 'ready',
                  source: slot.source ?? 'library',
                  width: slot.width ?? null,
                  height: slot.height ?? null,
                };
          });
          const migratedNext = mergeCharacterReferencesIntoSlots(next, parsed.characterReferences ?? [], MAX_REFERENCE_SLOTS);
          const changed = migratedNext.some((slot, idx) => {
            const prior = previous[idx];
            if (!slot && !prior) return false;
            if (!slot || !prior) return true;
            return slot.url !== prior.url || slot.status !== prior.status;
          });
          return changed ? migratedNext : previous;
        });
      }
    }

    setStorageHydrated(true);
  }, [
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
    setThinkingLevel,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageHydrated) return;
    const payload: PersistedImageComposerState = {
      version: IMAGE_COMPOSER_STORAGE_VERSION,
      engineId: engineId || engines[0]?.id || '',
      mode,
      prompt,
      numImages,
      aspectRatio,
      resolution,
      customImageSize: resolution === 'custom' ? buildCustomImageSize(customImageWidth, customImageHeight) : null,
      seed: seed.trim().length ? Math.round(Number(seed)) : null,
      outputFormat,
      quality,
      maskUrl: maskUrl.trim().length ? maskUrl.trim() : null,
      enableWebSearch,
      thinkingLevel,
      limitGenerations,
      referenceSlots: persistableReferenceSlots,
    };
    if (!payload.engineId) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      return;
    }
    if (serialized === persistedSignatureRef.current) return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(IMAGE_COMPOSER_STORAGE_KEY, serialized);
        persistedSignatureRef.current = serialized;
      } catch {
        // ignore storage failures
      }
    }, IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    aspectRatio,
    customImageHeight,
    customImageWidth,
    enableWebSearch,
    engineId,
    engines,
    limitGenerations,
    maskUrl,
    mode,
    numImages,
    outputFormat,
    persistableReferenceSlots,
    prompt,
    quality,
    resolution,
    seed,
    storageHydrated,
    thinkingLevel,
  ]);
}
