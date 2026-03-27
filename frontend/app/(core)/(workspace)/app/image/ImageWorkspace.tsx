'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import deepmerge from 'deepmerge';
import { Check, UserRound, Users } from 'lucide-react';
import type {
  FormEvent,
  DragEvent as ReactDragEvent,
  ClipboardEvent as ReactClipboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { GalleryRail } from '@/components/GalleryRail';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { supabase } from '@/lib/supabaseClient';
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
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { formatAspectRatioLabel } from '@/lib/image/aspectRatios';
import { FEATURES } from '@/content/feature-flags';
import {
  formatSupportedImageFormatsLabel,
  getImageAcceptAttribute,
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
import { authFetch } from '@/lib/authFetch';
import { normalizeJobSurface } from '@/lib/job-surface';
import { Link } from '@/i18n/navigation';

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

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

const MAX_REFERENCE_SLOTS = MAX_REFERENCE_IMAGES;
const DEFAULT_VISIBLE_REFERENCE_SLOTS = 4;
const QUICK_IMAGE_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;
const DESKTOP_RAIL_MIN_WIDTH = 1088;
const NANO_BANANA_ENGINE_IDS = new Set(['nano-banana', 'nano-banana-pro', 'nano-banana-2']);
const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

const IMAGE_COMPOSER_STORAGE_KEY = 'maxvideoai.image.composer.v1';
const IMAGE_COMPOSER_STORAGE_VERSION = 2;
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
  source?: 'upload' | 'library' | 'paste';
};

type PersistedReferenceSlot = { url: string; source?: ReferenceSlotValue['source'] } | null;
type PersistedCharacterReference = CharacterReferenceSelection;

type PersistedImageComposerState = {
  version: number;
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  aspectRatio: string | null;
  resolution: string | null;
  seed: number | null;
  outputFormat: string | null;
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
    if (raw.version !== 1 && raw.version !== IMAGE_COMPOSER_STORAGE_VERSION) return null;
    if (typeof raw.engineId !== 'string' || raw.engineId.trim().length === 0) return null;
    const mode = raw.mode === 't2i' || raw.mode === 'i2i' ? raw.mode : 't2i';
    const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
    const numImages =
      typeof raw.numImages === 'number' && Number.isFinite(raw.numImages) ? Math.round(raw.numImages) : 1;
    const aspectRatio = typeof raw.aspectRatio === 'string' ? raw.aspectRatio : null;
    const resolution = typeof raw.resolution === 'string' ? raw.resolution : null;
    const seed =
      typeof raw.seed === 'number' && Number.isFinite(raw.seed) ? Math.round(raw.seed) : null;
    const outputFormat = typeof raw.outputFormat === 'string' ? raw.outputFormat : null;
    const enableWebSearch = raw.enableWebSearch === true;
    const thinkingLevel = typeof raw.thinkingLevel === 'string' ? raw.thinkingLevel : null;
    const limitGenerations = raw.limitGenerations === true;
    const referenceSlotsRaw = Array.isArray(raw.referenceSlots) ? raw.referenceSlots : [];
    const referenceSlots = referenceSlotsRaw
      .slice(0, MAX_REFERENCE_SLOTS)
      .map((entry): PersistedReferenceSlot => {
        if (entry === null) return null;
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as { url?: unknown; source?: unknown };
        const url = typeof record.url === 'string' ? record.url.trim() : '';
        if (!url || url.startsWith('blob:')) return null;
        const source =
          record.source === 'upload' || record.source === 'library' || record.source === 'paste'
            ? (record.source as ReferenceSlotValue['source'])
            : undefined;
        return { url, source };
      });
    const characterReferencesRaw = Array.isArray(raw.characterReferences) ? raw.characterReferences : [];
    const characterReferences = characterReferencesRaw.reduce<PersistedCharacterReference[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object') return acc;
      const record = entry as Partial<CharacterReferenceSelection>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
      const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
      if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return acc;
      acc.push({
        id,
        jobId,
        imageUrl,
        thumbUrl: typeof record.thumbUrl === 'string' ? record.thumbUrl : null,
        prompt: typeof record.prompt === 'string' ? record.prompt : null,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
        engineLabel: typeof record.engineLabel === 'string' ? record.engineLabel : null,
        outputMode: record.outputMode === 'portrait-reference' || record.outputMode === 'character-sheet' ? record.outputMode : null,
        action:
          record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
            ? record.action
            : null,
      });
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
      seed,
      outputFormat,
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

type CharacterPickerModalState = {
  open: boolean;
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

function SectionDivider() {
  return <div className="my-6 border-t border-surface-on-media-60" role="presentation" />;
}

function SelectGroup({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string | number | boolean; label: string }[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
}) {
  if (!options.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu options={options} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 3,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(3)}`;
  }
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
          thumbUrl: renderThumbUrls[index] ?? (index === 0 ? job.thumbUrl ?? null : null),
        }))
      : job.thumbUrl
        ? [{ url: heroOriginal ?? job.thumbUrl, thumbUrl: job.thumbUrl }]
        : [];
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

export default function ImageWorkspace({ engines }: ImageWorkspaceProps) {
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawCopy = t('workspace.image', DEFAULT_COPY);
  const resolvedCopy = useMemo<ImageWorkspaceCopy>(() => {
    return deepmerge<ImageWorkspaceCopy>(DEFAULT_COPY, (rawCopy ?? {}) as Partial<ImageWorkspaceCopy>);
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
  const [seed, setSeed] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<string | null>(null);
  const [limitGenerations, setLimitGenerations] = useState(false);
  const [referenceSlots, setReferenceSlots] = useState<(ReferenceSlotValue | null)[]>(
    Array(MAX_REFERENCE_SLOTS).fill(null)
  );
  const [selectedCharacterReferences, setSelectedCharacterReferences] = useState<CharacterReferenceSelection[]>([]);
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
  const [libraryModal, setLibraryModal] = useState<{ open: boolean; slotIndex: number | null }>({
    open: false,
    slotIndex: null,
  });
  const [characterPickerModal, setCharacterPickerModal] = useState<CharacterPickerModalState>({ open: false });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [
    priceEstimateKey,
    setPriceEstimateKey,
  ] = useState<[string, string, ImageGenerationMode, number, string, boolean] | null>(() =>
    engines[0] ? ['image-pricing', engines[0].id, 't2i', 1, '', false] : null
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
  const selectedEngineIsNanoBanana = Boolean(selectedEngine && NANO_BANANA_ENGINE_IDS.has(selectedEngine.id));
  const autoModeFromReferences = selectedEngineIsNanoBanana;
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
  const referenceInputAccept = useMemo(
    () => getImageAcceptAttribute(supportedReferenceFormats),
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
  const totalRegularReferenceSelections = useMemo(
    () => referenceSlots.slice(0, baseReferenceSlotLimit).filter((slot) => Boolean(slot)).length,
    [baseReferenceSlotLimit, referenceSlots]
  );
  const characterSelectionLimit = supportsCharacterReferences
    ? Math.max(0, baseReferenceSlotLimit - totalRegularReferenceSelections)
    : 0;
  const effectiveCharacterReferences = useMemo(
    () =>
      supportsCharacterReferences
        ? selectedCharacterReferences.slice(0, characterSelectionLimit)
        : [],
    [characterSelectionLimit, selectedCharacterReferences, supportsCharacterReferences]
  );
  const activeCharacterReferenceIds = useMemo(
    () => new Set(effectiveCharacterReferences.map((reference) => reference.id)),
    [effectiveCharacterReferences]
  );
  const activeCharacterReferenceCount = effectiveCharacterReferences.length;
  const hasHiddenCharacterReferences = selectedCharacterReferences.length > effectiveCharacterReferences.length;
  const referenceSlotLimit = supportsCharacterReferences
    ? Math.max(0, baseReferenceSlotLimit - activeCharacterReferenceCount)
    : baseReferenceSlotLimit;
  const visibleReferenceSlots = useMemo(
    () => referenceSlots.slice(0, referenceSlotLimit),
    [referenceSlots, referenceSlotLimit]
  );
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
    setPriceEstimateKey(['image-pricing', selectedEngine.id, mode, numImages, resolution ?? '', enableWebSearch]);
  }, [selectedEngine, mode, numImages, resolution, enableWebSearch]);

  const {
    data: pricingData,
    error: pricingError,
    isValidating: pricingValidating,
  } = useSWR(
    priceEstimateKey,
    async ([, engineId, requestMode, count, requestResolution, requestEnableWebSearch]) => {
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          mode: requestMode,
          numImages: count,
          resolution: requestResolution || undefined,
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

  const estimatedCostLabel = useMemo(() => {
    if (pricingSnapshot) {
      const currency = pricingSnapshot.currency ?? selectedEngine?.currency ?? 'USD';
      return formatCurrency(pricingSnapshot.totalCents / 100, currency);
    }
    if (!selectedEngine) return '$0.00';
    const estimate = selectedEngine.pricePerImage * numImages;
    return formatCurrency(estimate, selectedEngine.currency);
  }, [numImages, pricingSnapshot, selectedEngine]);

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

  const remoteHistory = useMemo(() => {
    if (!jobPages) return [];
    return jobPages
      .flatMap((page) => page.jobs ?? [])
      .filter((job) => isImageJob(job))
      .map((job) => mapJobToHistoryEntry(job))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  }, [jobPages, isImageJob]);

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

  const readyReferenceUrls = useMemo(
    () =>
      visibleReferenceSlots
        .filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'))
        .map((slot) => slot.url),
    [visibleReferenceSlots]
  );
  const activeCharacterReferenceUrls = useMemo(
    () => effectiveCharacterReferences.map((reference) => reference.imageUrl),
    [effectiveCharacterReferences]
  );
  const combinedReferenceUrls = useMemo(
    () => [...activeCharacterReferenceUrls, ...readyReferenceUrls],
    [activeCharacterReferenceUrls, readyReferenceUrls]
  );
  const hasAnyReferenceSelection = useMemo(
    () => visibleReferenceSlots.some((slot) => Boolean(slot)) || activeCharacterReferenceUrls.length > 0,
    [activeCharacterReferenceUrls.length, visibleReferenceSlots]
  );
  const referenceNoteText = autoModeFromReferences
    ? 'Add a reference or character and Nano Banana switches to Edit automatically.'
    : resolvedCopy.composer.referenceNote;
  const showReferenceMissingWarning =
    mode === 'i2i' &&
    referenceMinRequired > 0 &&
    combinedReferenceUrls.length < referenceMinRequired &&
    (!autoModeFromReferences || !hasAnyReferenceSelection);

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
    const mediaUrl = entry.videoUrl ?? entry.thumbUrl;
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
        setResolution(
          parsed.resolution && allowedResolutions.includes(parsed.resolution) ? parsed.resolution : defaultResolution
        );
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

      if (parsed.referenceSlots.length) {
        setReferenceSlots((previous) => {
          const next = Array(MAX_REFERENCE_SLOTS).fill(null) as Array<ReferenceSlotValue | null>;
          parsed.referenceSlots.slice(0, MAX_REFERENCE_SLOTS).forEach((slot, index) => {
            if (!slot) return;
            next[index] = {
              id: `stored-${index}`,
              url: slot.url,
              previewUrl: slot.url,
              status: 'ready',
              source: slot.source ?? 'library',
            };
          });
          const changed = next.some((slot, idx) => {
            const prior = previous[idx];
            if (!slot && !prior) return false;
            if (!slot || !prior) return true;
            return slot.url !== prior.url || slot.status !== prior.status;
          });
          return changed ? next : previous;
        });
      }
      setSelectedCharacterReferences(parsed.characterReferences ?? []);
    }

    setStorageHydrated(true);
  }, [engines]);

  const requestedJobId = useMemo(() => {
    const raw = searchParams?.get('job');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : null;
  }, [searchParams]);

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
      const seedRaw =
        typeof core.seed === 'number' && Number.isFinite(core.seed) ? Math.round(core.seed) : null;
      const outputFormatRaw = typeof core.outputFormat === 'string' ? core.outputFormat : null;
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
        setResolution(resolutionRaw && allowedResolutions.includes(resolutionRaw) ? resolutionRaw : defaultResolution);
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
        setAspectRatio(aspectRatioRaw);
        setSeed(seedRaw == null ? '' : String(seedRaw));
        setOutputFormat(outputFormatRaw);
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
        return next;
      });
      const characterReferencesRaw = Array.isArray(refs.characterReferences) ? refs.characterReferences : [];
      setSelectedCharacterReferences(
        characterReferencesRaw.reduce<CharacterReferenceSelection[]>((acc, entry) => {
          if (!entry || typeof entry !== 'object') return acc;
          const record = entry as Partial<CharacterReferenceSelection>;
          const id = typeof record.id === 'string' ? record.id.trim() : '';
          const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
          const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
          if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return acc;
          acc.push({
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
          });
          return acc;
        }, [])
      );

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
        return { url, source: slot.source };
      }),
    [referenceSlots]
  );
  const persistableCharacterReferences = useMemo<PersistedCharacterReference[]>(
    () =>
      selectedCharacterReferences.map((reference) => ({
        id: reference.id,
        jobId: reference.jobId,
        imageUrl: reference.imageUrl,
        thumbUrl: reference.thumbUrl ?? null,
        prompt: reference.prompt ?? null,
        createdAt: reference.createdAt ?? null,
        engineLabel: reference.engineLabel ?? null,
        outputMode: reference.outputMode ?? null,
        action: reference.action ?? null,
      })),
    [selectedCharacterReferences]
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
      seed: seed.trim().length ? Math.round(Number(seed)) : null,
      outputFormat,
      enableWebSearch,
      thinkingLevel,
      limitGenerations,
      referenceSlots: persistableReferenceSlots,
      characterReferences: persistableCharacterReferences,
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
    enableWebSearch,
    engineId,
    engines,
    limitGenerations,
    mode,
    numImages,
    outputFormat,
    persistableCharacterReferences,
    persistableReferenceSlots,
    prompt,
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
      if (!isSupportedReferenceAsset(file.type, file.name)) {
        showUnsupportedFormatError();
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
      isSupportedReferenceAsset,
      resolvedCopy.errors.onlyImages,
      resolvedCopy.errors.uploadFailed,
      resolvedCopy.errors.fileTooLarge,
      resolvedCopy.errors.unauthorized,
      showUnsupportedFormatError,
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

  const handleSlotDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files && files.length) {
        void handleReferenceFile(index, files[0]);
        return;
      }
      const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
      if (uri && /^https?:\/\//i.test(uri.trim())) {
        handleReferenceUrl(index, uri.trim(), 'paste');
      }
    },
    [handleReferenceFile, handleReferenceUrl]
  );

  const handleSlotPaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>, index: number) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const items = clipboard.items;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          void handleReferenceFile(index, file);
          return;
        }
      }
      const text = clipboard.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) {
        event.preventDefault();
        handleReferenceUrl(index, text.trim(), 'paste');
      }
    },
    [handleReferenceFile, handleReferenceUrl]
  );

  const handleLibrarySelect = useCallback(
    (asset: LibraryAsset) => {
      if (!isSupportedReferenceAsset(asset.mime, asset.url)) {
        showUnsupportedFormatError();
        return;
      }
      let slotIndex = libraryModal.slotIndex;
      if (slotIndex == null) {
        slotIndex = referenceSlots.slice(0, referenceSlotLimit).findIndex((slot) => slot === null);
        if (slotIndex < 0) {
          slotIndex = Math.max(0, referenceSlotLimit - 1);
        }
      }
      if (slotIndex >= referenceSlotLimit) {
        setLibraryModal({ open: false, slotIndex: null });
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
        };
        return next;
      });
      setLibraryModal({ open: false, slotIndex: null });
    },
    [
      canCollapseReferenceSlots,
      cleanupSlotPreview,
      isSupportedReferenceAsset,
      libraryModal.slotIndex,
      referenceSlotLimit,
      referenceSlots,
      showUnsupportedFormatError,
    ]
  );

  const triggerFileDialog = useCallback((index: number) => {
    const target = fileInputRefs.current[index];
    target?.click();
  }, []);

  const openLibraryForSlot = useCallback(
    (index: number) => {
      setLibraryModal({ open: true, slotIndex: index });
    },
    []
  );

  const toggleCharacterReference = useCallback(
    (reference: CharacterReferenceSelection) => {
      setSelectedCharacterReferences((previous) => {
        const existingIndex = previous.findIndex((entry) => entry.id === reference.id);
        if (existingIndex >= 0) {
          return previous.filter((entry) => entry.id !== reference.id);
        }
        if (!supportsCharacterReferences || previous.length >= characterSelectionLimit) {
          return previous;
        }
        return [...previous, reference];
      });
    },
    [characterSelectionLimit, supportsCharacterReferences]
  );

  const removeCharacterReference = useCallback((referenceId: string) => {
    setSelectedCharacterReferences((previous) => previous.filter((entry) => entry.id !== referenceId));
  }, []);

  const handleRun = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedEngine) return;
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
          characterReferences: mode === 'i2i' ? effectiveCharacterReferences : undefined,
          aspectRatio: appliedAspectRatio,
          resolution: resolution ?? undefined,
          seed: seedField ? normalizedSeed : undefined,
          outputFormat: outputFormatField
            ? ((outputFormat ?? undefined) as 'jpeg' | 'png' | 'webp' | undefined)
            : undefined,
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
        void mutateJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : resolvedCopy.errors.generic);
      } finally {
        setPendingGroups((prev) => prev.filter((group) => group.id !== pendingId));
      }
    },
    [
      mode,
      numImages,
      prompt,
      combinedReferenceUrls,
      effectiveCharacterReferences,
      resolvedCopy.errors.generic,
      resolvedCopy.errors.promptMissing,
      resolvedCopy.errors.referenceMissing,
      resolvedCopy.messages.success,
      aspectRatio,
      aspectRatioField,
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
      readyReferenceUrls,
      thinkingLevel,
      thinkingLevelField,
      mutateJobs,
    ]
  );

  const handlePreset = useCallback((preset: PromptPreset) => {
    setPrompt(preset.prompt);
    setMode(preset.mode);
  }, []);

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

  const promptCharCount = formatTemplate(resolvedCopy.composer.charCount, { count: prompt.length });
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
        label: option.toUpperCase(),
      })),
    [resolutionOptions]
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
  const showSeedControl = Boolean(seedField);
  const showOutputFormatControl = Boolean(outputFormatField) && outputFormatSelectOptions.length > 0;
  const showEnableWebSearchControl = Boolean(enableWebSearchField);
  const showThinkingLevelControl = Boolean(thinkingLevelField) && thinkingLevelSelectOptions.length > 0;
  const showLimitGenerationsControl = Boolean(limitGenerationsField);
  const promptPlaceholder =
    mode === 'i2i'
      ? resolvedCopy.composer.promptPlaceholderWithImage ?? resolvedCopy.composer.promptPlaceholder
      : resolvedCopy.composer.promptPlaceholder;
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
  const composerPriceLabelTemplate = t('workspace.generate.composer.priceLabel', 'This render: {amount}') as string;
  const composerPriceLabel = composerPriceLabelTemplate.replace('{amount}', estimatedCostLabel);

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
                    showModeSelect={!autoModeFromReferences}
                    modeLayout="stacked"
                    showBillingNote={false}
                    variant="bar"
                    className="min-w-0 flex-1"
                  />
                  </div>
                }
              />

              <form onSubmit={handleRun}>
                <Card className="stack-gap-lg p-5">
                  <div className="stack-gap-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{resolvedCopy.composer.promptLabel}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span>{promptCharCount}</span>
                        <Chip
                          variant={pricingValidating ? 'ghost' : 'outline'}
                          className="chip-price px-3 py-1.5 font-semibold shadow-sm"
                        >
                          {pricingValidating ? resolvedCopy.engine.priceCalculating : composerPriceLabel}
                        </Chip>
                      </div>
                    </div>
                    {showReferenceMissingWarning ? (
                      <p className="text-[12px] text-state-warning">{resolvedCopy.errors.referenceMissing}</p>
                    ) : null}
                    {pricingError ? <p className="text-[12px] text-state-warning">{pricingError.message}</p> : null}
                    <textarea
                      id="prompt"
                      className="w-full rounded-input border border-border bg-surface px-4 py-3 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={promptPlaceholder}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={6}
                    />
                    {selectedEngine.prompts.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedEngine.prompts.map((preset) => (
                          <Button
                            key={`${preset.title}-${preset.mode}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreset(preset)}
                            className="min-h-0 h-auto rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
                          >
                            {preset.title}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="rounded-card border border-state-warning/40 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                      {error}
                    </p>
                  ) : null}

                  {inProgressMessage ? (
                    <p className="rounded-card border border-success-border bg-success-bg px-3 py-2 text-sm text-success">
                      {inProgressMessage}
                    </p>
                  ) : statusMessage ? (
                    <p className="rounded-card border border-success-border bg-success-bg px-3 py-2 text-sm text-success">
                      {statusMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-2 grid-gap-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {showNumImagesControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.numImagesLabel}
                            options={imageCountOptions}
                            value={numImages}
                            onChange={(value) => setNumImagesPreset(Number(value))}
                          />
                        ) : null}
                        {showAspectRatioControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.aspectRatioLabel}
                            options={aspectRatioSelectOptions}
                            value={aspectRatio ?? aspectRatioSelectOptions[0]?.value ?? ''}
                            onChange={(value) => setAspectRatio(String(value))}
                          />
                        ) : null}
                        {showResolutionControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.resolutionLabel}
                            options={resolutionSelectOptions}
                            value={resolution ?? resolutionSelectOptions[0]?.value ?? ''}
                            onChange={(value) => setResolution(String(value))}
                            disabled={isResolutionLocked}
                          />
                        ) : null}
                        {showOutputFormatControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.outputFormatLabel}
                            options={outputFormatSelectOptions}
                            value={outputFormat ?? outputFormatSelectOptions[0]?.value ?? ''}
                            onChange={(value) => setOutputFormat(String(value))}
                          />
                        ) : null}
                        {showThinkingLevelControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.thinkingLevelLabel}
                            options={thinkingLevelSelectOptions}
                            value={thinkingLevel ?? thinkingLevelSelectOptions[0]?.value ?? ''}
                            onChange={(value) => setThinkingLevel(String(value))}
                          />
                        ) : null}
                        {showEnableWebSearchControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.enableWebSearchLabel}
                            options={booleanSelectOptions}
                            value={enableWebSearch}
                            onChange={(value) => setEnableWebSearch(Boolean(value))}
                          />
                        ) : null}
                        {showLimitGenerationsControl ? (
                          <SelectGroup
                            label={resolvedCopy.composer.limitGenerationsLabel}
                            options={booleanSelectOptions}
                            value={limitGenerations}
                            onChange={(value) => setLimitGenerations(Boolean(value))}
                          />
                        ) : null}
                        {showSeedControl ? (
                          <label className="flex min-w-0 flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-micro text-text-muted">
                              {resolvedCopy.composer.seedLabel}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              step={1}
                              placeholder={resolvedCopy.composer.seedPlaceholder}
                              value={seed}
                              onChange={(event) => setSeed(event.target.value)}
                              className="min-h-[42px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </label>
                        ) : null}
                      </div>
                      {(showAspectRatioControl || showResolutionControl || showOutputFormatControl || showEnableWebSearchControl || showThinkingLevelControl || showLimitGenerationsControl) ? (
                        <div className="mt-2 flex flex-col gap-1 text-[11px] text-text-secondary">
                          {showAspectRatioControl && aspectRatioSelectOptions.some((option) => option.value === 'auto') ? (
                            <p>{resolvedCopy.composer.aspectRatioAutoNote}</p>
                          ) : null}
                          {showResolutionControl ? <p>{resolvedCopy.composer.resolutionHint}</p> : null}
                          {showOutputFormatControl ? <p>{resolvedCopy.composer.outputFormatHint}</p> : null}
                          {showEnableWebSearchControl ? <p>{resolvedCopy.composer.enableWebSearchHint}</p> : null}
                          {showThinkingLevelControl ? <p>{resolvedCopy.composer.thinkingLevelHint}</p> : null}
                          {showLimitGenerationsControl ? <p>{resolvedCopy.composer.limitGenerationsHint}</p> : null}
                        </div>
                      ) : null}
                    </div>
                    <Button type="submit" size="lg" className="w-full sm:w-auto shadow-card">
                      {resolvedCopy.runButton.idle}
                    </Button>
                  </div>

                  <section className="stack-gap-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                          {resolvedCopy.composer.referenceLabel}
                        </p>
                        <p className="text-[10px] text-text-secondary">{referenceHelperText}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={referenceSlotLimit === 0}
                          onClick={() => setLibraryModal({ open: true, slotIndex: null })}
                          className="rounded-full border-border text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          {resolvedCopy.composer.referenceButton}
                        </Button>
                        {supportsCharacterReferences ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCharacterPickerModal({ open: true })}
                            className="gap-2 rounded-full border-border text-[11px] text-text-secondary hover:text-text-primary"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {resolvedCopy.composer.characterButton}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {!supportsCharacterReferences && selectedCharacterReferences.length ? (
                      <p className="text-xs text-text-secondary">{resolvedCopy.composer.characterHiddenNotice}</p>
                    ) : null}
                    {hasHiddenCharacterReferences && supportsCharacterReferences ? (
                      <p className="text-xs text-text-secondary">
                        {formatTemplate(resolvedCopy.composer.characterLimitNotice, {
                          count: effectiveCharacterReferences.length,
                          suffix: effectiveCharacterReferences.length === 1 ? '' : 's',
                        })}
                      </p>
                    ) : null}
                    <div className="grid grid-gap-sm sm:grid-cols-2">
                      {selectedCharacterReferences.map((reference, index) => {
                        const isActiveCharacter = activeCharacterReferenceIds.has(reference.id);
                        return (
                          <div
                            key={`character-slot-${reference.id}`}
                            className={clsx(
                              'group relative flex aspect-[2/1] flex-col overflow-hidden rounded-2xl border border-solid bg-surface shadow-card transition',
                              isActiveCharacter ? 'border-text-muted' : 'border-border opacity-80'
                            )}
                          >
                            <img
                              src={reference.thumbUrl ?? reference.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute left-2 top-2">
                              <Chip
                                variant={isActiveCharacter ? 'accent' : 'ghost'}
                                className={clsx(
                                  'border-none px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
                                  isActiveCharacter ? '' : 'bg-surface-on-media-dark-60 text-on-inverse'
                                )}
                              >
                                {`Character ${index + 1}`}
                              </Chip>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCharacterReference(reference.id)}
                              className="absolute right-2 top-2 min-h-0 h-auto rounded-full bg-surface-on-media-dark-65 px-2 py-0.5 text-[11px] font-semibold text-on-inverse shadow hover:bg-surface-on-media-dark-70"
                              aria-label="Remove character reference"
                            >
                              ×
                            </Button>
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-surface-on-media-dark-55 px-2 py-1 text-[10px] text-on-inverse">
                              <span className="truncate">{getCharacterReferenceLabel(reference)}</span>
                              <span className="shrink-0 text-on-inverse/80">
                                {isActiveCharacter ? formatCharacterReferenceDate(reference.createdAt) : 'Saved'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {displayedReferenceSlots.map((slot, index) => (
                        <div
                          key={`slot-${index}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                          }}
                          onDrop={(event) => handleSlotDrop(event, index)}
                          onPaste={(event) => handleSlotPaste(event, index)}
                        className={clsx(
                          'group relative flex aspect-[2/1] flex-col overflow-hidden rounded-2xl border border-dashed border-hairline bg-surface-glass-80 text-center text-[11px] text-text-secondary transition',
                          slot && 'border-solid border-text-muted bg-surface shadow-card'
                        )}
                        >
                          <input
                            type="file"
                            accept={referenceInputAccept}
                            ref={(element) => {
                              fileInputRefs.current[index] = element;
                            }}
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              event.target.value = '';
                              void handleReferenceFile(index, file);
                            }}
                          />
                          {slot ? (
                            <>
                              <img
                                src={slot.previewUrl ?? slot.url}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveReferenceSlot(index)}
                                className="absolute right-2 top-2 min-h-0 h-auto rounded-full bg-surface-on-media-dark-65 px-2 py-0.5 text-[11px] font-semibold text-on-inverse shadow hover:bg-surface-on-media-dark-70"
                                aria-label={resolvedCopy.composer.referenceSlotActions.remove}
                              >
                                ×
                              </Button>
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-surface-on-media-dark-55 px-2 py-1 text-[10px] text-on-inverse">
                                <span className="truncate">
                                  {slot.name ?? slot.source ?? resolvedCopy.composer.referenceSlotNameFallback}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => triggerFileDialog(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-on-inverse hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.replace}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openLibraryForSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-on-inverse hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.library}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveReferenceSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-on-inverse hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.remove}
                                  </Button>
                                </div>
                              </div>
                              {slot.status === 'uploading' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-on-media-dark-50 px-3 text-center text-xs font-semibold text-on-inverse">
                                  <span>{resolvedCopy.general.uploading}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveReferenceSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-25 px-3 py-1 text-[11px] font-semibold text-on-inverse hover:bg-surface-on-media-40"
                                  >
                                    {resolvedCopy.general.cancelUpload}
                                  </Button>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-[11px] text-text-secondary">
                              <span className="text-text-primary">
                                {formatTemplate(resolvedCopy.composer.referenceSlotLabel, { index: index + 1 })}
                              </span>
                              <p className="text-[10px] leading-tight text-text-muted">{resolvedCopy.composer.referenceSlotHint}</p>
                              <div className="flex flex-wrap justify-center gap-2 text-[10px]">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => triggerFileDialog(index)}
                                  className="min-h-0 h-auto rounded-full border-border px-3 py-1 font-semibold text-text-primary"
                                >
                                  {resolvedCopy.composer.referenceSlotActions.upload}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openLibraryForSlot(index)}
                                  className="min-h-0 h-auto rounded-full border-border px-3 py-1 font-semibold text-text-primary"
                                >
                                  {resolvedCopy.composer.referenceSlotActions.library}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {canCollapseReferenceSlots ? (
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
                    ) : null}
                    <p className="mt-2 text-xs text-text-secondary">{referenceNoteText}</p>
                  </section>
                </Card>
              </form>
            </div>
          </main>
        </div>
        {isDesktopLayout ? (
          <div className="flex w-[320px] justify-end pl-2 pr-0 py-4">
            <GalleryRail
              engine={selectedEngineCaps}
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
        onClose={() => setLibraryModal({ open: false, slotIndex: null })}
        onSelect={handleLibrarySelect}
        copy={resolvedCopy.library}
        supportedFormats={supportedReferenceFormats}
        supportedFormatsLabel={supportedReferenceFormatsLabel}
        toolsEnabled={toolsEnabled}
      />
    ) : null}
      {characterPickerModal.open ? (
      <CharacterPickerModal
        open={characterPickerModal.open}
        onClose={() => setCharacterPickerModal({ open: false })}
        onToggle={toggleCharacterReference}
        selectedReferences={selectedCharacterReferences}
        maxSelectable={characterSelectionLimit}
        copy={resolvedCopy.characterPicker}
      />
    ) : null}
    </>
  );
}

function ImageLibraryModal({
  open,
  onClose,
  onSelect,
  copy,
  supportedFormats,
  supportedFormatsLabel,
  toolsEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
  copy: ImageWorkspaceCopy['library'];
  supportedFormats: string[];
  supportedFormatsLabel: string;
  toolsEnabled: boolean;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR(swrKey, async (url: string) => {
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

  const assets = useMemo(
    () =>
      (data ?? []).filter((asset) =>
        toolsEnabled ? true : asset.source !== 'character' && asset.source !== 'angle'
      ),
    [data, toolsEnabled]
  );
  const availableSources = useMemo(
    () =>
      toolsEnabled
        ? (['all', 'upload', 'generated', 'character', 'angle'] as const)
        : (['all', 'upload', 'generated'] as const),
    [toolsEnabled]
  );

  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource('all');
    }
  }, [activeSource, availableSources]);
  const compatibilityByAssetId = useMemo(() => {
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
  }, [assets, supportedFormats]);

  if (!open) {
    return null;
  }
  const emptyLabel =
    activeSource === 'generated'
      ? copy.modal.emptyGenerated
      : activeSource === 'upload'
        ? copy.modal.emptyUploads
        : activeSource === 'character'
          ? copy.modal.emptyCharacter
          : activeSource === 'angle'
            ? copy.modal.emptyAngle
        : copy.modal.empty;
  const supportedFormatsHint =
    supportedFormats.length && supportedFormatsLabel.length
      ? formatTemplate(copy.supportedFormats, { formats: supportedFormatsLabel })
      : null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.modal.title}</h2>
            <p className="text-xs text-text-secondary">{copy.modal.description}</p>
            {supportedFormatsHint ? <p className="mt-1 text-xs text-text-muted">{supportedFormatsHint}</p> : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.modal.close}
          </Button>
        </div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label="Library image filters"
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {availableSources.map((source) => (
              <Button
                key={source}
                type="button"
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={activeSource === source}
                onClick={() => setActiveSource(source)}
                className={clsx(
                  'flex-1 rounded-none px-4 py-2',
                  activeSource === source
                    ? 'bg-brand text-on-brand hover:bg-brand'
                    : 'text-text-secondary hover:bg-surface'
                )}
              >
                {copy.tabs[source]}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {copy.modal.error}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`library-modal-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              {emptyLabel}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => {
                const isCompatible = compatibilityByAssetId.get(asset.id) !== false;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      if (isCompatible) onSelect(asset);
                    }}
                    disabled={!isCompatible}
                    className={clsx(
                      'group block w-full overflow-hidden rounded-card border border-border bg-surface text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isCompatible ? 'hover:border-text-primary' : 'cursor-not-allowed opacity-60'
                    )}
                  >
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    {isCompatible ? (
                      <div className="absolute inset-0 hidden items-center justify-center bg-surface-on-media-dark-40 text-sm font-semibold text-on-inverse group-hover:flex">
                        {copy.overlay}
                      </div>
                    ) : (
                      <div className="absolute inset-x-3 bottom-3 rounded-full bg-surface-on-media-dark-60 px-3 py-1 text-center text-[11px] font-semibold text-on-inverse">
                        {copy.unsupported}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                    <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? copy.assetFallback}</p>
                    {!isCompatible ? <p className="text-state-warning">{copy.unsupported}</p> : null}
                    {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                  </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterPickerModal({
  open,
  onClose,
  onToggle,
  selectedReferences,
  maxSelectable,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  onToggle: (reference: CharacterReferenceSelection) => void;
  selectedReferences: CharacterReferenceSelection[];
  maxSelectable: number;
  copy: ImageWorkspaceCopy['characterPicker'];
}) {
  const swrKey = open ? '/api/character-references?limit=60' : null;
  const { data, error, isLoading } = useSWR(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as CharacterReferencesResponse | null;
    if (!response.ok || !payload?.ok) {
      let message: string | undefined;
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
      throw new Error(message ?? 'Failed to load character references');
    }
    return payload.characters;
  });

  const characters = useMemo(() => data ?? [], [data]);
  const selectedIds = useMemo(() => new Set(selectedReferences.map((reference) => reference.id)), [selectedReferences]);
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
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
              <UserRound className="h-3.5 w-3.5" />
              Characters
            </div>
            <h2 className="mt-2 text-lg font-semibold text-text-primary">{copy.title}</h2>
            <p className="text-xs text-text-secondary">{copy.description}</p>
            <p className="mt-1 text-xs text-text-muted">
              {formatTemplate(copy.limitLabel, { count: maxSelectable, suffix: maxSelectable === 1 ? '' : 's' })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.done}
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {error instanceof Error ? error.message : copy.empty}
            </div>
          ) : isLoading && !characters.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`character-modal-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : characters.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              {copy.empty}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => {
                const isSelected = selectedIds.has(character.id);
                const isDisabled = !isSelected && selectedReferences.length >= maxSelectable;
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => onToggle(character)}
                    disabled={isDisabled}
                    className={clsx(
                      'group block w-full overflow-hidden rounded-card border bg-surface text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isSelected ? 'border-brand ring-2 ring-brand/20' : 'border-border hover:border-text-primary',
                      isDisabled && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-t-card bg-placeholder">
                      <img
                        src={character.thumbUrl ?? character.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                        <Chip variant={isSelected ? 'accent' : 'outline'} className="border-none bg-surface-on-media-dark-60 text-on-inverse">
                          {isSelected ? copy.selected : copy.select}
                        </Chip>
                        {isSelected ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-on-brand shadow-card">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                      <p className="truncate text-sm font-medium text-text-primary">{getCharacterReferenceLabel(character)}</p>
                      <p>{formatCharacterReferenceDate(character.createdAt)}</p>
                      <p className="truncate text-text-muted">{character.engineLabel ?? 'Character Builder'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
