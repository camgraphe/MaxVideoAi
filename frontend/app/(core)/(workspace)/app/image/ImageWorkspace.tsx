'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import deepmerge from 'deepmerge';
import type {
  FormEvent,
  DragEvent as ReactDragEvent,
  ClipboardEvent as ReactClipboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import type { ImageGenerationMode, GeneratedImage } from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { VideoGroup } from '@/types/video-groups';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';

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
    promptMissing: string;
    referenceMissing: string;
    generic: string;
  };
  messages: {
    success: string;
  };
  general: {
    uploading: string;
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
  },
  engine: {
    eyebrow: 'Engine',
    priceCalculating: 'Calculating price…',
    priceLabel: '{amount} / run',
  },
  modeTabs: {
    generate: 'Generate',
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
    estimatedCost: 'Estimated cost: {amount}',
    referenceLabel: 'Reference images',
    referenceHelper: 'Optional · up to 4 images',
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
    promptMissing: 'Prompt is required.',
    referenceMissing: 'Provide at least one source image for edit mode.',
    generic: 'Image generation failed.',
  },
  messages: {
    success: 'Generated {count} image{suffix}.',
  },
  general: {
    uploading: 'Uploading…',
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

const MAX_REFERENCE_SLOTS = 4;
const MIN_IMAGE_COUNT = 1;
const MAX_IMAGE_COUNT = 8;
const QUICK_IMAGE_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;

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
};

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
  const [referenceSlots, setReferenceSlots] = useState<(ReferenceSlotValue | null)[]>(
    Array(MAX_REFERENCE_SLOTS).fill(null)
  );
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
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
  ] = useState<[string, string, ImageGenerationMode, number] | null>(() =>
    engines[0] ? ['image-pricing', engines[0].id, 't2i', 1] : null
  );

  const engineCapsList = useMemo(() => engines.map((engine) => engine.engineCaps), [engines]);
  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(mode)) {
      setMode(selectedEngine.modes[0] ?? 't2i');
    }
  }, [selectedEngine, mode]);

  useEffect(() => {
    if (!selectedEngine) return;
    setPriceEstimateKey(['image-pricing', selectedEngine.id, mode, numImages]);
  }, [selectedEngine, mode, numImages]);

  const {
    data: pricingData,
    error: pricingError,
    isValidating: pricingValidating,
  } = useSWR(
    priceEstimateKey,
    async ([, engineId, requestMode, count]) => {
      const response = await fetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ engineId, mode: requestMode, numImages: count }),
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

  const priceBadgeLabel = useMemo(
    () => formatTemplate(resolvedCopy.engine.priceLabel, { amount: estimatedCostLabel }),
    [estimatedCostLabel, resolvedCopy.engine.priceLabel]
  );

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

  const readyReferenceUrls = useMemo(
    () => referenceSlots.filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready')).map((slot) => slot.url),
    [referenceSlots]
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
      images: entry.images.map((image) => ({
        url: image.url,
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
        const response = await fetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'UPLOAD_FAILED');
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
        setError(resolvedCopy.errors.uploadFailed);
      }
    },
    [cleanupSlotPreview, resolvedCopy.errors.onlyImages, resolvedCopy.errors.uploadFailed]
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
        slotIndex = referenceSlots.findIndex((slot) => slot === null);
        if (slotIndex < 0) {
          slotIndex = 0;
        }
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
    [cleanupSlotPreview, libraryModal.slotIndex, referenceSlots]
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
      if (mode === 'i2i' && readyReferenceUrls.length === 0) {
        setError(resolvedCopy.errors.referenceMissing);
        return;
      }
      setIsGenerating(true);
      setError(null);
      setStatusMessage(null);
      try {
        const response = await runImageGeneration({
          engineId: selectedEngine.id,
          mode,
          prompt: prompt.trim(),
          numImages,
          imageUrls: mode === 'i2i' ? readyReferenceUrls : undefined,
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
        };
        setLocalHistory((prev) => [entry, ...prev].slice(0, 24));
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

  if (!selectedEngine || !selectedEngineCaps) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg text-text-secondary">
        {resolvedCopy.general.emptyEngines}
      </main>
    );
  }

  const historyEntries = combinedHistory;
  const previewEntry = historyEntries[0];
  const numImagesUnit =
    numImages === 1 ? resolvedCopy.composer.numImagesUnit.singular : resolvedCopy.composer.numImagesUnit.plural;
  const numImagesCountLabel = formatTemplate(resolvedCopy.composer.numImagesCount, {
    count: numImages,
    unit: numImagesUnit,
  });
  const promptCharCount = formatTemplate(resolvedCopy.composer.charCount, { count: prompt.length });
  const estimatedCostText = formatTemplate(resolvedCopy.composer.estimatedCost, { amount: estimatedCostLabel });
  const historyCountLabel =
    historyEntries.length === 0
      ? resolvedCopy.history.runsLabel.zero
      : formatTemplate(resolvedCopy.history.runsLabel.other, { count: historyEntries.length });

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col gap-6 p-6">
          <section className="rounded-[32px] border border-white/30 bg-white/80 p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{resolvedCopy.hero.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold text-text-primary">{resolvedCopy.hero.title}</h1>
            <p className="mt-1 text-sm text-text-secondary">{resolvedCopy.hero.subtitle}</p>
          </section>
          <div className="grid gap-6 xl:grid-cols-[400px,1fr] xl:items-start">
            <section className="order-1 rounded-[24px] border border-white/20 bg-white/70 p-6 shadow-card xl:col-start-2 xl:row-start-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{resolvedCopy.preview.eyebrow}</p>
                  <h2 className="text-2xl font-semibold text-text-primary">{resolvedCopy.preview.title}</h2>
                </div>
                {previewEntry ? <span className="text-xs text-text-secondary">{formatTimestamp(previewEntry.createdAt)}</span> : null}
              </div>
              <div className="mt-4 rounded-2xl border border-white/60 bg-white/80 p-4">
                {previewEntry?.images[0] ? (
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="flex-1">
                      <div className="relative overflow-hidden rounded-2xl bg-[#f2f4f8]" style={{ aspectRatio: '1 / 1' }}>
                        <img
                          src={previewEntry.images[0].url}
                          alt={previewEntry.prompt}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">{previewEntry.engineLabel}</p>
                      <p className="text-text-secondary">{previewEntry.prompt}</p>
                      <div className="text-[11px] uppercase tracking-[0.25em] text-text-muted">
                        {previewEntry.mode === 't2i' ? resolvedCopy.modeTabs.generate : resolvedCopy.modeTabs.edit}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(previewEntry.images[0].url)}
                          className="rounded-full bg-text-primary/10 px-3 py-1 text-[11px] font-semibold text-text-primary"
                        >
                          {resolvedCopy.preview.download}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(previewEntry.images[0].url)}
                          className="rounded-full border border-text-primary/20 px-3 py-1 text-[11px] font-semibold text-text-primary"
                        >
                          {copiedUrl === previewEntry.images[0].url ? resolvedCopy.preview.copied : resolvedCopy.preview.copy}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-white/60 px-6 py-12 text-center text-sm text-text-secondary">
                    <p>{resolvedCopy.preview.emptyTitle}</p>
                    <p className="text-xs text-text-muted">{resolvedCopy.preview.emptyDescription}</p>
                  </div>
                )}
              </div>
            </section>

            <form
              className="order-2 rounded-[24px] border border-white/10 bg-white/70 p-6 shadow-card backdrop-blur xl:col-start-1 xl:row-span-2"
              onSubmit={handleRun}
            >
            <div className="flex flex-col gap-6">
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
                  <span className="inline-flex items-center gap-2 rounded-full bg-accentSoft/15 px-3 py-1 text-xs font-semibold text-accent">
                    {pricingValidating ? resolvedCopy.engine.priceCalculating : priceBadgeLabel}
                  </span>
                  {pricingError ? (
                    <p className="text-xs text-state-warning">{pricingError.message}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                    {resolvedCopy.composer.promptLabel}
                  </label>
                  <span className="text-xs text-text-secondary">{promptCharCount}</span>
                </div>
                <textarea
                  id="prompt"
                  className="mt-2 min-h-[140px] w-full rounded-2xl border border-hairline bg-white/80 px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder={resolvedCopy.composer.promptPlaceholder}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                {selectedEngine.prompts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedEngine.prompts.map((preset) => (
                      <button
                        key={`${preset.title}-${preset.mode}`}
                        type="button"
                        onClick={() => handlePreset(preset)}
                        className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-text-primary"
                      >
                        {preset.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                  <span>{resolvedCopy.composer.numImagesLabel}</span>
                  <span className="text-text-secondary">{numImagesCountLabel}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-text-muted">{resolvedCopy.composer.presetsHint}</p>
                <p className="mt-1 text-xs text-text-secondary">{estimatedCostText}</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                  <span>{resolvedCopy.composer.referenceLabel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary">{resolvedCopy.composer.referenceHelper}</span>
                    <button
                      type="button"
                      onClick={() => setLibraryModal({ open: true, slotIndex: null })}
                      className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-text-primary transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {resolvedCopy.library.button}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {referenceSlots.map((slot, index) => (
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
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white">
                              {resolvedCopy.general.uploading}
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
              </div>

              {error && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              {statusMessage && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {statusMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className={clsx(
                  'inline-flex items-center justify-center rounded-2xl bg-text-primary px-5 py-3 text-sm font-semibold text-white transition',
                  isGenerating ? 'opacity-60' : 'hover:bg-text-secondary'
                )}
              >
                {isGenerating ? resolvedCopy.runButton.running : resolvedCopy.runButton.idle}
              </button>
            </div>
            </form>

            <div className="order-3 rounded-[24px] border border-dashed border-white/20 bg-white/60 p-6 shadow-inner xl:col-start-2 xl:row-start-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{resolvedCopy.history.eyebrow}</p>
                  <h2 className="text-2xl font-semibold text-text-primary">{selectedEngine.name}</h2>
                </div>
                <span className="text-xs text-text-secondary">{historyCountLabel}</span>
              </div>
              {historyEntries.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-white/50 bg-white/70 p-8 text-center text-sm text-text-secondary">
                  {resolvedCopy.history.empty}
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {historyEntries.map((entry) => {
                    const displayImages = entry.images.slice(0, 4);
                    return (
                      <div
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenHistoryEntry(entry)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleOpenHistoryEntry(entry);
                          }
                        }}
                        className="cursor-pointer rounded-2xl border border-white/40 bg-white/80 shadow-card transition hover:border-text-primary"
                      >
                        <div className="rounded-t-2xl bg-[#f2f4f8] p-1">
                          {displayImages.length ? (
                            <div className="grid grid-cols-2 gap-1">
                              {displayImages.map((image, index) => (
                                <div key={`${entry.id}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
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
                      <div className="space-y-2 border-t border-white/60 px-4 py-3 text-xs text-text-secondary">
                        <p className="font-semibold text-text-primary">{entry.engineLabel}</p>
                        <p className="line-clamp-2 text-text-secondary">{entry.prompt}</p>
                        <div className="flex items-center justify-between text-[11px] text-text-muted">
                          <span>{entry.mode === 't2i' ? resolvedCopy.modeTabs.generate : resolvedCopy.modeTabs.edit}</span>
                          <span>{formatTimestamp(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              {jobsLoading && historyEntries.length === 0 && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`history-skeleton-${index}`} className="rounded-2xl border border-white/40 bg-white/60 p-0" aria-hidden>
                      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-neutral-100">
                        <div className="skeleton absolute inset-0" />
                      </div>
                      <div className="border-t border-white/60 px-4 py-3">
                        <div className="h-3 w-24 rounded-full bg-neutral-200" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {jobsValidating && historyEntries.length > 0 && (
                <div className="mt-4 text-center text-xs text-text-secondary">{resolvedCopy.history.refreshing}</div>
              )}
              {jobPages && jobPages[jobPages.length - 1]?.nextCursor && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setJobsSize(jobsSize + 1)}
                    className="rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-text-primary hover:bg-white/80"
                  >
                    {resolvedCopy.history.loadMore}
                  </button>
                </div>
              )}
            </div>
          </div>
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
    const response = await fetch(url, { credentials: 'include' });
    const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.['error'] ?? 'Failed to load library');
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
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[24px] border border-border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.modal.title}</h2>
            <p className="text-xs text-text-secondary">{copy.modal.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-sm font-medium text-text-secondary hover:bg-bg"
          >
            {copy.modal.close}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
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
