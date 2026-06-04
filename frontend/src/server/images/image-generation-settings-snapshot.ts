import type {
  CharacterReferenceSelection,
  ImageGenerationRequest,
  ImageGenerationMode,
} from '@/types/image-generation';
import type { FalEngineEntry } from '@/config/falEngines';
import type { JobSurface } from '@/types/billing';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';

export function buildDefaultSettingsSnapshot(args: {
  surface: JobSurface;
  engineEntry: FalEngineEntry;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  resolvedAspectRatio: string | null;
  resolution: string;
  customImageSize: GptImage2ImageSize | null;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  watermark: boolean;
  imageUrls: string[];
  characterReferences: CharacterReferenceSelection[];
  metadata?: ImageGenerationRequest['metadata'] | null;
  membershipTier?: string;
  visibility: 'public' | 'private';
  indexable: boolean;
}): unknown {
  return {
    schemaVersion: 1,
    surface: args.surface,
    engineId: args.engineEntry.id,
    engineLabel: args.engineEntry.marketingName,
    inputMode: args.mode,
    prompt: args.prompt,
    core: {
      numImages: args.numImages,
      aspectRatio: args.resolvedAspectRatio ?? null,
      resolution: args.resolution,
      customImageSize: args.customImageSize,
      seed: args.normalizedSeed,
      outputFormat: args.outputFormat,
      quality: args.quality,
      maskUrl: args.maskUrl,
      enableWebSearch: args.enableWebSearch,
      thinkingLevel: args.thinkingLevel,
      limitGenerations: args.limitGenerations,
      watermark: args.watermark,
    },
    refs: {
      imageUrls: args.imageUrls,
      characterReferences: args.characterReferences,
    },
    ...(args.metadata?.storyboard ? { storyboard: args.metadata.storyboard } : {}),
    meta: {
      memberTier: args.membershipTier ?? null,
      visibility: args.visibility,
      indexable: args.indexable,
    },
  };
}
