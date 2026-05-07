'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { GalleryRail } from '@/components/GalleryRail';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { Composer, type AssetFieldConfig, type ComposerAttachment } from '@/components/Composer';
import { ImageSettingsBar } from '@/components/ImageSettingsBar';
import { ImageAdvancedSettings } from '@/components/ImageAdvancedSettings';
import { runImageGeneration, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import type {
  CharacterReferenceSelection,
  ImageGenerationMode,
} from '@/types/image-generation';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { VideoGroup } from '@/types/video-groups';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { ImageCompositePreviewDock, type ImageCompositePreviewEntry } from '@/components/groups/ImageCompositePreviewDock';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { FEATURES } from '@/content/feature-flags';
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
  validateGptImage2CustomImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import { authFetch } from '@/lib/authFetch';
import { readLastKnownUserId } from '@/lib/last-known';
import { readBrowserSession } from '@/lib/supabase-auth-cleanup';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';
import { normalizeJobSurface } from '@/lib/job-surface-normalize';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { countResolvedVisualSlots } from '@/lib/group-progress';
import { ImageLibraryModal } from './_components/ImageLibraryModal';
import { useImageSettingsFields } from './_hooks/useImageSettingsFields';
import { useImageWorkspaceDesktopLayout } from './_hooks/useImageWorkspaceDesktopLayout';
import { useImagePreviewActions } from './_hooks/useImagePreviewActions';
import { useImageReferenceSlots } from './_hooks/useImageReferenceSlots';
import {
  createCharacterReferenceSlot,
  mergeCharacterReferencesIntoSlots,
  parseCharacterReferenceEntry,
} from './_lib/image-workspace-character-references';
import {
  DEFAULT_COPY,
  formatTemplate,
  mergeCopy,
  type ImageWorkspaceCopy,
} from './_lib/image-workspace-copy';
import {
  buildCompletedGroup,
  buildPendingGroup,
  mapJobToHistoryEntry,
} from './_lib/image-workspace-history';
import { parsePersistedImageComposerState } from './_lib/image-workspace-persistence';
import {
  buildCustomImageSize,
  findImageEngine,
} from './_lib/image-workspace-utils';
import {
  IMAGE_COMPOSER_STORAGE_DEBOUNCE_MS,
  IMAGE_COMPOSER_STORAGE_KEY,
  IMAGE_COMPOSER_STORAGE_VERSION,
  MAX_REFERENCE_SLOTS,
  type HistoryEntry,
  type ImageEngineOption,
  type PersistedImageComposerState,
  type ReferenceSlotValue,
  type PricingEstimateResponse,
} from './_lib/image-workspace-types';

export type { ImageEngineOption } from './_lib/image-workspace-types';

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

interface ImageWorkspaceProps {
  engines: ImageEngineOption[];
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
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [selectedPreviewEntryId, setSelectedPreviewEntryId] = useState<string | null>(null);
  const [selectedPreviewImageIndex, setSelectedPreviewImageIndex] = useState(0);
  const [pendingGroups, setPendingGroups] = useState<GroupSummary[]>([]);
  const isDesktopLayout = useImageWorkspaceDesktopLayout();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [
    priceEstimateKey,
    setPriceEstimateKey,
  ] = useState<[string, string, ImageGenerationMode, number, string, string, boolean, string, string, string] | null>(() =>
    engines[0] ? ['image-pricing', engines[0].id, 't2i', 1, '', '', false, '', '', ''] : null
  );

  const engineCapsList = useMemo(() => engines.map((engine) => engine.engineCaps), [engines]);
  const selectedEngine = useMemo(
    () => engines.find((engine) => engine.id === engineId) ?? engines[0],
    [engineId, engines]
  );
  const autoModeFromReferences = Boolean(
    selectedEngine && selectedEngine.modes.includes('t2i') && selectedEngine.modes.includes('i2i')
  );
  const selectedEngineCaps = selectedEngine?.engineCaps ?? engines[0]?.engineCaps;
  const {
    aspectRatioField,
    aspectRatioSelectOptions,
    booleanSelectOptions,
    enableWebSearchField,
    imageCountOptions,
    isResolutionLocked,
    limitGenerationsField,
    maskUrlField,
    outputFormatField,
    outputFormatSelectOptions,
    qualityField,
    qualitySelectOptions,
    resolutionSelectOptions,
    seedField,
    showAspectRatioControl,
    showCustomImageSizeControl,
    showEnableWebSearchControl,
    showLimitGenerationsControl,
    showNumImagesControl,
    showOutputFormatControl,
    showQualityControl,
    showResolutionControl,
    showSeedControl,
    showThinkingLevelControl,
    supportedReferenceFormats,
    supportedReferenceFormatsLabel,
    thinkingLevelField,
    thinkingLevelSelectOptions,
  } = useImageSettingsFields({
    mode,
    resolution,
    resolvedCopy,
    selectedEngineCaps,
    setAspectRatio,
    setCustomImageHeight,
    setCustomImageWidth,
    setEnableWebSearch,
    setLimitGenerations,
    setMaskUrl,
    setNumImages,
    setOutputFormat,
    setQuality,
    setResolution,
    setSeed,
    setThinkingLevel,
  });
  const {
    canCollapseReferenceSlots,
    characterSelectionLimit,
    closeLibraryModal,
    combinedReferenceUrls,
    displayedReferenceSlotCount,
    displayedReferenceSlots,
    handleLibrarySelect,
    handleReferenceFile,
    handleReferenceUrl,
    handleRemoveReferenceSlot,
    hasAnyReferenceSelection,
    libraryModal,
    openCharacterLibrary,
    openLibraryForSlot,
    persistableReferenceSlots,
    readyReferenceSizes,
    readyReferenceUrls,
    referenceHelperText,
    referenceMinRequired,
    referenceSizeSignature,
    referenceSlotLimit,
    referenceToggleLabel,
    selectedCharacterReferences,
    setAreReferenceSlotsExpanded,
    setReferenceSlots,
    supportsCharacterReferences,
    toggleCharacterReference,
  } = useImageReferenceSlots({
    autoModeFromReferences,
    mode,
    resolvedCopy,
    selectedEngineCaps,
    setError,
    supportedReferenceFormats,
    supportedReferenceFormatsLabel,
    toolsEnabled,
  });
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
  }, [engines, setReferenceSlots]);

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
    [engines, setReferenceSlots]
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

  const handleRun = useCallback(
    async (event?: FormEvent<HTMLFormElement> | null) => {
      event?.preventDefault();
      if (!selectedEngine) return;
      if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
        setAuthModalOpen(true);
        return;
      }
      const session = await readBrowserSession();
      if (!session?.access_token) {
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
  const {
    copiedUrl,
    handleAddToLibrary,
    handleCopy,
    handleDownload,
    handleRemoveFromLibrary,
    isInLibrary,
    isRemovingFromLibrary,
    isSavingToLibrary,
  } = useImagePreviewActions({
    canUseWorkspace,
    genericError: resolvedCopy.errors.generic,
    previewEntry,
    removedFromLibraryMessage: t(
      'workspace.image.messages.removedFromLibrary',
      DEFAULT_COPY.messages.removedFromLibrary
    ) as string,
    savedToLibraryMessage: t(
      'workspace.image.messages.savedToLibrary',
      DEFAULT_COPY.messages.savedToLibrary
    ) as string,
    selectedPreviewImageIndex,
    setError,
    setStatusMessage,
  });

  const inProgressMessage = useMemo(() => {
    const count = pendingGroups.length;
    if (count <= 0) return null;
    return formatTemplate(resolvedCopy.messages.generatingInProgress, { count });
  }, [pendingGroups.length, resolvedCopy.messages.generatingInProgress]);
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
          openCharacterLibrary();
        }}
        className="min-h-0 h-7 gap-1.5 rounded-full px-2.5 py-0 text-[11px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
      >
        <Plus className="h-3.5 w-3.5 text-brand" />
        <span>{resolvedCopy.composer.characterButton}</span>
      </Button>
    );
  }, [openCharacterLibrary, resolvedCopy.composer.characterButton, supportsCharacterReferences]);
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
                onAddToLibrary={handleAddToLibrary}
                onRemoveFromLibrary={handleRemoveFromLibrary}
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
        onClose={closeLibraryModal}
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
