'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import deepmerge from 'deepmerge';
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
import { Button } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import type { ImageGenerationMode, GeneratedImage } from '@/types/image-generation';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { VideoGroup } from '@/types/video-groups';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { ImageCompositePreviewDock, type ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  formatAspectRatioLabel,
  getNanoBananaAspectRatios,
  getNanoBananaDefaultAspectRatio,
} from '@/lib/image/aspectRatios';
import { authFetch } from '@/lib/authFetch';
import { adaptGroupSummary } from '@/lib/video-group-adapter';

const NANO_BANANA_ENGINE_IDS = new Set(['nano-banana', 'nano-banana-pro']);
const NANO_BANANA_ALIAS_PREFIXES = ['fal-ai/nano-banana'];

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
    estimatedCost: string;
    referenceLabel: string;
    referenceHelper: string;
    referenceNote: string;
    referenceButton: string;
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
    uploadFailed: string;
    fileTooLarge: string;
    unauthorized: string;
    promptMissing: string;
    referenceMissing: string;
    generic: string;
  };
  messages: {
    success: string;
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
    assetFallback: string;
    tabs: {
      all: string;
      upload: string;
      generated: string;
    };
    modal: {
      title: string;
      description: string;
      close: string;
      error: string;
      empty: string;
      emptyUploads: string;
      emptyGenerated: string;
    };
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
    presetsHint: 'Tap a preset · 1–8 per run',
    numImagesLabel: 'Number of images',
    numImagesCount: '{count} {unit}',
    numImagesUnit: {
      singular: 'image',
      plural: 'images',
    },
    aspectRatioLabel: 'Aspect ratio',
    aspectRatioHint: 'Choose a preset to match your frame.',
    aspectRatioAutoNote: 'Auto lets Nano Banana decide the final crop.',
    resolutionLabel: 'Resolution',
    resolutionHint: 'Draft in 1K/2K, then switch to 4K for finals (pricing updates automatically).',
    resolutionLockedLabel: 'Resolution locked by this engine.',
    estimatedCost: 'Estimated cost: {amount}',
    referenceLabel: 'Reference images',
    referenceHelper: 'Optional · up to {count} images',
    referenceNote:
      'Drag & drop, paste, upload from your device, or pull from your Library. These references are required for Edit mode.',
    referenceButton: 'Library',
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
    uploadFailed: 'Unable to upload the selected image. Try again.',
    fileTooLarge: 'Image exceeds {maxMB} MB. Compress it or choose a smaller file.',
    unauthorized: 'Session expired — please sign in again and retry the upload.',
    promptMissing: 'Prompt is required.',
    referenceMissing: 'Provide at least one source image for edit mode.',
    generic: 'Image generation failed.',
  },
  messages: {
    success: 'Generated {count} image{suffix}.',
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
    assetFallback: 'Asset',
    tabs: {
      all: 'All images',
      upload: 'Uploaded images',
      generated: 'Generated images',
    },
    modal: {
      title: 'Select from library',
      description: 'Choose an image you previously imported.',
      close: 'Close',
      error: 'Unable to load assets. Please retry.',
      empty: 'No assets saved yet. Upload images from the composer or the Library page.',
      emptyUploads: 'No uploaded images yet. Upload images from the composer or the Library page.',
      emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
    },
  },
};

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

const MAX_REFERENCE_SLOTS = 8;
const DEFAULT_REFERENCE_LIMIT = 4;
const MIN_IMAGE_COUNT = 1;
const MAX_IMAGE_COUNT = 8;
const QUICK_IMAGE_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;
const DESKTOP_RAIL_MIN_WIDTH = 1088;
const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

const IMAGE_COMPOSER_STORAGE_KEY = 'maxvideoai.image.composer.v1';
const IMAGE_COMPOSER_STORAGE_VERSION = 1;
const IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS = 1200;

const clampImageCount = (value: number) => Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, Math.round(value)));

function normalizeEngineToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isNanoBananaEngine(engine?: ImageEngineOption | null): boolean {
  if (!engine) return false;
  if (NANO_BANANA_ENGINE_IDS.has(engine.id)) {
    return true;
  }
  const aliases = engine.aliases ?? [];
  return aliases.some((alias) => {
    if (typeof alias !== 'string' || !alias.length) {
      return false;
    }
    if (NANO_BANANA_ENGINE_IDS.has(alias)) {
      return true;
    }
    return NANO_BANANA_ALIAS_PREFIXES.some((prefix) => alias.startsWith(prefix));
  });
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

type PersistedImageComposerState = {
  version: number;
  engineId: string;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  aspectRatio: string | null;
  resolution: string | null;
  referenceSlots: PersistedReferenceSlot[];
};

function parsePersistedImageComposerState(value: string): PersistedImageComposerState | null {
  try {
    const raw = JSON.parse(value) as Partial<PersistedImageComposerState> | null;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.version !== IMAGE_COMPOSER_STORAGE_VERSION) return null;
    if (typeof raw.engineId !== 'string' || raw.engineId.trim().length === 0) return null;
    const mode = raw.mode === 't2i' || raw.mode === 'i2i' ? raw.mode : 't2i';
    const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
    const numImagesRaw =
      typeof raw.numImages === 'number' && Number.isFinite(raw.numImages) ? Math.round(raw.numImages) : 1;
    const aspectRatio = typeof raw.aspectRatio === 'string' ? raw.aspectRatio : null;
    const resolution = typeof raw.resolution === 'string' ? raw.resolution : null;
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

    return {
      version: IMAGE_COMPOSER_STORAGE_VERSION,
      engineId: raw.engineId.trim(),
      mode,
      prompt,
      numImages: numImagesRaw,
      aspectRatio,
      resolution,
      referenceSlots,
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

type PricingEstimateResponse = {
  ok: boolean;
  pricing: PricingSnapshot;
};

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
}

function SectionDivider() {
  return <div className="my-6 border-t border-white/60" role="presentation" />;
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
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu options={options} value={value} onChange={onChange} disabled={disabled} />
    </label>
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
  const images: GeneratedImage[] =
    renderUrls.length > 0
      ? renderUrls.map((url) => ({ url }))
      : job.thumbUrl
        ? [{ url: job.thumbUrl }]
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
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const rawCopy = t('workspace.image', DEFAULT_COPY);
  const resolvedCopy = useMemo<ImageWorkspaceCopy>(() => {
    return deepmerge<ImageWorkspaceCopy>(DEFAULT_COPY, (rawCopy ?? {}) as Partial<ImageWorkspaceCopy>);
  }, [rawCopy]);
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
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [isRemovingFromLibrary, setIsRemovingFromLibrary] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);
  const [libraryModal, setLibraryModal] = useState<{ open: boolean; slotIndex: number | null }>({
    open: false,
    slotIndex: null,
  });
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [
    priceEstimateKey,
    setPriceEstimateKey,
  ] = useState<[string, string, ImageGenerationMode, number, string] | null>(() =>
    engines[0] ? ['image-pricing', engines[0].id, 't2i', 1, ''] : null
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
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;
  const engineInputFields = useMemo<EngineInputField[]>(() => {
    const schema = selectedEngineCaps?.inputSchema;
    if (!schema) {
      return [];
    }
    return [...(schema.required ?? []), ...(schema.optional ?? [])];
  }, [selectedEngineCaps]);
  const resolutionField = useMemo<EngineInputField | null>(() => {
    if (!engineInputFields.length) return null;
    const byMode =
      engineInputFields.find(
        (field) =>
          field.id === 'resolution' &&
          (field.modes?.includes(mode) || field.requiredInModes?.includes(mode))
      ) ?? null;
    if (byMode) return byMode;
    return engineInputFields.find((field) => field.id === 'resolution') ?? null;
  }, [engineInputFields, mode]);
  const resolutionOptions = useMemo(() => {
    if (!resolutionField?.values?.length) return null;
    return resolutionField.values;
  }, [resolutionField]);
  const hasResolutionOptions = Boolean(resolutionOptions && resolutionOptions.length > 0);
  const isResolutionLocked = hasResolutionOptions && !!resolutionOptions && resolutionOptions.length === 1;
  useEffect(() => {
    if (!hasResolutionOptions) {
      setResolution(null);
      return;
    }
    const defaultValue =
      (typeof resolutionField?.default === 'string' && resolutionField.default.length
        ? resolutionField.default
        : null) ?? resolutionOptions?.[0] ?? null;
    setResolution((previous) => {
      if (previous && resolutionOptions?.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [hasResolutionOptions, resolutionField, resolutionOptions]);
  const referenceField = useMemo<EngineInputField | null>(() => {
    if (!engineInputFields.length) return null;
    const byMode =
      engineInputFields.find(
        (field) =>
          field.id === 'image_urls' &&
          (field.modes?.includes(mode) || field.requiredInModes?.includes(mode))
      ) ?? null;
    if (byMode) return byMode;
    return engineInputFields.find((field) => field.id === 'image_urls') ?? null;
  }, [engineInputFields, mode]);
  const referenceMinRequired = useMemo(() => {
    const requiresReferences =
      mode === 'i2i' || Boolean(referenceField?.requiredInModes?.includes(mode));
    if (!requiresReferences) {
      return 0;
    }
    const rawMin =
      typeof referenceField?.minCount === 'number' && Number.isFinite(referenceField.minCount)
        ? Math.round(referenceField.minCount)
        : null;
    return Math.max(1, rawMin ?? 1);
  }, [mode, referenceField]);
  const referenceSlotLimit = useMemo(() => {
    const desiredMax = referenceField?.maxCount ?? DEFAULT_REFERENCE_LIMIT;
    const requiredMin = referenceField?.minCount ?? 1;
    const next = Math.max(requiredMin, desiredMax, 1);
    return Math.min(MAX_REFERENCE_SLOTS, next);
  }, [referenceField]);
  const visibleReferenceSlots = useMemo(
    () => referenceSlots.slice(0, referenceSlotLimit),
    [referenceSlots, referenceSlotLimit]
  );
  const referenceHelperText = useMemo(
    () => formatTemplate(resolvedCopy.composer.referenceHelper, { count: referenceSlotLimit }),
    [referenceSlotLimit, resolvedCopy.composer.referenceHelper]
  );
  const isNanoBanana = useMemo(() => isNanoBananaEngine(selectedEngine), [selectedEngine]);

  useEffect(() => {
    if (!isNanoBanana) {
      setAspectRatio(null);
      return;
    }
    const options = getNanoBananaAspectRatios(mode);
    const defaultValue = getNanoBananaDefaultAspectRatio(mode);
    setAspectRatio((previous) => {
      if (previous && options.includes(previous)) {
        return previous;
      }
      return defaultValue;
    });
  }, [isNanoBanana, mode]);

  useEffect(() => {
    if (!selectedEngine) return;
    setPriceEstimateKey(['image-pricing', selectedEngine.id, mode, numImages, resolution ?? '']);
  }, [selectedEngine, mode, numImages, resolution]);

  const {
    data: pricingData,
    error: pricingError,
    isValidating: pricingValidating,
  } = useSWR(
    priceEstimateKey,
    async ([, engineId, requestMode, count, requestResolution]) => {
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          mode: requestMode,
          numImages: count,
          resolution: requestResolution || undefined,
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
  } = useInfiniteJobs(24, { type: 'image' });

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
        width: image.width ?? null,
        height: image.height ?? null,
      })),
    });
    setViewerGroup(group);
  }, []);

  const closeViewer = useCallback(() => setViewerGroup(null), []);

  const handleOpenGalleryGroup = useCallback((group: GroupSummary) => {
    const hasMedia = group.previews.some((preview) => preview.thumbUrl || preview.videoUrl);
    if (!hasMedia) return;
    const normalized = normalizeGroupSummary(group);
    setViewerGroup(adaptGroupSummary(normalized, 'fal'));
  }, []);

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
        setNumImages(clampImageCount(parsed.numImages));
        const allowedResolutions = (engineMatch.engineCaps?.resolutions ?? []) as readonly string[];
        setResolution(parsed.resolution && allowedResolutions.includes(parsed.resolution) ? parsed.resolution : null);

        if (isNanoBananaEngine(engineMatch)) {
          const options = getNanoBananaAspectRatios(nextMode);
          const defaultValue = getNanoBananaDefaultAspectRatio(nextMode);
          const nextAspectRatio = parsed.aspectRatio && options.includes(parsed.aspectRatio) ? parsed.aspectRatio : defaultValue;
          setAspectRatio(nextAspectRatio);
        } else {
          setAspectRatio(null);
        }
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
        setNumImages(clampImageCount(numImagesRaw));
      }
      const aspectRatioRaw = typeof core.aspectRatio === 'string' ? core.aspectRatio : null;
      const resolutionRaw = typeof core.resolution === 'string' ? core.resolution : null;
      if (engineMatch) {
        const allowedResolutions = (engineMatch.engineCaps?.resolutions ?? []) as readonly string[];
        setResolution(resolutionRaw && allowedResolutions.includes(resolutionRaw) ? resolutionRaw : null);
      } else {
        setResolution(resolutionRaw);
      }
      if (engineMatch && isNanoBananaEngine(engineMatch)) {
        const resolvedMode =
          snapshotMode && engineMatch.modes.includes(snapshotMode) ? snapshotMode : engineMatch.modes[0] ?? 't2i';
        const options = getNanoBananaAspectRatios(resolvedMode);
        const defaultValue = getNanoBananaDefaultAspectRatio(resolvedMode);
        setAspectRatio(aspectRatioRaw && options.includes(aspectRatioRaw) ? aspectRatioRaw : defaultValue);
      }

      const refs = record.refs && typeof record.refs === 'object' ? (record.refs as Record<string, unknown>) : {};
      const imageUrlsRaw = refs.imageUrls;
      const imageUrls = Array.isArray(imageUrlsRaw)
        ? imageUrlsRaw.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter((entry) => entry.length)
        : imageUrlsRaw === null
          ? []
          : null;
      if (imageUrls !== null) {
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
      }

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
    engineId,
    engines,
    mode,
    numImages,
    persistableReferenceSlots,
    prompt,
    resolution,
    storageHydrated,
  ]);

  useEffect(() => {
    setReferenceSlots((previous) => {
      let mutated = false;
      const next = previous.slice();
      for (let index = referenceSlotLimit; index < next.length; index += 1) {
        if (next[index]) {
          cleanupSlotPreview(next[index]);
          next[index] = null;
          mutated = true;
        }
      }
      return mutated ? next : previous;
    });
  }, [cleanupSlotPreview, referenceSlotLimit]);

  const setNumImagesPreset = useCallback((value: number) => {
    setNumImages(clampImageCount(value));
  }, []);

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
      if (!file || !file.type.startsWith('image/')) {
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
        const formData = new FormData();
        formData.append('file', file, file.name);
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
      resolvedCopy.errors.onlyImages,
      resolvedCopy.errors.uploadFailed,
      resolvedCopy.errors.fileTooLarge,
      resolvedCopy.errors.unauthorized,
    ]
  );

  const handleReferenceUrl = useCallback(
    (index: number, url: string, source: ReferenceSlotValue['source']) => {
      if (!url) return;
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
    [cleanupSlotPreview]
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
      let slotIndex = libraryModal.slotIndex;
      if (slotIndex == null) {
        slotIndex = visibleReferenceSlots.findIndex((slot) => slot === null);
        if (slotIndex < 0) {
          slotIndex = Math.max(0, referenceSlotLimit - 1);
        }
      }
      if (slotIndex >= referenceSlotLimit) {
        setLibraryModal({ open: false, slotIndex: null });
        return;
      }
      const index = slotIndex;
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
    [cleanupSlotPreview, libraryModal.slotIndex, referenceSlotLimit, visibleReferenceSlots]
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

  const handleRun = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedEngine) return;
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setError(resolvedCopy.errors.promptMissing);
        return;
      }
      if (referenceMinRequired > 0 && readyReferenceUrls.length < referenceMinRequired) {
        setError(resolvedCopy.errors.referenceMissing);
        return;
      }
      setError(null);
      setStatusMessage(null);
      const pendingId = `pending-${crypto.randomUUID()}`;
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
        const appliedAspectRatio =
          isNanoBanana && (aspectRatio || aspectRatio === 'auto')
            ? aspectRatio
            : isNanoBanana
              ? getNanoBananaDefaultAspectRatio(mode)
              : undefined;
        const response = await runImageGeneration({
          engineId: selectedEngine.id,
          mode,
          prompt: trimmedPrompt,
          numImages,
          imageUrls: mode === 'i2i' ? readyReferenceUrls : undefined,
          aspectRatio: appliedAspectRatio,
          resolution: resolution ?? undefined,
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
      readyReferenceUrls,
      resolvedCopy.errors.generic,
      resolvedCopy.errors.promptMissing,
      resolvedCopy.errors.referenceMissing,
      resolvedCopy.messages.success,
      aspectRatio,
      isNanoBanana,
      referenceMinRequired,
      resolution,
      selectedEngine,
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '';
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const historyEntries = combinedHistory;

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

  const hasPendingRuns = pendingGroups.length > 0;
  const promptCharCount = formatTemplate(resolvedCopy.composer.charCount, { count: prompt.length });
  const aspectRatioOptions = useMemo(
    () => (isNanoBanana ? getNanoBananaAspectRatios(mode) : []),
    [isNanoBanana, mode]
  );
  const imageCountOptions = useMemo(
    () =>
      QUICK_IMAGE_COUNT_OPTIONS.map((option) => ({
        value: option,
        label: formatTemplate(resolvedCopy.composer.numImagesCount, {
          count: option,
          unit: option === 1 ? resolvedCopy.composer.numImagesUnit.singular : resolvedCopy.composer.numImagesUnit.plural,
        }),
      })),
    [resolvedCopy.composer.numImagesCount, resolvedCopy.composer.numImagesUnit]
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
      (resolutionOptions ?? []).map((option) => ({
        value: option,
        label: option.toUpperCase(),
      })),
    [resolutionOptions]
  );
  const showAspectRatioControl = aspectRatioSelectOptions.length > 0;
  const showResolutionControl = resolutionSelectOptions.length > 0;
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
                    showModeSelect
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
                        <Chip variant={pricingValidating ? 'ghost' : 'outline'} className="px-3 py-1.5">
                          {pricingValidating ? resolvedCopy.engine.priceCalculating : composerPriceLabel}
                        </Chip>
                      </div>
                    </div>
                    {mode === 'i2i' && referenceMinRequired > 0 && readyReferenceUrls.length < referenceMinRequired ? (
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

                  {statusMessage ? (
                    <p className="rounded-card border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {statusMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-2 grid-gap-sm sm:grid-cols-3 lg:grid-cols-4">
                        <SelectGroup
                          label={resolvedCopy.composer.numImagesLabel}
                          options={imageCountOptions}
                          value={numImages}
                          onChange={(value) => setNumImagesPreset(Number(value))}
                        />
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
                      </div>
                    </div>
                    <Button type="submit" size="lg" className="w-full sm:w-auto shadow-card">
                      {hasPendingRuns ? resolvedCopy.runButton.running : resolvedCopy.runButton.idle}
                    </Button>
                  </div>

                  <SectionDivider />

                  <section className="stack-gap-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                          {resolvedCopy.composer.referenceLabel}
                        </p>
                        <p className="text-[10px] text-text-secondary">{referenceHelperText}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLibraryModal({ open: true, slotIndex: null })}
                        className="rounded-full border-border text-[11px] text-text-secondary hover:text-text-primary"
                      >
                        {resolvedCopy.composer.referenceButton}
                      </Button>
                    </div>
                    <div className="grid grid-gap-sm sm:grid-cols-2">
                      {visibleReferenceSlots.map((slot, index) => (
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
                            accept="image/*"
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
                                className="absolute right-2 top-2 min-h-0 h-auto rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white shadow hover:bg-black/70"
                                aria-label={resolvedCopy.composer.referenceSlotActions.remove}
                              >
                                ×
                              </Button>
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1 text-[10px] text-white">
                                <span className="truncate">
                                  {slot.name ?? slot.source ?? resolvedCopy.composer.referenceSlotNameFallback}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => triggerFileDialog(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.replace}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openLibraryForSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.library}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveReferenceSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-20 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-surface-on-media-30"
                                  >
                                    {resolvedCopy.composer.referenceSlotActions.remove}
                                  </Button>
                                </div>
                              </div>
                              {slot.status === 'uploading' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-3 text-center text-xs font-semibold text-white">
                                  <span>{resolvedCopy.general.uploading}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveReferenceSlot(index)}
                                    className="min-h-0 h-auto rounded-full bg-surface-on-media-25 px-3 py-1 text-[11px] font-semibold text-white hover:bg-surface-on-media-40"
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
                    <p className="mt-2 text-xs text-text-secondary">{resolvedCopy.composer.referenceNote}</p>
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
              onOpenGroup={handleOpenGalleryGroup}
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
            onOpenGroup={handleOpenGalleryGroup}
            variant="mobile"
          />
        </div>
      ) : null}
      {viewerGroup ? (
      <GroupViewerModal
        group={viewerGroup}
        onClose={closeViewer}
        defaultAllowIndex={false}
        onSaveToLibrary={handleSaveVariantToLibrary}
      />
    ) : null}
      {libraryModal.open ? (
      <ImageLibraryModal
        open={libraryModal.open}
        onClose={() => setLibraryModal({ open: false, slotIndex: null })}
        onSelect={handleLibrarySelect}
        copy={resolvedCopy.library}
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
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
  copy: ImageWorkspaceCopy['library'];
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated'>('all');
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

  if (!open) {
    return null;
  }

  const assets = data ?? [];
  const emptyLabel =
    activeSource === 'generated'
      ? copy.modal.emptyGenerated
      : activeSource === 'upload'
        ? copy.modal.emptyUploads
        : copy.modal.empty;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.modal.title}</h2>
            <p className="text-xs text-text-secondary">{copy.modal.description}</p>
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
            <Button
              type="button"
              role="tab"
              variant="ghost"
              size="sm"
              aria-selected={activeSource === 'all'}
              onClick={() => setActiveSource('all')}
              className={clsx(
                'flex-1 rounded-none px-4 py-2',
                activeSource === 'all' ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
              )}
            >
              {copy.tabs.all}
            </Button>
            <Button
              type="button"
              role="tab"
              variant="ghost"
              size="sm"
              aria-selected={activeSource === 'upload'}
              onClick={() => setActiveSource('upload')}
              className={clsx(
                'flex-1 rounded-none px-4 py-2',
                activeSource === 'upload' ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
              )}
            >
              {copy.tabs.upload}
            </Button>
            <Button
              type="button"
              role="tab"
              variant="ghost"
              size="sm"
              aria-selected={activeSource === 'generated'}
              onClick={() => setActiveSource('generated')}
              className={clsx(
                'flex-1 rounded-none px-4 py-2',
                activeSource === 'generated' ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
              )}
            >
              {copy.tabs.generated}
            </Button>
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
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-neutral-100">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-neutral-200" />
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
              {assets.map((asset) => (
                <Button
                  key={asset.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelect(asset)}
                  className="group min-h-0 h-auto rounded-card border border-border bg-surface p-0 text-left shadow-card hover:border-text-primary"
                >
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-[#f2f4f8]">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-black/40 text-sm font-semibold text-white group-hover:flex">
                      {copy.overlay}
                    </div>
                  </div>
                  <div className="space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                    <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? copy.assetFallback}</p>
                    {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
