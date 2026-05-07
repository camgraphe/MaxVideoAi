import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import type {
  CharacterReferenceSelection,
  GeneratedImage,
  ImageGenerationMode,
} from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import { MAX_REFERENCE_IMAGES } from '@/lib/image/inputSchema';

export const MAX_REFERENCE_SLOTS = MAX_REFERENCE_IMAGES;
export const DEFAULT_VISIBLE_REFERENCE_SLOTS = 4;
export const QUICK_IMAGE_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;
export const DESKTOP_RAIL_MIN_WIDTH = 1088;
export const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

export const IMAGE_COMPOSER_STORAGE_KEY = 'maxvideoai.image.composer.v1';
export const IMAGE_COMPOSER_STORAGE_VERSION = 4;
export const IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS = 1200;

export type PromptPreset = {
  title: string;
  prompt: string;
  notes?: string;
  mode: ImageGenerationMode;
};

export type ImageEngineOption = {
  id: string;
  name: string;
  description?: string;
  pricePerImage: number;
  currency: string;
  prompts: PromptPreset[];
  modes: ImageGenerationMode[];
  engineCaps: EngineCaps;
  aliases: string[];
};

export type HistoryEntry = {
  id: string;
  engineId: string;
  engineLabel: string;
  mode: ImageGenerationMode;
  prompt: string;
  createdAt: number;
  description?: string | null;
  images: GeneratedImage[];
  jobId?: string | null;
  aspectRatio?: string | null;
};

export type UploadFailure = Error & { code?: string; maxMB?: number };

export type ReferenceSlotValue = {
  id: string;
  url: string;
  previewUrl?: string;
  name?: string;
  status: 'ready' | 'uploading';
  source?: 'upload' | 'library' | 'paste' | 'character';
  width?: number | null;
  height?: number | null;
  characterReference?: CharacterReferenceSelection | null;
};

export type PersistedCharacterReference = CharacterReferenceSelection;

export type PersistedReferenceSlot =
  | {
      url: string;
      source?: ReferenceSlotValue['source'];
      width?: number | null;
      height?: number | null;
      characterReference?: PersistedCharacterReference | null;
    }
  | null;

export type PersistedImageComposerState = {
  version: number;
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  aspectRatio: string | null;
  resolution: string | null;
  customImageSize: GptImage2ImageSize | null;
  seed: number | null;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  referenceSlots: PersistedReferenceSlot[];
  characterReferences?: PersistedCharacterReference[];
};

export type LibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

export type AssetsResponse = {
  ok: boolean;
  assets: LibraryAsset[];
};

export type ImageLibraryModalState = {
  open: boolean;
  slotIndex: number | null;
  selectionMode: 'reference' | 'character';
  initialSource: AssetLibrarySource;
};

export type PricingEstimateResponse = {
  ok: boolean;
  pricing: PricingSnapshot;
};
