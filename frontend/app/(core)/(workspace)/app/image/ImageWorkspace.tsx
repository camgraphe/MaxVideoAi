'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type {
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { GalleryRail } from '@/components/GalleryRail';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { Composer, type AssetFieldConfig, type ComposerAttachment } from '@/components/Composer';
import { ImageSettingsBar } from '@/components/ImageSettingsBar';
import { ImageAdvancedSettings } from '@/components/ImageAdvancedSettings';
import type { AssetLibraryBrowserProps, AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { translateError } from '@/lib/error-messages';
import type {
  CharacterReferenceSelection,
  CharacterReferencesResponse,
  ImageGenerationMode,
  GeneratedImage,
} from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { VideoGroup } from '@/types/video-groups';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { ImageCompositePreviewDock, type ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { normalizeUiLocale } from '@/lib/ltx-localization';
import { formatAspectRatioLabel } from '@/lib/image/aspectRatios';
import { FEATURES } from '@/content/feature-flags';
import {
  formatSupportedImageFormatsLabel,
  getSupportedImageFormats,
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';
import {
  MAX_REFERENCE_IMAGES,
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
  getReferenceConstraints,
} from '@/lib/image/inputSchema';
import {
  GPT_IMAGE_2_SIZE_CONSTRAINTS,
  parseGptImage2SizeKey,
  validateGptImage2CustomImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import { authFetch } from '@/lib/authFetch';
import { readLastKnownUserId } from '@/lib/last-known';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';
import { normalizeJobSurface } from '@/lib/job-surface-normalize';
import { isPlaceholderMediaUrl, resolvePreferredMediaUrl } from '@/lib/media';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { countResolvedVisualSlots } from '@/lib/group-progress';

const AssetLibraryBrowser = dynamic<AssetLibraryBrowserProps>(
  () => import('@/components/library/AssetLibraryBrowser').then((mod) => mod.AssetLibraryBrowser),
  { ssr: false }
);

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

let supabaseClientPromise: Promise<typeof import('@/lib/supabaseClient')['supabase']> | null = null;

function getSupabaseClient(): Promise<typeof import('@/lib/supabaseClient')['supabase']> {
  supabaseClientPromise ??= import('@/lib/supabaseClient').then((mod) => mod.supabase);
  return supabaseClientPromise;
}

interface ImageWorkspaceCopy {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  preview: {
    eyebrow: string;
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    download: string;
    copy: string;
    copied: string;
    cta: string;
  };
  engine: {
    eyebrow: string;
    priceCalculating: string;
    priceLabel: string;
  };
  modeTabs: {
    generate: string;
    edit: string;
  };
  composer: {
    promptLabel: string;
    promptPlaceholder: string;
    promptPlaceholderWithImage: string;
    charCount: string;
    presetsHint: string;
    numImagesLabel: string;
    numImagesCount: string;
    numImagesUnit: {
      singular: string;
      plural: string;
    };
    aspectRatioLabel: string;
    aspectRatioHint: string;
    aspectRatioAutoNote: string;
    resolutionLabel: string;
    resolutionHint: string;
    resolutionLockedLabel: string;
    seedLabel: string;
    seedPlaceholder: string;
    outputFormatLabel: string;
    outputFormatHint: string;
    qualityLabel: string;
    qualityHint: string;
    customWidthLabel: string;
    customHeightLabel: string;
    maskUrlLabel: string;
    maskUrlPlaceholder: string;
    enableWebSearchLabel: string;
    enableWebSearchHint: string;
    thinkingLevelLabel: string;
    thinkingLevelHint: string;
    limitGenerationsLabel: string;
    limitGenerationsHint: string;
    toggleEnabled: string;
    toggleDisabled: string;
    estimatedCost: string;
    referenceLabel: string;
    referenceHelper: string;
    referenceNote: string;
    referenceButton: string;
    characterButton: string;
    characterNote: string;
    characterHiddenNotice: string;
    characterLimitNotice: string;
    referenceExpand: string;
    referenceCollapse: string;
    referenceSlotLabel: string;
    referenceSlotHint: string;
    referenceSlotNameFallback: string;
    referenceSlotActions: {
      upload: string;
      library: string;
      replace: string;
      remove: string;
    };
  };
  history: {
    eyebrow: string;
    empty: string;
    runsLabel: {
      zero: string;
      other: string;
    };
    noPreview: string;
    loadMore: string;
    refreshing: string;
  };
  runButton: {
    idle: string;
    running: string;
  };
  errors: {
    onlyImages: string;
    unsupportedFormat: string;
    uploadFailed: string;
    fileTooLarge: string;
    unauthorized: string;
    promptMissing: string;
    referenceMissing: string;
    generic: string;
  };
  messages: {
    success: string;
    generatingInProgress: string;
    savedToLibrary: string;
    removedFromLibrary: string;
  };
  general: {
    uploading: string;
    cancelUpload: string;
    emptyEngines: string;
  };
  library: {
    button: string;
    empty: string;
    overlay: string;
    unsupported: string;
    supportedFormats: string;
    assetFallback: string;
    tabs: {
      all: string;
      upload: string;
      generated: string;
      character: string;
      angle: string;
      upscale: string;
    };
    modal: {
      title: string;
      description: string;
      close: string;
      error: string;
      empty: string;
      emptyCompatible: string;
      emptyUploads: string;
      emptyGenerated: string;
      emptyCharacter: string;
      emptyAngle: string;
      emptyUpscale: string;
    };
  };
  characterPicker: {
    title: string;
    description: string;
    selected: string;
    select: string;
    done: string;
    empty: string;
    limitLabel: string;
  };
  authGate: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
    close: string;
  };
}

const DEFAULT_COPY: ImageWorkspaceCopy = {
  hero: {
    eyebrow: 'Image workspace',
    title: 'Generate Images',
    subtitle: 'Create and edit high-fidelity images.',
  },
  preview: {
    eyebrow: 'Generate preview',
    title: 'Latest output',
    emptyTitle: 'No preview yet.',
    emptyDescription: 'Run a generation to see the latest image here.',
    download: 'Download',
    copy: 'Copy link',
    copied: 'Copied',
    cta: 'Generate image',
  },
  engine: {
    eyebrow: 'Engine',
    priceCalculating: 'Calculating price…',
    priceLabel: '{amount} / run',
  },
  modeTabs: {
    generate: 'Create',
    edit: 'Edit',
  },
  composer: {
    promptLabel: 'Prompt',
    promptPlaceholder: 'Describe the image you’d like to generate...',
    promptPlaceholderWithImage: 'Describe how the image should be edited / transformed…',
    charCount: '{count} chars',
    presetsHint: 'Tap a preset or start from scratch.',
    numImagesLabel: 'Number of images',
    numImagesCount: '{count} {unit}',
    numImagesUnit: {
      singular: 'image',
      plural: 'images',
    },
    aspectRatioLabel: 'Aspect ratio',
    aspectRatioHint: 'Choose a preset to match your frame.',
    aspectRatioAutoNote: 'Auto lets the model decide the final crop.',
    resolutionLabel: 'Resolution',
    resolutionHint: 'Adjust output size here. Pricing updates automatically.',
    resolutionLockedLabel: 'Resolution locked by this engine.',
    seedLabel: 'Seed',
    seedPlaceholder: 'Optional',
    outputFormatLabel: 'Output format',
    outputFormatHint: 'Choose the file type for the final images.',
    qualityLabel: 'Quality',
    qualityHint: 'Controls model fidelity and cost when supported.',
    customWidthLabel: 'Width',
    customHeightLabel: 'Height',
    maskUrlLabel: 'Mask URL',
    maskUrlPlaceholder: 'Optional public mask image URL',
    enableWebSearchLabel: 'Web search',
    enableWebSearchHint: 'Ground the request with current web context when supported.',
    thinkingLevelLabel: 'Thinking level',
    thinkingLevelHint: 'Increase reasoning depth when the engine supports it.',
    limitGenerationsLabel: 'Limit generations',
    limitGenerationsHint: 'Reduce extra exploratory generations when supported.',
    toggleEnabled: 'Enabled',
    toggleDisabled: 'Disabled',
    estimatedCost: 'Estimated cost: {amount}',
    referenceLabel: 'Reference images',
    referenceHelper: 'Optional · up to {count} images',
    referenceNote:
      'Drag & drop, paste, upload from your device, or pull from your Library. These references are required for Edit mode.',
    referenceButton: 'Library',
    characterButton: 'Characters',
    characterNote: 'Pick generated characters to use as identity anchors.',
    characterHiddenNotice: 'Selected characters are saved and will be reused when you switch back to a compatible engine.',
    characterLimitNotice: 'Only the first {count} character reference{suffix} will be used with this engine.',
    referenceExpand: 'Show {count} more slots',
    referenceCollapse: 'Hide extra slots',
    referenceSlotLabel: 'Slot {index}',
    referenceSlotHint: 'Drop image, click to upload, paste, or choose from your library.',
    referenceSlotNameFallback: 'Image',
    referenceSlotActions: {
      upload: 'Upload',
      library: 'Library',
      replace: 'Replace',
      remove: 'Remove',
    },
  },
  history: {
    eyebrow: 'Recent run',
    empty: 'Launch a generation to populate your history. Each image variant appears below.',
    runsLabel: {
      zero: 'No runs yet',
      other: '{count} runs',
    },
    noPreview: 'No preview',
    loadMore: 'Load more',
    refreshing: 'Refreshing history…',
  },
  runButton: {
    idle: 'Generate images',
    running: 'Generating…',
  },
  errors: {
    onlyImages: 'Only image files are supported.',
    unsupportedFormat: 'This engine accepts {formats}.',
    uploadFailed: 'Unable to upload the selected image. Try again.',
    fileTooLarge: 'Image exceeds {maxMB} MB. Compress it or choose a smaller file.',
    unauthorized: 'Session expired — please sign in again and retry the upload.',
    promptMissing: 'Prompt is required.',
    referenceMissing: 'Provide at least one source image for edit mode.',
    generic: 'Image generation failed.',
  },
  messages: {
    success: 'Generated {count} image{suffix}.',
    generatingInProgress: 'Generating in progress ({count})…',
    savedToLibrary: 'Saved to Library.',
    removedFromLibrary: 'Removed from Library.',
  },
  general: {
    uploading: 'Uploading…',
    cancelUpload: 'Cancel upload',
    emptyEngines: 'No image engines available.',
  },
  library: {
    button: 'Library',
    empty: 'No assets saved yet. Upload images from the composer or the Library page.',
    overlay: 'Use this image',
    unsupported: 'Unsupported format',
    supportedFormats: 'Supported formats: {formats}',
    assetFallback: 'Asset',
    tabs: {
      all: 'All images',
      upload: 'Uploaded images',
      generated: 'Generated images',
      character: 'Character assets',
      angle: 'Angle assets',
      upscale: 'Upscale assets',
    },
    modal: {
      title: 'Select from library',
      description: 'Choose an image you previously imported.',
      close: 'Close',
      error: 'Unable to load assets. Please retry.',
      empty: 'No assets saved yet. Upload images from the composer or the Library page.',
      emptyCompatible: 'No compatible assets for this model yet.',
      emptyUploads: 'No uploaded images yet. Upload images from the composer or the Library page.',
      emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
      emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
      emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
      emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
    },
  },
  characterPicker: {
    title: 'Select characters',
    description: 'Choose from your Character Builder outputs. Selected characters are added as identity references.',
    selected: 'Selected',
    select: 'Select',
    done: 'Done',
    empty: 'No character references yet. Generate one in the Character Builder first.',
    limitLabel: 'Up to {count} character reference{suffix}',
  },
  authGate: {
    title: 'Create an account to render',
    body: 'You can explore the image workspace, but starting a real image generation requires an account.',
    primary: 'Create account',
    secondary: 'Sign in',
    close: 'Maybe later',
  },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeCopy<T>(defaults: T, overrides?: Partial<T> | null): T {
  if (!isPlainRecord(defaults) || !isPlainRecord(overrides)) return defaults;
  const next: Record<string, unknown> = { ...defaults };
  Object.entries(overrides).forEach(([key, overrideValue]) => {
    const defaultValue = next[key];
    if (isPlainRecord(defaultValue) && isPlainRecord(overrideValue)) {
      next[key] = mergeCopy(defaultValue, overrideValue);
      return;
    }
    if (overrideValue !== undefined) {
      next[key] = overrideValue;
    }
  });
  return next as T;
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

function formatImageSizeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    auto: 'Auto',
    square: 'Square',
    square_hd: 'Square HD',
    portrait_4_3: 'Portrait 4:3',
    portrait_16_9: 'Portrait 16:9',
    landscape_4_3: 'Landscape 4:3',
    landscape_16_9: 'Landscape 16:9',
    custom: 'Custom size',
  };
  const parsed = parseGptImage2SizeKey(normalized);
  if (parsed) {
    return `${parsed.width} x ${parsed.height}`;
  }
  return labels[normalized] ?? value.toUpperCase();
}

function formatQualityLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  return value;
}

function buildCustomImageSize(width: string, height: string): GptImage2ImageSize | null {
  const parsedWidth = Number(width);
  const parsedHeight = Number(height);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return null;
  }
  return {
    width: Math.round(parsedWidth),
    height: Math.round(parsedHeight),
  };
}

const MAX_REFERENCE_SLOTS = MAX_REFERENCE_IMAGES;
const DEFAULT_VISIBLE_REFERENCE_SLOTS = 4;
const QUICK_IMAGE_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;
const DESKTOP_RAIL_MIN_WIDTH = 1088;
const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

const IMAGE_COMPOSER_STORAGE_KEY = 'maxvideoai.image.composer.v1';
const IMAGE_COMPOSER_STORAGE_VERSION = 4;
const IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS = 1200;

function normalizeEngineToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findImageEngine(engines: ImageEngineOption[], engineId: string): ImageEngineOption | null {
  const trimmed = engineId.trim();
  if (!trimmed) return null;
  const direct = engines.find((entry) => entry.id === trimmed);
  if (direct) return direct;
  const token = normalizeEngineToken(trimmed);
  if (!token) return null;
  return (
    engines.find((entry) => normalizeEngineToken(entry.id) === token) ??
    engines.find((entry) => normalizeEngineToken(entry.name) === token) ??
    engines.find((entry) => (entry.aliases ?? []).some((alias) => normalizeEngineToken(alias) === token)) ??
    null
  );
}

type PromptPreset = {
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

type HistoryEntry = {
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

type UploadFailure = Error & { code?: string; maxMB?: number };

type ReferenceSlotValue = {
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

type PersistedReferenceSlot =
  | {
      url: string;
      source?: ReferenceSlotValue['source'];
      width?: number | null;
      height?: number | null;
      characterReference?: PersistedCharacterReference | null;
    }
  | null;
type PersistedCharacterReference = CharacterReferenceSelection;

type PersistedImageComposerState = {
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

function parsePersistedImageComposerState(value: string): PersistedImageComposerState | null {
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
    const seed =
      typeof raw.seed === 'number' && Number.isFinite(raw.seed) ? Math.round(raw.seed) : null;
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
        const width = typeof (record as { width?: unknown }).width === 'number' ? Math.round((record as { width: number }).width) : null;
        const height = typeof (record as { height?: unknown }).height === 'number' ? Math.round((record as { height: number }).height) : null;
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

type LibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

type AssetsResponse = {
  ok: boolean;
  assets: LibraryAsset[];
};

type ImageLibraryModalState = {
  open: boolean;
  slotIndex: number | null;
  selectionMode: 'reference' | 'character';
  initialSource: AssetLibrarySource;
};

type PricingEstimateResponse = {
  ok: boolean;
  pricing: PricingSnapshot;
};

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
}

function getCharacterReferenceLabel(reference: CharacterReferenceSelection): string {
  if (reference.action === 'lighting-variant') return 'Lighting variant';
  if (reference.action === 'full-body-fix') return 'Full-body fix';
  if (reference.outputMode === 'character-sheet') return 'Character sheet';
  return 'Portrait reference';
}

function formatCharacterReferenceDate(value?: string | null): string {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function parseCharacterReferenceEntry(entry: unknown): PersistedCharacterReference | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Partial<CharacterReferenceSelection>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return null;
  return {
    id,
    jobId,
    imageUrl,
    thumbUrl: typeof record.thumbUrl === 'string' ? record.thumbUrl : null,
    prompt: typeof record.prompt === 'string' ? record.prompt : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    engineLabel: typeof record.engineLabel === 'string' ? record.engineLabel : null,
    outputMode:
      record.outputMode === 'portrait-reference' || record.outputMode === 'character-sheet'
        ? record.outputMode
        : null,
    action:
      record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
        ? record.action
        : null,
  };
}

function createCharacterReferenceSlot(
  reference: CharacterReferenceSelection,
  idPrefix = 'character'
): ReferenceSlotValue {
  return {
    id: `${idPrefix}-${reference.id}`,
    url: reference.imageUrl,
    previewUrl: reference.thumbUrl ?? reference.imageUrl,
    name: getCharacterReferenceLabel(reference),
    status: 'ready',
    source: 'character',
    characterReference: reference,
  };
}

function mergeCharacterReferencesIntoSlots(
  slots: Array<ReferenceSlotValue | null>,
  references: CharacterReferenceSelection[],
  limit: number
): Array<ReferenceSlotValue | null> {
  if (!references.length || limit <= 0) return slots;
  const next = slots.slice();
  references.forEach((reference) => {
    if (next.some((slot) => slot?.characterReference?.id === reference.id)) {
      return;
    }
    const existingUrlIndex = next.findIndex((slot) => slot?.url === reference.imageUrl);
    if (existingUrlIndex >= 0) {
      next[existingUrlIndex] = {
        ...(next[existingUrlIndex] as ReferenceSlotValue),
        source: 'character',
        characterReference: reference,
        name: getCharacterReferenceLabel(reference),
        previewUrl: next[existingUrlIndex]?.previewUrl ?? reference.thumbUrl ?? reference.imageUrl,
      };
      return;
    }
    const emptyIndex = next.slice(0, limit).findIndex((slot) => slot === null);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : -1;
    if (targetIndex >= 0) {
      next[targetIndex] = createCharacterReferenceSlot(reference);
    }
  });
  return next;
}

function mapJobToHistoryEntry(job: Job): HistoryEntry | null {
  const renderUrls = Array.isArray(job.renderIds)
    ? job.renderIds.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const renderThumbUrls = Array.isArray(job.renderThumbUrls)
    ? job.renderThumbUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const heroOriginal = typeof job.heroRenderId === 'string' && job.heroRenderId.length ? job.heroRenderId : null;
  const images: GeneratedImage[] =
    renderUrls.length > 0
      ? renderUrls.map((url, index) => ({
          url,
          thumbUrl: resolvePreferredMediaUrl(renderThumbUrls[index], index === 0 ? job.thumbUrl ?? null : null, url),
        }))
      : (() => {
          const thumbUrl = resolvePreferredMediaUrl(job.thumbUrl, heroOriginal);
          if (!thumbUrl || isPlaceholderMediaUrl(thumbUrl)) {
            return [];
          }
          return [{ url: heroOriginal ?? thumbUrl, thumbUrl }];
        })();
  if (!images.length) return null;
  const timestamp = Date.parse(job.createdAt ?? '');
  return {
    id: job.jobId,
    jobId: job.jobId,
    engineId: job.engineId ?? '',
    engineLabel: job.engineLabel ?? job.engineId ?? 'Image generation',
    mode: 't2i',
    prompt: job.prompt ?? '',
    createdAt: Number.isNaN(timestamp) ? Date.now() : timestamp,
    description: job.message ?? null,
    images,
    aspectRatio: job.aspectRatio ?? null,
  };
}

function buildPendingGroup({
  id,
  engineId,
  engineLabel,
  prompt,
  count,
  createdAt,
}: {
  id: string;
  engineId: string;
  engineLabel: string;
  prompt: string;
  count: number;
  createdAt: number;
}): GroupSummary {
  const normalizedCount = Math.max(1, Math.round(count));
  const previewCount = Math.min(4, normalizedCount);
  const createdAtIso = new Date(createdAt).toISOString();
  const members: GroupMemberSummary[] = Array.from({ length: previewCount }, (_, index) => ({
    id: `${id}-pending-${index + 1}`,
    engineId,
    engineLabel,
    durationSec: 0,
    prompt,
    createdAt: createdAtIso,
    source: 'render',
    status: 'pending',
    iterationIndex: index,
    iterationCount: normalizedCount,
  }));

  return {
    id,
    source: 'active',
    splitMode: normalizedCount > 1 ? 'quad' : 'single',
    count: normalizedCount,
    totalPriceCents: null,
    createdAt: createdAtIso,
    hero: members[0],
    previews: members.map((member) => ({
      id: member.id,
      thumbUrl: null,
      videoUrl: null,
      aspectRatio: null,
    })),
    members,
  };
}

function buildCompletedGroup({
  id,
  engineId,
  engineLabel,
  prompt,
  aspectRatio,
  images,
  createdAt,
  totalPriceCents,
  currency,
}: {
  id: string;
  engineId: string;
  engineLabel: string;
  prompt: string;
  aspectRatio: string | null;
  images: GeneratedImage[];
  createdAt: number;
  totalPriceCents?: number | null;
  currency?: string | null;
}): GroupSummary {
  const createdAtIso = new Date(createdAt).toISOString();
  const members: GroupMemberSummary[] = images.map((image, index) => ({
    id: `${id}-image-${index + 1}`,
    jobId: id,
    engineId,
    engineLabel,
    durationSec: 0,
    priceCents: totalPriceCents ?? null,
    currency: currency ?? null,
    thumbUrl: image.url,
    aspectRatio,
    prompt,
    status: 'completed',
    progress: 100,
    createdAt: createdAtIso,
    source: 'render',
  }));

  return {
    id,
    source: 'active',
    splitMode: members.length > 1 ? 'quad' : 'single',
    count: members.length,
    totalPriceCents: totalPriceCents ?? null,
    currency: currency ?? null,
    createdAt: createdAtIso,
    hero: members[0],
    previews: images.map((image, index) => ({
      id: `${id}-preview-${index + 1}`,
      thumbUrl: image.url,
      videoUrl: null,
      aspectRatio,
      source: 'render',
    })),
    members,
  };
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
  const hasHydratedStorageRef = useRef(false);
  const hydratedJobRef = useRef<string | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const persistedSignatureRef = useRef<string | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
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
  const [referenceSlots, setReferenceSlots] = useState<(ReferenceSlotValue | null)[]>(
    Array(MAX_REFERENCE_SLOTS).fill(null)
  );
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [selectedPreviewEntryId, setSelectedPreviewEntryId] = useState<string | null>(null);
  const [selectedPreviewImageIndex, setSelectedPreviewImageIndex] = useState(0);
  const [pendingGroups, setPendingGroups] = useState<GroupSummary[]>([]);
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [areReferenceSlotsExpanded, setAreReferenceSlotsExpanded] = useState(false);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [isRemovingFromLibrary, setIsRemovingFromLibrary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);
  const [libraryModal, setLibraryModal] = useState<ImageLibraryModalState>({
    open: false,
    slotIndex: null,
    selectionMode: 'reference',
    initialSource: 'all',
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [
    priceEstimateKey,
    setPriceEstimateKey,
  ] = useState<[string, string, ImageGenerationMode, number, string, string, boolean, string, string, string] | null>(() =>
    engines[0] ? ['image-pricing', engines[0].id, 't2i', 1, '', '', false, '', '', ''] : null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_RAIL_MIN_WIDTH}px)`);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopLayout(event.matches);
    };
    handleChange(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const engineCapsList = useMemo(() => engines.map((engine) => engine.engineCaps), [engines]);
  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const autoModeFromReferences = Boolean(
    selectedEngine && selectedEngine.modes.includes('t2i') && selectedEngine.modes.includes('i2i')
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;
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
  const isResolutionLocked = Boolean(resolutionField && resolutionOptions.length === 1);
  const referenceConstraints = useMemo(
    () =>
      selectedEngineCaps
        ? getReferenceConstraints(selectedEngineCaps, mode)
        : { min: mode === 'i2i' ? 1 : 0, max: 4, requires: mode === 'i2i' },
    [selectedEngineCaps, mode]
  );
  const supportedReferenceFormats = useMemo(
    () => getSupportedImageFormats(selectedEngineCaps ?? null),
    [selectedEngineCaps]
  );
  const supportedReferenceFormatsLabel = useMemo(
    () => formatSupportedImageFormatsLabel(supportedReferenceFormats),
    [supportedReferenceFormats]
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
  const referenceMinRequired = referenceConstraints.min;
  const referencePickerConstraints = useMemo(
    () =>
      autoModeFromReferences && selectedEngineCaps
        ? getReferenceConstraints(selectedEngineCaps, 'i2i')
        : referenceConstraints,
    [autoModeFromReferences, referenceConstraints, selectedEngineCaps]
  );
  const baseReferenceSlotLimit = Math.min(MAX_REFERENCE_SLOTS, referencePickerConstraints.max);
  const supportsCharacterReferences = toolsEnabled && baseReferenceSlotLimit > 0;
  const visibleReferenceSlots = useMemo(
    () => referenceSlots.slice(0, baseReferenceSlotLimit),
    [baseReferenceSlotLimit, referenceSlots]
  );
  const referenceSizeSignature = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => `${slot.width ?? ''}x${slot.height ?? ''}`)
        .join('|'),
    [visibleReferenceSlots]
  );
  const selectedCharacterReferences = useMemo(
    () =>
      visibleReferenceSlots.reduce<CharacterReferenceSelection[]>((acc, slot) => {
        if (slot?.characterReference) {
          acc.push(slot.characterReference);
        }
        return acc;
      }, []),
    [visibleReferenceSlots]
  );
  const totalRegularReferenceSelections = useMemo(
    () => visibleReferenceSlots.filter((slot) => Boolean(slot && !slot.characterReference)).length,
    [visibleReferenceSlots]
  );
  const characterSelectionLimit = useMemo(
    () =>
      supportsCharacterReferences
        ? Math.max(0, baseReferenceSlotLimit - totalRegularReferenceSelections)
        : 0,
    [baseReferenceSlotLimit, supportsCharacterReferences, totalRegularReferenceSelections]
  );
  const referenceSlotLimit = baseReferenceSlotLimit;
  const canCollapseReferenceSlots = referenceSlotLimit > DEFAULT_VISIBLE_REFERENCE_SLOTS;
  const displayedReferenceSlotCount =
    canCollapseReferenceSlots && !areReferenceSlotsExpanded
      ? DEFAULT_VISIBLE_REFERENCE_SLOTS
      : referenceSlotLimit;
  const displayedReferenceSlots = useMemo(
    () => visibleReferenceSlots.slice(0, displayedReferenceSlotCount),
    [displayedReferenceSlotCount, visibleReferenceSlots]
  );
  const collapsedReferenceSlotCount = Math.max(referenceSlotLimit - displayedReferenceSlotCount, 0);
  const hasCollapsedReferenceContent = useMemo(
    () =>
      referenceSlots
        .slice(DEFAULT_VISIBLE_REFERENCE_SLOTS, referenceSlotLimit)
        .some((slot) => Boolean(slot)),
    [referenceSlotLimit, referenceSlots]
  );
  const referenceHelperText = useMemo(
    () => formatTemplate(resolvedCopy.composer.referenceHelper, { count: referenceSlotLimit }),
    [referenceSlotLimit, resolvedCopy.composer.referenceHelper]
  );
  const referenceToggleLabel = useMemo(
    () =>
      areReferenceSlotsExpanded
        ? resolvedCopy.composer.referenceCollapse
        : formatTemplate(resolvedCopy.composer.referenceExpand, { count: collapsedReferenceSlotCount }),
    [
      areReferenceSlotsExpanded,
      collapsedReferenceSlotCount,
      resolvedCopy.composer.referenceCollapse,
      resolvedCopy.composer.referenceExpand,
    ]
  );
  useEffect(() => {
    setNumImages((previous) => clampRequestedImageCount(selectedEngineCaps ?? null, mode, previous));
  }, [selectedEngineCaps, mode]);

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
  }, [aspectRatioField, aspectRatioOptions, selectedEngineCaps, mode]);

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
  }, [resolutionField, resolutionOptions, selectedEngineCaps, mode]);

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
  }, [customImageHeightField, customImageWidthField, selectedEngineCaps, mode]);

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
  }, [seedField, selectedEngineCaps, mode]);

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
  }, [outputFormatField, outputFormatOptions, selectedEngineCaps, mode]);

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
  }, [qualityField, qualityOptions, selectedEngineCaps, mode]);

  useEffect(() => {
    if (!maskUrlField) {
      setMaskUrl('');
    }
  }, [maskUrlField]);

  useEffect(() => {
    if (!enableWebSearchField) {
      setEnableWebSearch(false);
      return;
    }
    const defaultValue = getImageFieldDefaultBoolean(selectedEngineCaps ?? null, 'enable_web_search', mode);
    setEnableWebSearch((previous) => previous ?? defaultValue ?? false);
  }, [enableWebSearchField, selectedEngineCaps, mode]);

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
  }, [thinkingLevelField, thinkingLevelOptions, selectedEngineCaps, mode]);

  useEffect(() => {
    if (!limitGenerationsField) {
      setLimitGenerations(false);
      return;
    }
    const defaultValue = getImageFieldDefaultBoolean(selectedEngineCaps ?? null, 'limit_generations', mode);
    setLimitGenerations((previous) => previous ?? defaultValue ?? false);
  }, [limitGenerationsField, selectedEngineCaps, mode]);

  useEffect(() => {
    if (!selectedEngine) return;
    setPriceEstimateKey([
      'image-pricing',
      selectedEngine.id,
      mode,
      numImages,
      resolution ?? '',
      quality ?? '',
      enableWebSearch,
      customImageWidth,
      customImageHeight,
      referenceSizeSignature,
    ]);
  }, [selectedEngine, mode, numImages, resolution, quality, enableWebSearch, customImageWidth, customImageHeight, referenceSizeSignature]);

  const {
    data: pricingData,
    error: pricingError,
  } = useSWR(
    priceEstimateKey,
    async ([
      ,
      engineId,
      requestMode,
      count,
      requestResolution,
      requestQuality,
      requestEnableWebSearch,
      requestCustomWidth,
      requestCustomHeight,
    ]) => {
      const requestCustomImageSize =
        requestResolution === 'custom'
          ? buildCustomImageSize(requestCustomWidth, requestCustomHeight)
          : null;
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          mode: requestMode,
          numImages: count,
          resolution: requestResolution || undefined,
          customImageSize: requestCustomImageSize,
          referenceImageSizes: requestMode === 'i2i' ? readyReferenceSizes : undefined,
          quality: requestQuality || undefined,
          enableWebSearch: requestEnableWebSearch || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as PricingEstimateResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to estimate price');
      }
      return payload;
    },
    {
      keepPreviousData: true,
    }
  );

  const pricingSnapshot = pricingData?.pricing ?? null;

  const {
    data: jobPages,
    mutate: mutateJobs,
  } = useInfiniteJobs(24, { surface: 'image' });

  const imageEngineAliasSet = useMemo(() => {
    const set = new Set<string>();
    engines.forEach((option) => {
      const aliases = option.aliases?.length ? option.aliases : [option.engineCaps.id, option.id];
      aliases.forEach((alias) => {
        if (typeof alias === 'string' && alias.trim().length) {
          set.add(alias.trim().toLowerCase());
        }
      });
    });
    return set;
  }, [engines]);

  const isImageJob = useCallback(
    (job: Job) => {
      const surface = normalizeJobSurface(job.surface);
      if (surface) {
        return surface === 'image';
      }
      const check = (value: string | null | undefined) =>
        Boolean(value && imageEngineAliasSet.has(value.trim().toLowerCase()));
      if (check(job.engineId)) return true;
      if (check(job.engineLabel)) return true;
      if (!job.videoUrl && Array.isArray(job.renderIds) && job.renderIds.length > 0) return true;
      return false;
    },
    [imageEngineAliasSet]
  );

  const remoteImageJobs = useMemo(() => {
    if (!jobPages) return [];
    return jobPages
      .flatMap((page) => page.jobs ?? [])
      .filter((job) => isImageJob(job));
  }, [jobPages, isImageJob]);

  const remoteHistory = useMemo(() => {
    if (!remoteImageJobs.length) return [];
    return remoteImageJobs
      .map((job) => mapJobToHistoryEntry(job))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  }, [remoteImageJobs]);

  const remoteResolvedGroupMap = useMemo(() => {
    if (!remoteImageJobs.length) return new Map<string, number>();
    const { groups } = groupJobsIntoSummaries(remoteImageJobs, { includeSinglesAsGroups: true });
    const map = new Map<string, number>();
    groups.forEach((group) => {
      const resolvedCount = countResolvedVisualSlots(group);
      const candidateIds = new Set<string>();
      candidateIds.add(group.id);
      if (group.hero.jobId) {
        candidateIds.add(group.hero.jobId);
      }
      group.members.forEach((member) => {
        if (member.jobId) {
          candidateIds.add(member.jobId);
        }
      });
      candidateIds.forEach((candidateId) => {
        if (!candidateId) return;
        map.set(candidateId, Math.max(map.get(candidateId) ?? 0, resolvedCount));
      });
    });
    return map;
  }, [remoteImageJobs]);

  const combinedHistory = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    remoteHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    localHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [localHistory, remoteHistory]);

  useEffect(() => {
    if (!remoteResolvedGroupMap.size) return;
    setPendingGroups((previous) =>
      previous.filter((group) => {
        const expectedCount = Math.max(1, Math.min(4, group.count || group.members.length || 1));
        const relatedIds = new Set<string>();
        relatedIds.add(group.id);
        if (group.hero.jobId) {
          relatedIds.add(group.hero.jobId);
        }
        group.members.forEach((member) => {
          if (member.jobId) {
            relatedIds.add(member.jobId);
          }
        });
        for (const candidateId of relatedIds) {
          const resolvedCount = remoteResolvedGroupMap.get(candidateId) ?? 0;
          if (resolvedCount >= expectedCount) {
            return false;
          }
        }
        return true;
      })
    );
  }, [remoteResolvedGroupMap]);

  useEffect(() => {
    if (!pendingGroups.length) return;
    const intervalId = window.setInterval(() => {
      void mutateJobs();
    }, 2000);
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 30000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [mutateJobs, pendingGroups]);

  const readyReferenceUrls = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => slot.url),
    [visibleReferenceSlots]
  );
  const readyReferenceSizes = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => ({ width: slot.width ?? null, height: slot.height ?? null })),
    [visibleReferenceSlots]
  );
  const combinedReferenceUrls = readyReferenceUrls;
  const hasAnyReferenceSelection = useMemo(
    () => visibleReferenceSlots.some((slot) => Boolean(slot)),
    [visibleReferenceSlots]
  );
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

  const handleOpenHistoryEntry = useCallback((entry: HistoryEntry) => {
    if (!entry.images.length) return;
    const group = buildVideoGroupFromImageRun({
      id: entry.id,
      jobId: entry.jobId ?? entry.id,
      createdAt: entry.createdAt,
      prompt: entry.prompt,
      engineLabel: entry.engineLabel,
      engineId: entry.engineId,
      aspectRatio: entry.aspectRatio ?? null,
      images: entry.images.map((image) => ({
        url: image.url,
        thumbUrl: image.thumbUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
      })),
    });
    setViewerGroup(group);
  }, []);

  const closeViewer = useCallback(() => setViewerGroup(null), []);

  const handleSaveVariantToLibrary = useCallback(async (entry: MediaLightboxEntry) => {
    const mediaUrl = entry.videoUrl ?? entry.audioUrl ?? entry.imageUrl ?? entry.thumbUrl;
    if (!mediaUrl) {
      throw new Error('No image available to save');
    }
    await saveImageToLibrary({
      url: mediaUrl,
      jobId: entry.jobId ?? entry.id,
      label: entry.label ?? undefined,
    });
  }, []);

  const cleanupSlotPreview = useCallback((slot: ReferenceSlotValue | null) => {
    if (slot?.previewUrl && slot.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(slot.previewUrl);
      } catch {}
    }
  }, []);

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
  }, [engines]);

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

  useEffect(() => {
    if (!requestedEngineId) return;
    const engineMatch = findImageEngine(engines, requestedEngineId);
    if (!engineMatch) return;
    setEngineId(engineMatch.id);
    setMode((previous) => (engineMatch.modes.includes(previous) ? previous : engineMatch.modes[0] ?? 't2i'));
  }, [engines, requestedEngineId]);

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
      const maskUrlRaw = typeof core.maskUrl === 'string' ? core.maskUrl : null;
      const enableWebSearchRaw = core.enableWebSearch === true;
      const thinkingLevelRaw = typeof core.thinkingLevel === 'string' ? core.thinkingLevel : null;
      const limitGenerationsRaw = core.limitGenerations === true;
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
      } else {
        setResolution(resolutionRaw);
        const restoredCustomSize = customImageSizeRawParsed ?? parseGptImage2SizeKey(resolutionRaw);
        setCustomImageWidth(restoredCustomSize ? String(restoredCustomSize.width) : '');
        setCustomImageHeight(restoredCustomSize ? String(restoredCustomSize.height) : '');
        setAspectRatio(aspectRatioRaw);
        setSeed(seedRaw == null ? '' : String(seedRaw));
        setOutputFormat(outputFormatRaw);
        setQuality(qualityRaw);
        setMaskUrl(maskUrlRaw ?? '');
        setEnableWebSearch(enableWebSearchRaw);
        setThinkingLevel(thinkingLevelRaw);
        setLimitGenerations(limitGenerationsRaw);
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
    [engines]
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
        setError(error instanceof Error ? error.message : resolvedCopy.errors.generic);
      });
  }, [applyImageSettingsSnapshot, requestedJobId, resolvedCopy.errors.generic]);

  const persistableReferenceSlots = useMemo<PersistedReferenceSlot[]>(
    () =>
      referenceSlots.slice(0, MAX_REFERENCE_SLOTS).map((slot) => {
        if (!slot || slot.status !== 'ready') return null;
        const url = slot.url?.trim?.() ?? '';
        if (!url || url.startsWith('blob:')) return null;
        return {
          url,
          source: slot.source,
          width: slot.width ?? null,
          height: slot.height ?? null,
          characterReference: slot.characterReference
            ? {
                id: slot.characterReference.id,
                jobId: slot.characterReference.jobId,
                imageUrl: slot.characterReference.imageUrl,
                thumbUrl: slot.characterReference.thumbUrl ?? null,
                prompt: slot.characterReference.prompt ?? null,
                createdAt: slot.characterReference.createdAt ?? null,
                engineLabel: slot.characterReference.engineLabel ?? null,
                outputMode: slot.characterReference.outputMode ?? null,
                action: slot.characterReference.action ?? null,
              }
            : null,
        };
      }),
    [referenceSlots]
  );

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

  useEffect(() => {
    setReferenceSlots((previous) => {
      let mutated = false;
      const next = previous.slice();
      for (let index = baseReferenceSlotLimit; index < next.length; index += 1) {
        if (next[index]) {
          cleanupSlotPreview(next[index]);
          next[index] = null;
          mutated = true;
        }
      }
      return mutated ? next : previous;
    });
  }, [baseReferenceSlotLimit, cleanupSlotPreview]);

  useEffect(() => {
    if (!canCollapseReferenceSlots && areReferenceSlotsExpanded) {
      setAreReferenceSlotsExpanded(false);
    }
  }, [areReferenceSlotsExpanded, canCollapseReferenceSlots]);

  useEffect(() => {
    if (!areReferenceSlotsExpanded && hasCollapsedReferenceContent) {
      setAreReferenceSlotsExpanded(true);
    }
  }, [areReferenceSlotsExpanded, hasCollapsedReferenceContent]);

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

  const showUnsupportedFormatError = useCallback(() => {
    setError(
      formatTemplate(resolvedCopy.errors.unsupportedFormat, {
        formats: supportedReferenceFormatsLabel || 'JPG, JPEG, PNG, WEBP',
      })
    );
  }, [resolvedCopy.errors.unsupportedFormat, supportedReferenceFormatsLabel]);

  const isSupportedReferenceAsset = useCallback(
    (mime?: string | null, locator?: string | null) => {
      if (!supportedReferenceFormats.length) return true;
      const supportedByMime = isSupportedImageMime(supportedReferenceFormats, mime);
      if (supportedByMime != null) {
        return supportedByMime;
      }
      const inferredFormat = inferImageFormatFromUrl(locator);
      if (!inferredFormat) {
        return true;
      }
      return isSupportedImageFormat(supportedReferenceFormats, inferredFormat);
    },
    [supportedReferenceFormats]
  );

  const handleRemoveReferenceSlot = useCallback(
    (index: number) => {
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = null;
        return next;
      });
    },
    [cleanupSlotPreview]
  );

  const handleReferenceFile = useCallback(
    async (index: number, file: File | null) => {
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError(resolvedCopy.errors.onlyImages);
        return;
      }
      const tempUrl = URL.createObjectURL(file);
      const slotId = crypto.randomUUID();
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: slotId,
          url: tempUrl,
          previewUrl: tempUrl,
          name: file.name,
          status: 'uploading',
          source: 'upload',
        };
        return next;
      });
      try {
        const preparedFile = await prepareImageFileForUpload(file, {
          maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
        });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          const uploadError = new Error(
            typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED'
          ) as UploadFailure;
          uploadError.code = typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED';
          if (typeof payload?.maxMB === 'number') {
            uploadError.maxMB = payload.maxMB;
          }
          throw uploadError;
        }
        const asset = payload.asset as {
          id: string;
          url: string;
          width?: number | null;
          height?: number | null;
        };
        setReferenceSlots((previous) => {
          const next = previous.slice();
          const current = next[index];
          if (!current || current.id !== slotId) {
            return previous;
          }
          next[index] = {
            id: slotId,
            url: asset.url,
            previewUrl: asset.url,
            name: file.name,
            status: 'ready',
            source: 'upload',
            width: asset.width ?? null,
            height: asset.height ?? null,
          };
          if (current.previewUrl && current.previewUrl !== asset.url) {
            try {
              URL.revokeObjectURL(current.previewUrl);
            } catch {}
          }
          return next;
        });
      } catch (uploadError) {
        console.error('[image-workspace] reference upload failed', uploadError);
        setReferenceSlots((previous) => {
          const next = previous.slice();
          const current = next[index];
          if (current?.previewUrl) {
            try {
              URL.revokeObjectURL(current.previewUrl);
            } catch {}
          }
          next[index] = null;
          return next;
        });
        const failure = uploadError as UploadFailure;
        const code = failure?.code;
        if (code === 'FILE_TOO_LARGE') {
          const limit =
            typeof failure?.maxMB === 'number' && Number.isFinite(failure.maxMB)
              ? failure.maxMB
              : DEFAULT_UPLOAD_LIMIT_MB;
          setError(formatTemplate(resolvedCopy.errors.fileTooLarge, { maxMB: limit }));
        } else if (code === 'UNAUTHORIZED') {
          setError(resolvedCopy.errors.unauthorized);
        } else {
          setError(resolvedCopy.errors.uploadFailed);
        }
      }
    },
    [
      cleanupSlotPreview,
      resolvedCopy.errors.onlyImages,
      resolvedCopy.errors.uploadFailed,
      resolvedCopy.errors.fileTooLarge,
      resolvedCopy.errors.unauthorized,
    ]
  );

  const handleReferenceUrl = useCallback(
    (index: number, url: string, source: ReferenceSlotValue['source']) => {
      if (!url) return;
      if (!isSupportedReferenceAsset(null, url)) {
        showUnsupportedFormatError();
        return;
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: crypto.randomUUID(),
          url,
          previewUrl: url,
          status: 'ready',
          source: source ?? 'paste',
        };
        return next;
      });
    },
    [cleanupSlotPreview, isSupportedReferenceAsset, showUnsupportedFormatError]
  );

  const resolveTargetReferenceSlotIndex = useCallback(
    (preferredIndex: number | null = null) => {
      if (preferredIndex != null && preferredIndex >= 0 && preferredIndex < referenceSlotLimit) {
        return preferredIndex;
      }
      const emptyIndex = referenceSlots.slice(0, referenceSlotLimit).findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        return emptyIndex;
      }
      return Math.max(0, referenceSlotLimit - 1);
    },
    [referenceSlotLimit, referenceSlots]
  );

  const handleLibrarySelect = useCallback(
    (asset: LibraryAsset) => {
      if (!isSupportedReferenceAsset(asset.mime, asset.url)) {
        showUnsupportedFormatError();
        return;
      }
      const slotIndex = resolveTargetReferenceSlotIndex(libraryModal.slotIndex);
      if (slotIndex >= referenceSlotLimit) {
        setLibraryModal({ open: false, slotIndex: null, selectionMode: 'reference', initialSource: 'all' });
        return;
      }
      const index = slotIndex;
      if (index >= DEFAULT_VISIBLE_REFERENCE_SLOTS && canCollapseReferenceSlots) {
        setAreReferenceSlotsExpanded(true);
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[index]);
        next[index] = {
          id: asset.id,
          url: asset.url,
          previewUrl: asset.url,
          status: 'ready',
          source: 'library',
          width: asset.width ?? null,
          height: asset.height ?? null,
        };
        return next;
      });
      setLibraryModal({ open: false, slotIndex: null, selectionMode: 'reference', initialSource: 'all' });
    },
    [
      canCollapseReferenceSlots,
      cleanupSlotPreview,
      isSupportedReferenceAsset,
      libraryModal.slotIndex,
      referenceSlotLimit,
      resolveTargetReferenceSlotIndex,
      showUnsupportedFormatError,
    ]
  );

  const openLibraryForSlot = useCallback(
    (index: number) => {
      setLibraryModal({ open: true, slotIndex: index, selectionMode: 'reference', initialSource: 'all' });
    },
    []
  );

  const toggleCharacterReference = useCallback(
    (reference: CharacterReferenceSelection) => {
      if (!supportsCharacterReferences) {
        return;
      }
      const existingIndex = referenceSlots.findIndex((slot) => slot?.characterReference?.id === reference.id);
      if (existingIndex >= 0) {
        setReferenceSlots((previous) => {
          const next = previous.slice();
          cleanupSlotPreview(next[existingIndex]);
          next[existingIndex] = null;
          return next;
        });
        return;
      }
      if (selectedCharacterReferences.length >= characterSelectionLimit) {
        return;
      }
      const nextIndex = resolveTargetReferenceSlotIndex(libraryModal.slotIndex);
      if (nextIndex >= referenceSlotLimit) {
        return;
      }
      if (nextIndex >= DEFAULT_VISIBLE_REFERENCE_SLOTS && canCollapseReferenceSlots) {
        setAreReferenceSlotsExpanded(true);
      }
      setReferenceSlots((previous) => {
        const next = previous.slice();
        cleanupSlotPreview(next[nextIndex]);
        next[nextIndex] = createCharacterReferenceSlot(reference);
        return next;
      });
    },
    [
      canCollapseReferenceSlots,
      characterSelectionLimit,
      cleanupSlotPreview,
      libraryModal.slotIndex,
      referenceSlotLimit,
      referenceSlots,
      resolveTargetReferenceSlotIndex,
      selectedCharacterReferences.length,
      supportsCharacterReferences,
    ]
  );

  const handleRun = useCallback(
    async (event?: FormEvent<HTMLFormElement> | null) => {
      event?.preventDefault();
      if (!selectedEngine) return;
      if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
        setAuthModalOpen(true);
        return;
      }
      const supabase = await getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        setAuthModalOpen(true);
        return;
      }
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setError(resolvedCopy.errors.promptMissing);
        return;
      }
      if (referenceMinRequired > 0 && combinedReferenceUrls.length < referenceMinRequired) {
        setError(resolvedCopy.errors.referenceMissing);
        return;
      }
      const trimmedMaskUrl = maskUrlField ? maskUrl.trim() : '';
      if (trimmedMaskUrl && !/^https?:\/\//i.test(trimmedMaskUrl)) {
        setError('Mask URL must be an absolute http(s) URL.');
        return;
      }
      const customImageSize = resolution === 'custom' ? buildCustomImageSize(customImageWidth, customImageHeight) : null;
      if (resolution === 'custom') {
        const customSizeResult = validateGptImage2CustomImageSize(customImageSize);
        if (!customSizeResult.ok) {
          setError(customSizeResult.message);
          return;
        }
      }
      setError(null);
      setStatusMessage(null);
      const pendingId = `img_${crypto.randomUUID()}`;
      const pendingCreatedAt = Date.now();
      setPendingGroups((prev) => [
        buildPendingGroup({
          id: pendingId,
          engineId: selectedEngine.id,
          engineLabel: selectedEngine.name,
          prompt: trimmedPrompt,
          count: numImages,
          createdAt: pendingCreatedAt,
        }),
        ...prev,
      ]);
      let keepActiveGroup = false;
      try {
        const appliedAspectRatio = aspectRatioField
          ? aspectRatio ?? getDefaultAspectRatio(selectedEngine.engineCaps, mode) ?? undefined
          : undefined;
        const normalizedSeed = (() => {
          const trimmed = seed.trim();
          if (!trimmed.length) return undefined;
          const parsed = Number(trimmed);
          return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
        })();
        const response = await runImageGeneration({
          jobId: pendingId,
          engineId: selectedEngine.id,
          mode,
          prompt: trimmedPrompt,
          numImages,
          imageUrls: mode === 'i2i' ? readyReferenceUrls : undefined,
          referenceImageSizes: mode === 'i2i' ? readyReferenceSizes : undefined,
          characterReferences: mode === 'i2i' ? selectedCharacterReferences : undefined,
          aspectRatio: appliedAspectRatio,
          resolution: resolution ?? undefined,
          customImageSize,
          seed: seedField ? normalizedSeed : undefined,
          outputFormat: outputFormatField
            ? ((outputFormat ?? undefined) as 'jpeg' | 'png' | 'webp' | undefined)
            : undefined,
          quality: qualityField ? ((quality ?? undefined) as 'low' | 'medium' | 'high' | undefined) : undefined,
          maskUrl: trimmedMaskUrl || undefined,
          enableWebSearch: enableWebSearchField ? enableWebSearch : undefined,
          thinkingLevel: thinkingLevelField
            ? ((thinkingLevel ?? undefined) as 'minimal' | 'high' | undefined)
            : undefined,
          limitGenerations: limitGenerationsField ? limitGenerations : undefined,
        });
        const entry: HistoryEntry = {
          id: response.jobId ?? response.requestId ?? crypto.randomUUID(),
          jobId: response.jobId ?? response.requestId ?? null,
          engineId: response.engineId ?? selectedEngine.id,
          engineLabel: response.engineLabel ?? selectedEngine.name,
          mode,
          prompt: trimmedPrompt,
          createdAt: Date.now(),
          description: response.description,
          images: response.images,
          aspectRatio: response.aspectRatio ?? appliedAspectRatio ?? null,
        };
        setLocalHistory((prev) => [entry, ...prev].slice(0, 24));
        setSelectedPreviewEntryId(entry.id);
        setSelectedPreviewImageIndex(0);
        const suffix = response.images.length === 1 ? '' : 's';
        setStatusMessage(
          formatTemplate(resolvedCopy.messages.success, { count: response.images.length, suffix })
        );
        const resolvedGroupId = response.jobId ?? pendingId;
        if (response.images.length > 0) {
          keepActiveGroup = true;
          setPendingGroups((prev) => [
            buildCompletedGroup({
              id: resolvedGroupId,
              engineId: response.engineId ?? selectedEngine.id,
              engineLabel: response.engineLabel ?? selectedEngine.name,
              prompt: trimmedPrompt,
              aspectRatio: response.aspectRatio ?? appliedAspectRatio ?? null,
              images: response.images,
              createdAt: pendingCreatedAt,
              totalPriceCents: response.pricing?.totalCents ?? response.costCents ?? null,
              currency: response.pricing?.currency ?? response.currency ?? null,
            }),
            ...prev.filter((group) => group.id !== pendingId && group.id !== resolvedGroupId),
          ]);
        }
        void mutateJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : resolvedCopy.errors.generic);
      } finally {
        if (!keepActiveGroup) {
          setPendingGroups((prev) => prev.filter((group) => group.id !== pendingId));
        }
      }
    },
    [
      mode,
      numImages,
      prompt,
      combinedReferenceUrls,
      resolvedCopy.errors.generic,
      resolvedCopy.errors.promptMissing,
      resolvedCopy.errors.referenceMissing,
      resolvedCopy.messages.success,
      aspectRatio,
      aspectRatioField,
      customImageHeight,
      customImageWidth,
      enableWebSearch,
      enableWebSearchField,
      limitGenerations,
      limitGenerationsField,
      referenceMinRequired,
      resolution,
      seed,
      seedField,
      selectedEngine,
      outputFormat,
      outputFormatField,
      quality,
      qualityField,
      readyReferenceSizes,
      readyReferenceUrls,
      selectedCharacterReferences,
      maskUrl,
      maskUrlField,
      thinkingLevel,
      thinkingLevelField,
      mutateJobs,
    ]
  );

  const handleCopy = useCallback((url: string) => {
    if (!navigator?.clipboard) {
      setCopiedUrl(url);
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
      })
      .catch(() => setCopiedUrl(null));
  }, []);

  const handleDownload = useCallback((url: string) => {
    triggerAppDownload(url, suggestDownloadFilename(url, 'image-generation'));
  }, []);

  const historyEntries = combinedHistory;

  const handleSelectGalleryGroup = useCallback(
    (group: GroupSummary) => {
      const applyEntryDefaults = (entry: HistoryEntry) => {
        const engineMatch = entry.engineId ? findImageEngine(engines, entry.engineId) : null;
        if (engineMatch) {
          setEngineId(engineMatch.id);
          if (entry.mode) {
            setMode(engineMatch.modes.includes(entry.mode) ? entry.mode : engineMatch.modes[0] ?? 't2i');
          }
        } else if (entry.mode) {
          setMode(entry.mode);
        }
        if (typeof entry.prompt === 'string') {
          setPrompt(entry.prompt);
        }
        if (engineMatch) {
          const nextMode = engineMatch.modes.includes(entry.mode) ? entry.mode : engineMatch.modes[0] ?? 't2i';
          const options = getAspectRatioOptions(engineMatch.engineCaps, nextMode);
          const fallback = getDefaultAspectRatio(engineMatch.engineCaps, nextMode);
          const nextAspect = entry.aspectRatio && options.includes(entry.aspectRatio) ? entry.aspectRatio : fallback;
          setAspectRatio(nextAspect);
        }
      };

      const fetchSnapshot = (jobId: string | null | undefined) => {
        if (!jobId) return;
        void authFetch(`/api/jobs/${encodeURIComponent(jobId)}`)
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as
              | { ok?: boolean; settingsSnapshot?: unknown }
              | null;
            if (!response.ok || !payload?.ok || !payload.settingsSnapshot) return;
            applyImageSettingsSnapshot(payload.settingsSnapshot);
          })
          .catch(() => undefined);
      };

      const heroJobId = group.hero.jobId ?? group.hero.job?.jobId ?? group.id;
      const heroUrl =
        group.hero.thumbUrl ??
        group.hero.videoUrl ??
        group.previews.find((preview) => preview.thumbUrl ?? preview.videoUrl)?.thumbUrl ??
        group.previews.find((preview) => preview.videoUrl ?? preview.thumbUrl)?.videoUrl ??
        null;
      const matchById = heroJobId
        ? historyEntries.find((entry) => entry.id === heroJobId || entry.jobId === heroJobId)
        : null;
      const matchByUrl =
        !matchById && heroUrl
          ? historyEntries.find((entry) => entry.images.some((image) => image.url === heroUrl || image.thumbUrl === heroUrl))
          : null;
      const match = matchById ?? matchByUrl;
      if (match) {
        const index = heroUrl ? match.images.findIndex((image) => image.url === heroUrl || image.thumbUrl === heroUrl) : -1;
        setSelectedPreviewEntryId(match.id);
        setSelectedPreviewImageIndex(index >= 0 ? index : 0);
        applyEntryDefaults(match);
        fetchSnapshot(match.jobId ?? heroJobId);
        return;
      }

      const previewUrls = group.previews
        .map((preview) => preview.thumbUrl ?? preview.videoUrl)
        .filter((url): url is string => Boolean(url));
      if (!previewUrls.length && heroUrl) {
        previewUrls.push(heroUrl);
      }
      if (!previewUrls.length) return;
      const heroRenderUrls = Array.isArray(group.hero.job?.renderIds)
        ? group.hero.job.renderIds.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      const heroRenderThumbUrls = Array.isArray(group.hero.job?.renderThumbUrls)
        ? group.hero.job.renderThumbUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      const fallbackImages =
        heroRenderUrls.length > 0
          ? heroRenderUrls.map((url, index) => ({
              url,
              thumbUrl: heroRenderThumbUrls[index] ?? (index === 0 ? group.hero.thumbUrl ?? null : null),
            }))
          : previewUrls.map((url) => ({ url, thumbUrl: url }));

      const createdAt = Date.parse(group.createdAt ?? '');
      const entry: HistoryEntry = {
        id: group.id,
        jobId: heroJobId ?? group.id,
        engineId: group.hero.engineId ?? '',
        engineLabel: group.hero.engineLabel ?? 'Image generation',
        mode: 't2i',
        prompt: group.hero.prompt ?? '',
        createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
        description: group.hero.message ?? null,
        images: fallbackImages,
        aspectRatio: group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null,
      };

      setLocalHistory((prev) => {
        if (prev.some((existing) => existing.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, 24);
      });
      const fallbackIndex = heroUrl
        ? fallbackImages.findIndex((image) => image.url === heroUrl || image.thumbUrl === heroUrl)
        : -1;
      setSelectedPreviewEntryId(entry.id);
      setSelectedPreviewImageIndex(fallbackIndex >= 0 ? fallbackIndex : 0);
      applyEntryDefaults(entry);
      fetchSnapshot(entry.jobId ?? heroJobId);
    },
    [
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
    ]
  );

  const previewEntry = (() => {
    if (selectedPreviewEntryId) {
      const match = historyEntries.find((entry) => entry.id === selectedPreviewEntryId);
      if (match) return match;
    }
    return historyEntries[0];
  })();
  const canUseWorkspace = Boolean(selectedEngine && selectedEngineCaps);
  const selectedPreviewUrl = previewEntry?.images?.[selectedPreviewImageIndex]?.url ?? null;
  const savedAssetKey =
    canUseWorkspace && selectedPreviewUrl
      ? `/api/user-assets?limit=1&source=generated&originUrl=${encodeURIComponent(selectedPreviewUrl)}`
      : null;
  const {
    data: savedAssets,
    mutate: mutateSavedAssets,
  } = useSWR(savedAssetKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      let message: string | undefined;
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const maybeError = (payload as { error?: unknown }).error;
        if (typeof maybeError === 'string') {
          message = maybeError;
        }
      }
      throw new Error(message ?? 'Failed to load library');
    }
    return payload.assets;
  });
  const savedAsset = (savedAssets?.[0] as LibraryAsset | undefined) ?? null;
  const isInLibrary = Boolean(savedAsset?.id);

  const inProgressMessage = useMemo(() => {
    const count = pendingGroups.length;
    if (count <= 0) return null;
    return formatTemplate(resolvedCopy.messages.generatingInProgress, { count });
  }, [pendingGroups.length, resolvedCopy.messages.generatingInProgress]);
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
  const compositePreviewEntry: ImageCompositePreviewEntry | null = previewEntry
    ? {
        id: previewEntry.id,
        engineLabel: previewEntry.engineLabel,
        prompt: previewEntry.prompt,
        createdAt: previewEntry.createdAt,
        mode: previewEntry.mode,
        aspectRatio: previewEntry.aspectRatio ?? null,
        images: previewEntry.images,
      }
    : null;
  const estimatedCostAmount = pricingSnapshot
    ? pricingSnapshot.totalCents / 100
    : (selectedEngine?.pricePerImage ?? 0) * numImages;
  const estimatedCostCurrency = pricingSnapshot?.currency ?? selectedEngine?.currency ?? 'USD';
  const advancedSettingsTitle = t('workspace.generate.controls.advancedTitle', 'Advanced settings') as string;
  const characterHeaderAction = useMemo(() => {
    if (!supportsCharacterReferences) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          setLibraryModal({
            open: true,
            slotIndex: null,
            selectionMode: 'character',
            initialSource: 'character',
          });
        }}
        className="min-h-0 h-7 gap-1.5 rounded-full px-2.5 py-0 text-[11px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
      >
        <Plus className="h-3.5 w-3.5 text-brand" />
        <span>{resolvedCopy.composer.characterButton}</span>
      </Button>
    );
  }, [resolvedCopy.composer.characterButton, supportsCharacterReferences]);
  const referenceAssetFields = useMemo<AssetFieldConfig[]>(() => {
    if (referenceSlotLimit <= 0) return [];
    return [
      {
        field: {
          id: 'reference_images',
          type: 'image',
          label: resolvedCopy.composer.referenceLabel,
          description: `${referenceHelperText}. ${referenceNoteText}`,
          minCount: mode === 'i2i' ? referenceMinRequired : 0,
          maxCount: displayedReferenceSlotCount,
        },
        required: mode === 'i2i' && referenceMinRequired > 0,
        role: 'reference',
        headerAction: characterHeaderAction,
      },
    ];
  }, [
    characterHeaderAction,
    displayedReferenceSlotCount,
    mode,
    referenceHelperText,
    referenceMinRequired,
    referenceNoteText,
    referenceSlotLimit,
    resolvedCopy.composer.referenceLabel,
  ]);
  const composerReferenceAssets = useMemo<Record<string, (ComposerAttachment | null)[]>>(
    () => ({
      reference_images: displayedReferenceSlots.map((slot) =>
        slot
          ? {
              kind: 'image',
              name: slot.name ?? slot.url.split('/').pop() ?? resolvedCopy.composer.referenceSlotNameFallback,
              size: 0,
              type: 'image/*',
              previewUrl: slot.previewUrl ?? slot.url,
              status: slot.status,
              badge: slot.characterReference ? resolvedCopy.composer.characterButton : undefined,
            }
          : null
      ),
    }),
    [
      displayedReferenceSlots,
      resolvedCopy.composer.characterButton,
      resolvedCopy.composer.referenceSlotNameFallback,
    ]
  );
  const composerError = error ?? pricingError?.message ?? null;

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
            <div className="stack-gap-lg">
              <ImageCompositePreviewDock
                entry={compositePreviewEntry}
                selectedIndex={selectedPreviewImageIndex}
                onSelectIndex={setSelectedPreviewImageIndex}
                onOpenModal={previewEntry ? () => handleOpenHistoryEntry(previewEntry) : undefined}
                onDownload={handleDownload}
                onCopyLink={handleCopy}
                onAddToLibrary={(url) => {
                  if (!previewEntry?.id) return;
                  if (isSavingToLibrary) return;
                  if (isRemovingFromLibrary) return;
                  setIsSavingToLibrary(true);
                  setError(null);
                  setStatusMessage(null);
                  void saveImageToLibrary({
                    url,
                    jobId: previewEntry.jobId ?? previewEntry.id,
                    label: previewEntry.prompt ?? undefined,
                  })
                    .then(() => {
                      const savedMessage = t(
                        'workspace.image.messages.savedToLibrary',
                        DEFAULT_COPY.messages.savedToLibrary
                      ) as string;
                      setStatusMessage(savedMessage);
                      void mutateSavedAssets();
                    })
                    .catch((error) => {
                      setError(error instanceof Error ? error.message : resolvedCopy.errors.generic);
                    })
                    .finally(() => {
                      setIsSavingToLibrary(false);
                    });
                }}
                onRemoveFromLibrary={() => {
                  if (!savedAsset?.id) return;
                  if (isRemovingFromLibrary) return;
                  if (isSavingToLibrary) return;
                  setIsRemovingFromLibrary(true);
                  setError(null);
                  setStatusMessage(null);
                  void authFetch('/api/user-assets', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: savedAsset.id }),
                  })
                    .then(async (response) => {
                      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
                      if (!response.ok || !payload?.ok) {
                        throw new Error(payload?.error ?? 'Failed to remove from library');
                      }
                      const removedMessage = t(
                        'workspace.image.messages.removedFromLibrary',
                        DEFAULT_COPY.messages.removedFromLibrary
                      ) as string;
                      setStatusMessage(removedMessage);
                      void mutateSavedAssets();
                    })
                    .catch((error) => {
                      setError(error instanceof Error ? error.message : resolvedCopy.errors.generic);
                    })
                    .finally(() => {
                      setIsRemovingFromLibrary(false);
                    });
                }}
                isInLibrary={isInLibrary}
                isSavingToLibrary={isSavingToLibrary}
                isRemovingFromLibrary={isRemovingFromLibrary}
                copiedUrl={copiedUrl}
                showTitle={false}
                engineSettings={
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                  <EngineSelect
                    engines={engineCapsList}
                    engineId={selectedEngine.id}
                    onEngineChange={(nextId) => setEngineId(nextId)}
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
                  engine={selectedEngineCaps}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  price={estimatedCostAmount}
                  currency={estimatedCostCurrency}
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
                  afterAssets={
                    canCollapseReferenceSlots ? (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAreReferenceSlotsExpanded((previous) => !previous)}
                          className="rounded-full border-border text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          {referenceToggleLabel}
                        </Button>
                      </div>
                    ) : null
                  }
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
                          maskUrlField
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
                      />
                    </div>
                  }
                />
              </form>
            </div>
          </main>
        </div>
        {isDesktopLayout ? (
          <div className="flex w-[320px] justify-end pl-2 pr-0 py-4">
            <GalleryRail
              engine={selectedEngineCaps}
              engineRegistry={engineCapsList}
              feedType="image"
              activeGroups={pendingGroups}
              jobFilter={isImageJob}
              onOpenGroup={handleSelectGalleryGroup}
              variant="desktop"
            />
          </div>
        ) : null}
      </div>
      {!isDesktopLayout ? (
        <div className="border-t border-hairline bg-surface-glass-70 px-4 py-4">
          <GalleryRail
            engine={selectedEngineCaps}
            engineRegistry={engineCapsList}
            feedType="image"
            activeGroups={pendingGroups}
            jobFilter={isImageJob}
            onOpenGroup={handleSelectGalleryGroup}
            variant="mobile"
          />
        </div>
      ) : null}
      {viewerGroup ? (
      <GroupViewerModal
        group={viewerGroup}
        onClose={closeViewer}
        onSaveToLibrary={handleSaveVariantToLibrary}
      />
    ) : null}
      {authModalOpen ? (
      <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
        <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
        <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">{resolvedCopy.authGate.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">{resolvedCopy.authGate.body}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAuthModalOpen(false)}
              className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
              aria-label={resolvedCopy.authGate.close}
            >
              {resolvedCopy.authGate.close}
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
              {resolvedCopy.authGate.primary}
            </ButtonLink>
            <ButtonLink
              href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
              variant="outline"
              size="sm"
              className="px-4"
            >
              {resolvedCopy.authGate.secondary}
            </ButtonLink>
          </div>
        </div>
      </div>
    ) : null}
      {libraryModal.open ? (
      <ImageLibraryModal
        open={libraryModal.open}
        onClose={() => setLibraryModal({ open: false, slotIndex: null, selectionMode: 'reference', initialSource: 'all' })}
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

function ImageLibraryModal({
  open,
  onClose,
  onSelect,
  onToggleCharacter,
  selectedCharacterReferences,
  characterSelectionLimit,
  copy,
  characterCopy,
  selectionMode,
  initialSource,
  supportedFormats,
  supportedFormatsLabel,
  toolsEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
  onToggleCharacter: (reference: CharacterReferenceSelection) => void;
  selectedCharacterReferences: CharacterReferenceSelection[];
  characterSelectionLimit: number;
  copy: ImageWorkspaceCopy['library'];
  characterCopy: ImageWorkspaceCopy['characterPicker'];
  selectionMode: 'reference' | 'character';
  initialSource: AssetLibrarySource;
  supportedFormats: string[];
  supportedFormatsLabel: string;
  toolsEnabled: boolean;
}) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const [activeSource, setActiveSource] = useState<AssetLibrarySource>(initialSource);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isCharacterMode = selectionMode === 'character';
  const importLabel = t(
    'workspace.generate.assetLibrary.import',
    uiLocale === 'fr' ? 'Importer' : uiLocale === 'es' ? 'Importar' : 'Import'
  ) as string;
  const importingLabel = t(
    'workspace.generate.assetLibrary.importing',
    uiLocale === 'fr' ? 'Import en cours…' : uiLocale === 'es' ? 'Importando…' : 'Importing…'
  ) as string;
  const importFailedLabel = t(
    'workspace.generate.assetLibrary.importFailed',
    uiLocale === 'fr' ? 'Import impossible. Réessayez.' : uiLocale === 'es' ? 'La importación falló. Inténtalo de nuevo.' : 'Import failed. Please try again.'
  ) as string;
  const swrKey = !open
    ? null
    : isCharacterMode
      ? '/api/character-references?limit=60'
      : activeSource === 'all'
        ? '/api/user-assets?limit=60'
        : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`;
  const { data, error, isLoading, mutate } = useSWR(swrKey, async (url: string) => {
    const response = await authFetch(url);
    if (isCharacterMode) {
      const payload = (await response.json().catch(() => null)) as CharacterReferencesResponse | null;
      if (!response.ok || !payload?.ok) {
        let message: string | undefined;
        if (payload && typeof payload.error === 'string') {
          message = payload.error;
        }
        throw new Error(message ?? 'Failed to load character references');
      }
      return payload.characters;
    }
    const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      let message: string | undefined;
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const maybeError = (payload as { error?: unknown }).error;
        if (typeof maybeError === 'string') {
          message = maybeError;
        }
      }
      throw new Error(message ?? 'Failed to load library');
    }
    return payload.assets;
  });

  useEffect(() => {
    if (!open) return;
    setActiveSource(initialSource);
  }, [initialSource, open]);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file || isCharacterMode) return;

      if (!file.type.startsWith('image/')) {
        setImportError(t('workspace.image.errors.onlyImages', DEFAULT_COPY.errors.onlyImages) as string);
        return;
      }

      setImportError(null);
      setIsImporting(true);
      try {
        const preparedFile = await prepareImageFileForUpload(file, {
          maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
        });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          const message = translateError({
            code: typeof payload?.error === 'string' ? payload.error : null,
            status: response.status,
            message: importFailedLabel,
          }).message;
          throw new Error(message);
        }

        const uploadedAsset = payload.asset as LibraryAsset;
        void mutate();
        onSelect({
          id: uploadedAsset.id ?? `library_${Date.now().toString(36)}`,
          url: uploadedAsset.url,
          mime: uploadedAsset.mime ?? null,
          width: uploadedAsset.width ?? null,
          height: uploadedAsset.height ?? null,
          size: uploadedAsset.size ?? null,
          source: uploadedAsset.source ?? 'upload',
          createdAt: uploadedAsset.createdAt,
        });
      } catch (uploadError) {
        setImportError(uploadError instanceof Error ? uploadError.message : importFailedLabel);
      } finally {
        setIsImporting(false);
      }
    },
    [importFailedLabel, isCharacterMode, mutate, onSelect, t]
  );

  const assets = useMemo(() => {
    if (isCharacterMode) return [];
    return (((data ?? []) as LibraryAsset[])).filter((asset) =>
      toolsEnabled ? true : asset.source !== 'character' && asset.source !== 'angle'
    );
  }, [data, isCharacterMode, toolsEnabled]);
  const characters = useMemo(
    () => (isCharacterMode ? (((data ?? []) as CharacterReferenceSelection[])) : []),
    [data, isCharacterMode]
  );
  const availableSources = useMemo(
    () =>
      isCharacterMode
        ? (['character'] as const satisfies readonly AssetLibrarySource[])
        : toolsEnabled
        ? (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const satisfies readonly AssetLibrarySource[])
        : (['all', 'upload', 'generated'] as const satisfies readonly AssetLibrarySource[]),
    [isCharacterMode, toolsEnabled]
  );

  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource(initialSource);
    }
  }, [activeSource, availableSources, initialSource]);
  const compatibilityByAssetId = useMemo(() => {
    if (isCharacterMode) return new Map<string, boolean>();
    const entries = assets.map((asset) => {
      if (!supportedFormats.length) {
        return [asset.id, true] as const;
      }
      const supportedByMime = isSupportedImageMime(supportedFormats, asset.mime);
      if (supportedByMime != null) {
        return [asset.id, supportedByMime] as const;
      }
      const inferredFormat = inferImageFormatFromUrl(asset.url);
      return [asset.id, inferredFormat ? isSupportedImageFormat(supportedFormats, inferredFormat) : true] as const;
    });
    return new Map(entries);
  }, [assets, isCharacterMode, supportedFormats]);

  const compatibleAssets = useMemo(
    () => (isCharacterMode ? [] : assets.filter((asset) => compatibilityByAssetId.get(asset.id) !== false)),
    [assets, compatibilityByAssetId, isCharacterMode]
  );
  const browserAssets = useMemo(
    () => {
      if (isCharacterMode) {
        return characters.map((character) => ({
          id: character.id,
          url: character.thumbUrl ?? character.imageUrl,
          kind: 'image' as const,
          source: 'character',
          createdAt: character.createdAt ?? undefined,
        }));
      }
      return compatibleAssets.map((asset) => ({
        ...asset,
        kind: 'image' as const,
      }));
    },
    [characters, compatibleAssets, isCharacterMode]
  );
  const characterMap = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters]);
  const selectedCharacterIds = useMemo(
    () => new Set(selectedCharacterReferences.map((reference) => reference.id)),
    [selectedCharacterReferences]
  );
  const emptyLabel =
    isCharacterMode
      ? characterCopy.empty
      : compatibleAssets.length === 0 && assets.length > 0
      ? copy.modal.emptyCompatible
      : activeSource === 'generated'
        ? copy.modal.emptyGenerated
        : activeSource === 'upload'
          ? copy.modal.emptyUploads
          : activeSource === 'character'
            ? copy.modal.emptyCharacter
            : activeSource === 'angle'
              ? copy.modal.emptyAngle
              : activeSource === 'upscale'
                ? copy.modal.emptyUpscale
                : copy.modal.empty;
  const supportedFormatsHint = isCharacterMode
    ? formatTemplate(characterCopy.limitLabel, {
        count: characterSelectionLimit,
        suffix: characterSelectionLimit === 1 ? '' : 's',
      })
    : supportedFormats.length && supportedFormatsLabel.length
      ? formatTemplate(copy.supportedFormats, { formats: supportedFormatsLabel })
      : null;
  const toolLinks = toolsEnabled
    ? [
        { href: '/app/image', label: 'Create image' },
        { href: '/app/tools/angle', label: 'Change angle' },
        { href: '/app/tools/character-builder', label: 'Character builder' },
      ]
    : [{ href: '/app/image', label: 'Create image' }];
  const searchPlaceholder = t('workspace.library.browser.searchPlaceholder', 'Search assets…') as string;
  const sourcesTitle = t('workspace.library.browser.sourcesTitle', 'Library') as string;
  const toolsTitle = t('workspace.library.browser.toolsTitle', 'Create or transform') as string;
  const toolsDescription = t(
    'workspace.library.browser.toolsDescription',
    'Open another workspace to prepare a better source before importing it here.'
  ) as string;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="h-[92svh] w-full max-w-6xl overflow-hidden sm:h-[84vh]">
        {!isCharacterMode ? (
          <input
            ref={importInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImportChange}
          />
        ) : null}
        <AssetLibraryBrowser
          assetType="image"
          layout="modal"
          title={isCharacterMode ? characterCopy.title : copy.modal.title}
          subtitle={supportedFormatsHint ?? (isCharacterMode ? characterCopy.description : copy.modal.description)}
          onClose={onClose}
          closeLabel={copy.modal.close}
          assets={browserAssets}
          isLoading={isLoading}
          error={
            importError ??
            (error ? (isCharacterMode ? (error instanceof Error ? error.message : characterCopy.empty) : copy.modal.error) : null)
          }
          source={activeSource}
          availableSources={availableSources}
          sourceLabels={copy.tabs}
          onSourceChange={setActiveSource}
          headerActions={
            !isCharacterMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                disabled={isImporting}
                onClick={() => importInputRef.current?.click()}
              >
                {isImporting ? importingLabel : importLabel}
              </Button>
            ) : undefined
          }
          searchPlaceholder={searchPlaceholder}
          sourcesTitle={sourcesTitle}
          toolsTitle={toolsEnabled ? toolsTitle : undefined}
          toolsDescription={toolsEnabled ? toolsDescription : undefined}
          toolLinks={toolLinks}
          emptyLabel={emptyLabel}
          emptySearchLabel={copy.modal.empty}
          renderAssetActions={(asset) => (
            isCharacterMode ? (
              (() => {
                const character = characterMap.get(asset.id);
                if (!character) return null;
                const isSelected = selectedCharacterIds.has(character.id);
                const isDisabled = !isSelected && selectedCharacterReferences.length >= characterSelectionLimit;
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'primary' : 'outline'}
                    disabled={isDisabled}
                    onClick={() => onToggleCharacter(character)}
                    className="min-h-0 h-9 rounded-full px-3 text-[11px] font-semibold"
                  >
                    {isSelected ? characterCopy.selected : characterCopy.select}
                  </Button>
                );
              })()
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelect(asset as LibraryAsset)}
                className="min-h-0 h-9 rounded-full px-3 text-[11px] font-semibold"
              >
                {copy.overlay}
              </Button>
            )
          )}
          renderAssetMeta={(asset) =>
            isCharacterMode ? (
              (() => {
                const character = characterMap.get(asset.id);
                if (!character) return null;
                return (
                  <>
                    <span>{formatCharacterReferenceDate(character.createdAt)}</span>
                    <span>{getCharacterReferenceLabel(character)}</span>
                  </>
                );
              })()
            ) : asset.createdAt ? (
              <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
