import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import { parseCharacterReferenceEntry } from './image-workspace-character-references';
import {
  IMAGE_COMPOSER_STORAGE_VERSION,
  MAX_REFERENCE_SLOTS,
  type PersistedCharacterReference,
  type PersistedImageComposerState,
  type PersistedReferenceSlot,
  type ReferenceSlotValue,
} from './image-workspace-types';

export function parsePersistedImageComposerState(value: string): PersistedImageComposerState | null {
  try {
    const raw = JSON.parse(value) as Partial<PersistedImageComposerState> | null;
    if (!raw || typeof raw !== 'object') return null;
    if (![1, 2, 3, IMAGE_COMPOSER_STORAGE_VERSION].includes(Number(raw.version))) return null;
    if (typeof raw.engineId !== 'string' || raw.engineId.trim().length === 0) return null;
    const mode = raw.mode === 't2i' || raw.mode === 'i2i' ? raw.mode : 't2i';
    const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
    const numImages =
      typeof raw.numImages === 'number' && Number.isFinite(raw.numImages) ? Math.round(raw.numImages) : 1;
    const aspectRatio = typeof raw.aspectRatio === 'string' ? raw.aspectRatio : null;
    const resolution = typeof raw.resolution === 'string' ? raw.resolution : null;
    const rawCustomImageSize =
      raw.customImageSize && typeof raw.customImageSize === 'object'
        ? (raw.customImageSize as Partial<GptImage2ImageSize>)
        : null;
    const customImageSize =
      typeof rawCustomImageSize?.width === 'number' &&
      Number.isFinite(rawCustomImageSize.width) &&
      typeof rawCustomImageSize?.height === 'number' &&
      Number.isFinite(rawCustomImageSize.height)
        ? {
            width: Math.round(rawCustomImageSize.width),
            height: Math.round(rawCustomImageSize.height),
          }
        : null;
    const seed = typeof raw.seed === 'number' && Number.isFinite(raw.seed) ? Math.round(raw.seed) : null;
    const outputFormat = typeof raw.outputFormat === 'string' ? raw.outputFormat : null;
    const quality = typeof raw.quality === 'string' ? raw.quality : null;
    const maskUrl = typeof raw.maskUrl === 'string' ? raw.maskUrl : null;
    const enableWebSearch = raw.enableWebSearch === true;
    const thinkingLevel = typeof raw.thinkingLevel === 'string' ? raw.thinkingLevel : null;
    const limitGenerations = raw.limitGenerations === true;
    const referenceSlotsRaw = Array.isArray(raw.referenceSlots) ? raw.referenceSlots : [];
    const referenceSlots = referenceSlotsRaw
      .slice(0, MAX_REFERENCE_SLOTS)
      .map((entry): PersistedReferenceSlot => {
        if (entry === null) return null;
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as { url?: unknown; source?: unknown; characterReference?: unknown };
        const url = typeof record.url === 'string' ? record.url.trim() : '';
        if (!url || url.startsWith('blob:')) return null;
        const source =
          record.source === 'upload' ||
          record.source === 'library' ||
          record.source === 'paste' ||
          record.source === 'character'
            ? (record.source as ReferenceSlotValue['source'])
            : undefined;
        const width =
          typeof (record as { width?: unknown }).width === 'number'
            ? Math.round((record as { width: number }).width)
            : null;
        const height =
          typeof (record as { height?: unknown }).height === 'number'
            ? Math.round((record as { height: number }).height)
            : null;
        const characterReference = parseCharacterReferenceEntry(record.characterReference);
        return { url, source, width, height, characterReference };
      });
    const characterReferencesRaw = Array.isArray(raw.characterReferences) ? raw.characterReferences : [];
    const characterReferences = characterReferencesRaw.reduce<PersistedCharacterReference[]>((acc, entry) => {
      const parsedEntry = parseCharacterReferenceEntry(entry);
      if (!parsedEntry) return acc;
      acc.push(parsedEntry);
      return acc;
    }, []);

    return {
      version: IMAGE_COMPOSER_STORAGE_VERSION,
      engineId: raw.engineId.trim(),
      mode,
      prompt,
      numImages,
      aspectRatio,
      resolution,
      customImageSize,
      seed,
      outputFormat,
      quality,
      maskUrl,
      enableWebSearch,
      thinkingLevel,
      limitGenerations,
      referenceSlots,
      characterReferences,
    };
  } catch {
    return null;
  }
}
