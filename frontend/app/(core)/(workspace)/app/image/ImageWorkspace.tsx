'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import deepmerge from 'deepmerge';
import type {
  FormEvent,
  DragEvent as ReactDragEvent,
  ClipboardEvent as ReactClipboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import type { ImageGenerationMode, GeneratedImage } from '@/types/image-generation';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { VideoGroup } from '@/types/video-groups';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { ImageCompositePreviewDock, type ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  formatAspectRatioLabel,
  getNanoBananaAspectRatios,
  getNanoBananaDefaultAspectRatio,
} from '@/lib/image/aspectRatios';
import { resolveCssAspectRatio } from '@/lib/aspect';
import { authFetch } from '@/lib/authFetch';

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
    modal: {
      title: string;
      description: string;
      close: string;
      error: string;
      empty: string;
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
    modal: {
      title: 'Select from library',
      description: 'Choose an image you previously imported.',
      close: 'Close',
      error: 'Unable to load assets. Please retry.',
      empty: 'No assets saved yet. Upload images from the composer or the Library page.',
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
const HISTORY_VISIBLE_CHUNK = 9;
const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

const clampImageCount = (value: number) => Math.min(MAX_IMAGE_COUNT, Math.max(MIN_IMAGE_COUNT, Math.round(value)));

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

type LibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
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

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
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

export default function ImageWorkspace({ engines }: ImageWorkspaceProps) {
  const { t } = useI18n();
  const rawCopy = t('workspace.image', DEFAULT_COPY);
  const resolvedCopy = useMemo<ImageWorkspaceCopy>(() => {
    return deepmerge<ImageWorkspaceCopy>(DEFAULT_COPY, (rawCopy ?? {}) as Partial<ImageWorkspaceCopy>);
  }, [rawCopy]);
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
  const isNanoBanana = useMemo(() => {
    if (!selectedEngine) return false;
    if (NANO_BANANA_ENGINE_IDS.has(selectedEngine.id)) {
      return true;
    }
    const aliases = selectedEngine.aliases ?? [];
    return aliases.some((alias) => {
      if (typeof alias !== 'string' || !alias.length) {
        return false;
      }
      if (NANO_BANANA_ENGINE_IDS.has(alias)) {
        return true;
      }
      return NANO_BANANA_ALIAS_PREFIXES.some((prefix) => alias.startsWith(prefix));
    });
  }, [selectedEngine]);

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(mode)) {
      setMode(selectedEngine.modes[0] ?? 't2i');
    }
  }, [selectedEngine, mode]);

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
      revalidateOnFocus: false,
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
    isLoading: jobsLoading,
    isValidating: jobsValidating,
    size: jobsSize,
    setSize: setJobsSize,
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

  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_VISIBLE_CHUNK);

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

  const handleSelectHistoryEntry = useCallback((entry: HistoryEntry) => {
    setSelectedPreviewEntryId(entry.id);
    setSelectedPreviewImageIndex(0);
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
      if (!prompt.trim()) {
        setError(resolvedCopy.errors.promptMissing);
        return;
      }
      if (referenceMinRequired > 0 && readyReferenceUrls.length < referenceMinRequired) {
        setError(resolvedCopy.errors.referenceMissing);
        return;
      }
      setIsGenerating(true);
      setError(null);
      setStatusMessage(null);
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
          prompt: prompt.trim(),
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
          prompt: prompt.trim(),
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
      } catch (err) {
        setError(err instanceof Error ? err.message : resolvedCopy.errors.generic);
      } finally {
        setIsGenerating(false);
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
  const visibleHistoryEntries = historyEntries.slice(0, visibleHistoryCount);
  const hasLocalHistoryMore = historyEntries.length > visibleHistoryCount;
  const handleLoadMoreHistory = useCallback(() => {
    if (hasLocalHistoryMore) {
      setVisibleHistoryCount((prev) => prev + HISTORY_VISIBLE_CHUNK);
      return;
    }
    if (jobPages && jobPages[jobPages.length - 1]?.nextCursor) {
      setVisibleHistoryCount((prev) => prev + HISTORY_VISIBLE_CHUNK);
      setJobsSize(jobsSize + 1);
    }
  }, [hasLocalHistoryMore, jobPages, jobsSize, setJobsSize]);
  const hasRemoteNextPage = Boolean(jobPages && jobPages[jobPages.length - 1]?.nextCursor);
  const shouldShowLoadMore = hasLocalHistoryMore || hasRemoteNextPage;

  useEffect(() => {
    setVisibleHistoryCount((prev) => {
      if (historyEntries.length < prev) {
        return Math.max(HISTORY_VISIBLE_CHUNK, historyEntries.length);
      }
      return prev;
    });
  }, [historyEntries.length]);

  if (!selectedEngine || !selectedEngineCaps) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
        {resolvedCopy.general.emptyEngines}
      </main>
    );
  }
  const previewEntry = (() => {
    if (selectedPreviewEntryId) {
      const match = historyEntries.find((entry) => entry.id === selectedPreviewEntryId);
      if (match) return match;
    }
    return historyEntries[0];
  })();
  const numImagesUnit =
    numImages === 1 ? resolvedCopy.composer.numImagesUnit.singular : resolvedCopy.composer.numImagesUnit.plural;
  const numImagesCountLabel = formatTemplate(resolvedCopy.composer.numImagesCount, {
    count: numImages,
    unit: numImagesUnit,
  });
  const promptCharCount = formatTemplate(resolvedCopy.composer.charCount, { count: prompt.length });
  const historyCountLabel =
    historyEntries.length === 0
      ? resolvedCopy.history.runsLabel.zero
      : formatTemplate(resolvedCopy.history.runsLabel.other, { count: historyEntries.length });
  const aspectRatioOptions = isNanoBanana ? getNanoBananaAspectRatios(mode) : [];
  const selectedAspectRatioLabel = formatAspectRatioLabel(aspectRatio);
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
  const galleryTitle = t('workspace.generate.galleryRail.title', 'Latest renders') as string;
  const galleryViewAll = t('workspace.generate.galleryRail.viewAll', 'View all') as string;
  const galleryOpen = t('workspace.image.preview.openModal', 'Open') as string;

  return (
    <>
      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <main className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),400px] xl:items-start">
            <div className="space-y-6">
              <ImageCompositePreviewDock
                entry={compositePreviewEntry}
                selectedIndex={selectedPreviewImageIndex}
                onSelectIndex={setSelectedPreviewImageIndex}
                onOpenModal={previewEntry ? () => handleOpenHistoryEntry(previewEntry) : undefined}
                onDownload={handleDownload}
                onCopyLink={handleCopy}
                copiedUrl={copiedUrl}
              />

              <form onSubmit={handleRun}>
                <Card className="space-y-4 p-5">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
                        {resolvedCopy.composer.promptLabel}
                      </h2>
                      {mode === 'i2i' && referenceMinRequired > 0 && readyReferenceUrls.length < referenceMinRequired ? (
                        <p className="mt-1 text-[12px] text-state-warning">{resolvedCopy.errors.referenceMissing}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <Chip variant={pricingValidating ? 'ghost' : 'accent'} className="px-3 py-1.5">
                        {pricingValidating ? resolvedCopy.engine.priceCalculating : composerPriceLabel}
                      </Chip>
                    </div>
                  </header>

                  {pricingError ? <p className="text-[12px] text-state-warning">{pricingError.message}</p> : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{resolvedCopy.composer.promptLabel}</span>
                        <span className="rounded-full border border-accent px-2 py-0.5 text-[10px] uppercase tracking-micro text-accent">
                          {t('workspace.generate.composer.labels.required', 'Required')}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">{promptCharCount}</span>
                    </div>
                    <textarea
                      id="prompt"
                      className="w-full rounded-input border border-border bg-white px-4 py-3 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={resolvedCopy.composer.promptPlaceholder}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={6}
                    />
                    {selectedEngine.prompts.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedEngine.prompts.map((preset) => (
                          <button
                            key={`${preset.title}-${preset.mode}`}
                            type="button"
                            onClick={() => handlePreset(preset)}
                            className="rounded-full border border-hairline bg-white/80 px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accentSoft/60 hover:bg-accentSoft/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {preset.title}
                          </button>
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

                  <button
                    type="submit"
                    disabled={isGenerating}
                    className={clsx(
                      'inline-flex w-full items-center justify-center rounded-input bg-accent px-5 py-3 text-sm font-semibold text-white shadow-card transition',
                      isGenerating ? 'opacity-60' : 'hover:bg-accent/90'
                    )}
                  >
                    {isGenerating ? resolvedCopy.runButton.running : resolvedCopy.runButton.idle}
                  </button>
                </Card>
              </form>
            </div>

	            <Card className="space-y-6 p-6 xl:self-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{resolvedCopy.engine.eyebrow}</p>
                <div className="mt-2 flex flex-col gap-3">
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
                    showBillingNote={false}
                  />
                </div>
              </div>

              <SectionDivider />

              <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                      {resolvedCopy.composer.numImagesLabel}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                      {resolvedCopy.composer.presetsHint}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{numImagesCountLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_IMAGE_COUNT_OPTIONS.map((option) => (
                    <button
                      key={`image-count-${option}`}
                      type="button"
                      onClick={() => setNumImagesPreset(option)}
                      className={clsx(
                        'rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        numImages === option
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-white text-text-secondary hover:border-accentSoft/60 hover:text-text-primary'
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </section>

              {isNanoBanana ? (
                <>
                  <SectionDivider />
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                          {resolvedCopy.composer.aspectRatioLabel}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {mode === 'i2i'
                            ? resolvedCopy.composer.aspectRatioAutoNote
                            : resolvedCopy.composer.aspectRatioHint}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {selectedAspectRatioLabel ?? resolvedCopy.composer.aspectRatioHint}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aspectRatioOptions.map((option) => (
                        <button
                          key={`aspect-ratio-${option}`}
                          type="button"
                          onClick={() => setAspectRatio(option)}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            aspectRatio === option
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-white text-text-secondary hover:border-accentSoft/60 hover:text-text-primary'
                          )}
                        >
                          {formatAspectRatioLabel(option) ?? option}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {hasResolutionOptions ? (
                <>
                  <SectionDivider />
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                          {resolvedCopy.composer.resolutionLabel}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {isResolutionLocked
                            ? resolvedCopy.composer.resolutionLockedLabel
                            : resolvedCopy.composer.resolutionHint}
                        </p>
                      </div>
                      {resolution ? (
                        <p className="text-sm font-semibold text-text-primary">{resolution.toUpperCase()}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resolutionOptions?.map((option) => (
                        <button
                          key={`resolution-${option}`}
                          type="button"
                          onClick={() => setResolution(option)}
                          disabled={isResolutionLocked}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            resolution === option
                              ? 'border-accent bg-accent text-white'
                              : 'border-border bg-white text-text-secondary hover:border-accentSoft/60 hover:text-text-primary',
                            isResolutionLocked && 'cursor-not-allowed opacity-70'
                          )}
                        >
                          {option.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              <SectionDivider />

              <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                      {resolvedCopy.composer.referenceLabel}
                    </p>
                    <p className="text-[10px] text-text-secondary">{referenceHelperText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLibraryModal({ open: true, slotIndex: null })}
                    className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-text-secondary transition hover:border-accent hover:text-text-primary"
                  >
                    {resolvedCopy.composer.referenceButton}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
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
                        'group relative flex aspect-square flex-col overflow-hidden rounded-2xl border border-dashed border-hairline bg-white/80 text-center text-[11px] text-text-secondary transition',
                        slot && 'border-solid border-accent/40 bg-white shadow-card'
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
                          <button
                            type="button"
                            onClick={() => handleRemoveReferenceSlot(index)}
                            className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
                            aria-label={resolvedCopy.composer.referenceSlotActions.remove}
                          >
                            ×
                          </button>
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1 text-[10px] text-white">
                            <span className="truncate">
                              {slot.name ?? slot.source ?? resolvedCopy.composer.referenceSlotNameFallback}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => triggerFileDialog(index)}
                                className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold"
                              >
                                {resolvedCopy.composer.referenceSlotActions.replace}
                              </button>
                              <button
                                type="button"
                                onClick={() => openLibraryForSlot(index)}
                                className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold"
                              >
                                {resolvedCopy.composer.referenceSlotActions.library}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveReferenceSlot(index)}
                                className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold"
                              >
                                {resolvedCopy.composer.referenceSlotActions.remove}
                              </button>
                            </div>
                          </div>
                          {slot.status === 'uploading' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-3 text-center text-xs font-semibold text-white">
                              <span>{resolvedCopy.general.uploading}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveReferenceSlot(index)}
                                className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/40"
                              >
                                {resolvedCopy.general.cancelUpload}
                              </button>
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
                            <button
                              type="button"
                              onClick={() => triggerFileDialog(index)}
                              className="rounded-full border border-border px-3 py-1 font-semibold text-text-primary"
                            >
                              {resolvedCopy.composer.referenceSlotActions.upload}
                            </button>
                            <button
                              type="button"
                              onClick={() => openLibraryForSlot(index)}
                              className="rounded-full border border-border px-3 py-1 font-semibold text-text-primary"
                            >
                              {resolvedCopy.composer.referenceSlotActions.library}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
	                <p className="mt-2 text-xs text-text-secondary">{resolvedCopy.composer.referenceNote}</p>
	              </section>
	            </Card>
          </div>

          <Card className="p-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{galleryTitle}</h2>
                <p className="mt-1 text-xs text-text-muted">{historyCountLabel}</p>
              </div>
              <Link
                href="/jobs"
                className="rounded-input border border-border bg-white px-4 py-2 text-sm font-semibold text-text-secondary transition hover:border-accentSoft/60 hover:bg-accentSoft/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {galleryViewAll}
              </Link>
            </header>

            {historyEntries.length === 0 ? (
              <div className="mt-4 rounded-card border border-dashed border-border bg-white/60 p-8 text-center text-sm text-text-secondary">
                {resolvedCopy.history.empty}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleHistoryEntries.map((entry) => {
                  const displayImages = entry.images.slice(0, 4);
                  const entryAspectRatioLabel = formatAspectRatioLabel(entry.aspectRatio ?? null);
                  const isSelected = previewEntry?.id === entry.id;
                  return (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectHistoryEntry(entry)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectHistoryEntry(entry);
                        }
                      }}
                      className={clsx(
                        'cursor-pointer overflow-hidden rounded-card border bg-white shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected ? 'border-accent' : 'border-border hover:border-accentSoft/60'
                      )}
                    >
                      <div className="relative bg-[#f2f4f8] p-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenHistoryEntry(entry);
                          }}
                          className="absolute right-3 top-3 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-semibold text-text-secondary shadow-sm transition hover:text-text-primary"
                        >
                          {galleryOpen}
                        </button>
                        {displayImages.length ? (
                          <div className="grid grid-cols-2 gap-1">
                            {displayImages.map((image, index) => (
                              <div
                                key={`${entry.id}-${index}`}
                                className="relative overflow-hidden rounded-[12px] bg-neutral-900/5"
                                style={{
                                  aspectRatio: resolveCssAspectRatio({
                                    value: entry.aspectRatio ?? null,
                                    width: image.width ?? null,
                                    height: image.height ?? null,
                                    fallback: '1 / 1',
                                  }),
                                }}
                              >
                                <img
                                  src={image.url}
                                  alt={entry.prompt}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-xs text-text-secondary">
                            {resolvedCopy.history.noPreview}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-text-secondary">
                        <p className="font-semibold text-text-primary">{entry.engineLabel}</p>
                        <p className="line-clamp-2 text-text-secondary">{entry.prompt}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                          <span>{entry.mode === 't2i' ? resolvedCopy.modeTabs.generate : resolvedCopy.modeTabs.edit}</span>
                          {entryAspectRatioLabel ? (
                            <span className="rounded-full bg-text-primary/10 px-2 py-0.5 text-[9px] font-semibold text-text-primary">
                              {entryAspectRatioLabel}
                            </span>
                          ) : null}
                        </div>
                        <span className="block text-[11px] text-text-muted">{formatTimestamp(entry.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {jobsLoading && historyEntries.length === 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`history-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
                    <div className="relative aspect-square overflow-hidden rounded-t-card bg-neutral-100">
                      <div className="skeleton absolute inset-0" />
                    </div>
                    <div className="border-t border-border px-4 py-3">
                      <div className="h-3 w-24 rounded-full bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {jobsValidating && historyEntries.length > 0 && (
              <div className="mt-4 text-center text-xs text-text-secondary">{resolvedCopy.history.refreshing}</div>
            )}

            {shouldShowLoadMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreHistory}
                  disabled={!hasLocalHistoryMore && hasRemoteNextPage && jobsValidating}
                  className={clsx(
                    'rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-primary',
                    !hasLocalHistoryMore && hasRemoteNextPage && jobsValidating ? 'opacity-60' : 'hover:bg-white/80'
                  )}
                >
                  {resolvedCopy.history.loadMore}
                </button>
              </div>
            )}
          </Card>
        </main>
      </div>
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
  const { data, error, isLoading } = useSWR(open ? '/api/user-assets?limit=60' : null, async (url: string) => {
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
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-border bg-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.modal.title}</h2>
            <p className="text-xs text-text-secondary">{copy.modal.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-border px-3 py-1 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.modal.close}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {copy.modal.error}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`library-modal-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
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
              {copy.modal.empty}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="group rounded-card border border-border bg-white text-left shadow-card transition hover:border-text-primary"
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
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
