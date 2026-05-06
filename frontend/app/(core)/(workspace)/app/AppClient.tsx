'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useEngines, useInfiniteJobs, runPreflight, runGenerate, getJobStatus, saveAssetToLibrary, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EngineCaps, EngineInputField, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { SettingsControls } from '@/components/SettingsControls';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import { EngineSettingsBar } from '@/components/EngineSettingsBar';
import {
  Composer,
  type MultiPromptScene,
} from '@/components/Composer';
import type { KlingElementState, KlingElementAsset, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import type { QuadPreviewTile, QuadTileAction } from '@/components/QuadPreviewPanel';
import type { GalleryFeedState, GalleryRailProps } from '@/components/GalleryRail';
import type { GroupSummary } from '@/types/groups';
import type { CompositePreviewDockProps } from '@/components/groups/CompositePreviewDock';
import dynamic from 'next/dynamic';
import { DEFAULT_PROCESSING_COPY } from '@/components/groups/ProcessingOverlay';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { adaptGroupSummaries, adaptGroupSummary } from '@/lib/video-group-adapter';
import type { VideoGroup } from '@/types/video-groups';
import {
  mapSelectedPreviewToGroup,
  mapSharedVideoToGroup,
  type SelectedVideoPreview,
  type SharedVideoPreview,
} from '@/lib/video-preview-group';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { isExpiredRefundedFailedGalleryItem, isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { supportsAudioPricingToggle } from '@/lib/pricing-addons';
import { readLastKnownUserId } from '@/lib/last-known';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AssetLibraryModalProps } from '@/components/library/AssetLibraryModal';
import {
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
} from '@/lib/luma-ray2';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isPlaceholderMediaUrl } from '@/lib/media';
import {
  getSeedanceAssetState,
  getSeedanceFieldBlockKey,
  getUnifiedSeedanceMode,
  isUnifiedSeedanceEngineId,
  SEEDANCE_REFERENCE_AUDIO_FIELD_IDS,
} from '@/lib/seedance-workflow';
import {
  getUnifiedHappyHorseMode,
  isHappyHorseEngineId,
} from '@/lib/happy-horse-workflow';
import {
  getLocalizedModeLabel,
  getLocalizedWorkflowCopy,
  normalizeUiLocale,
} from '@/lib/ltx-localization';
import { WorkspaceChrome } from './_components/WorkspaceChrome';
import {
  ComposerBootSkeleton,
  CompositePreviewDockSkeleton,
  EngineSettingsBootSkeleton,
  GalleryRailSkeleton,
  WorkspaceBootPreview,
} from './_components/WorkspaceBootSkeletons';
import { getCompositePreviewPosterSrc } from './_lib/composite-preview';
import {
  isAudioWorkspaceRender,
  resolvePolledThumbUrl,
  serializePendingRenders,
  type LocalRender,
} from './_lib/render-persistence';
import {
  normalizeExtraInputValue,
  type FormState,
} from './_lib/workspace-form-state';
import { prepareGenerationInputs } from './_lib/workspace-generation-inputs';
import {
  getGenerationIterationGuardMessage,
  getLumaRay2GenerationContext,
  getStartRenderValidationMessage,
  supportsNegativePromptInput,
} from './_lib/workspace-generation-guards';
import { buildWorkspaceGeneratePayload } from './_lib/workspace-generation-payload';
import { prepareLocalGenerationRender } from './_lib/workspace-local-generation-render';
import {
  buildComposerModeToggles,
  coerceFormState,
  findGenerateAudioField,
  framesToSeconds,
  getComposerWorkflowNotice,
  getEngineModeLabel,
  getEngineModeOptions,
  getModeCaps,
  getPreferredEngineMode,
  matchesEngineToken,
} from './_lib/workspace-engine-helpers';
import {
  buildAssetFieldIdSet,
  buildAssetLibraryCacheKey,
  buildAssetLibraryUrl,
  buildComposerAttachments,
  buildKlingLibraryAsset,
  buildReferenceAudioFieldIds,
  buildReferenceAssetFromLibraryAsset,
  getAssetLibrarySourceForField,
  getPrimaryAssetFieldLabel,
  getReferenceInputStatus,
  getLibraryAssetFieldMismatchMessage,
  hasInputAssetInSlots,
  insertKlingLibraryAsset,
  insertReferenceAsset,
  mergeMirroredLibraryAsset,
  normalizeAssetLibraryPayload,
  PRIMARY_IMAGE_SLOT_IDS,
  PRIMARY_VIDEO_SLOT_IDS,
  removeReferenceAsset,
  revokeAssetPreview,
  revokeKlingAssetPreview,
  shouldMirrorCharacterImageAsset,
  shouldMirrorVideoLibraryAsset,
  type AssetLibraryKind,
  type AssetLibrarySource,
  type AssetPickerTarget,
  type ReferenceAsset,
  type UserAsset,
} from './_lib/workspace-assets';
import {
  DEFAULT_WORKSPACE_COPY,
  mergeCopy,
} from './_lib/workspace-copy';
import {
  DEBOUNCE_MS,
  DEFAULT_PROMPT,
  DESKTOP_RAIL_MIN_WIDTH,
  emitClientMetric,
  isInsufficientFundsError,
  UNIFIED_VEO_FIRST_LAST_ENGINE_IDS,
} from './_lib/workspace-client-helpers';
import {
  buildMultiPromptSummary,
  createKlingElement,
  createLocalId,
  createMultiPromptScene,
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
  normalizeSharedVideoPayload,
} from './_lib/workspace-input-helpers';
import {
  readScopedWorkspaceStorage,
  readWorkspaceStorage,
  STORAGE_KEYS,
  writeScopedWorkspaceStorage,
  writeWorkspaceStorage,
} from './_lib/workspace-storage';
import {
  buildInitialWorkspaceFormState,
  buildPendingRenderHydrationState,
  consumeWorkspaceOnboardingSkipIntent,
  parseStoredMultiPromptScenes,
  readStoredWorkspaceForm,
  resolveWorkspaceRequestParams,
} from './_lib/workspace-hydration';
import {
  buildComposerPromotedActions,
  summarizeWorkspaceInputSchema,
} from './_lib/workspace-input-schema';
import {
  buildPendingGroupSummaries,
  buildPendingSummaryMap,
  buildQuadTileFromGroupMember,
  buildQuadTileFromRender,
  buildRenderGroups,
  clearRemovedGroupId,
  clearSelectedPreviewForRemovedRenders,
  filterLocalRenders,
  getGenerationSkeletonCount,
  hasRemovedRenderRefs,
  haveSameGroupOrder,
  isGenerationGroupLoading,
  pruneBatchHeroes,
} from './_lib/workspace-render-groups';
import {
  applyPolledJobStatusToRender,
  applyPolledJobStatusToSelectedPreview,
  buildRecentJobIdSet,
  getRendersNeedingStatusRefresh,
  mergeRecentJobsIntoLocalRenders,
  shouldRemoveCompletedSyncedRender,
} from './_lib/workspace-render-status';
import {
  createUploadFailure,
  getUploadFailureMessage,
  type UploadableAssetKind,
  type UploadFailure,
} from './_lib/workspace-upload-errors';
import {
  applyVideoJobMediaPatchToCompositeOverride,
  applyVideoJobMediaPatchToSelectedPreview,
  buildRequestedJobPreview,
  buildVideoJobMediaPatch,
  buildVideoSettingsFormState,
  buildVideoSettingsSnapshotFromSharedVideo,
  buildVideoSettingsSnapshotFromTile,
  resolveVideoSettingsSnapshot,
  type VideoJobPayload,
} from './_lib/workspace-video-settings';

const AssetLibraryModal = dynamic<AssetLibraryModalProps>(
  () => import('@/components/library/AssetLibraryModal').then((mod) => mod.AssetLibraryModal),
  { ssr: false }
);

const CompositePreviewDock = dynamic<CompositePreviewDockProps>(
  () => import('@/components/groups/CompositePreviewDock').then((mod) => mod.CompositePreviewDock),
  {
    loading: () => <CompositePreviewDockSkeleton />,
  }
);

const GalleryRail = dynamic<GalleryRailProps>(
  () => import('@/components/GalleryRail').then((mod) => mod.GalleryRail),
  {
    ssr: false,
    loading: () => <GalleryRailSkeleton />,
  }
);

const KlingElementsBuilder = dynamic<KlingElementsBuilderProps>(
  () => import('@/components/KlingElementsBuilder').then((mod) => mod.KlingElementsBuilder),
  { ssr: false }
);

function WorkspaceBootContent({
  initialPreviewGroup,
  initialPreviewPosterSrc,
}: {
  initialPreviewGroup?: VideoGroup | null;
  initialPreviewPosterSrc?: string | null;
}) {
  const posterSrc = getCompositePreviewPosterSrc(initialPreviewGroup ?? null) ?? initialPreviewPosterSrc ?? null;

  return (
    <div className="stack-gap-lg">
      {initialPreviewGroup ? (
        <>
          <CompositePreviewDock
            group={initialPreviewGroup}
            isLoading={false}
            showTitle={false}
            engineSettings={<EngineSettingsBootSkeleton />}
          />
        </>
      ) : (
        <WorkspaceBootPreview posterSrc={posterSrc} />
      )}
      <ComposerBootSkeleton />
    </div>
  );
}

export default function AppClientPage({ initialPreviewGroup = null }: { initialPreviewGroup?: VideoGroup | null }) {
  const { data, error: enginesError, isLoading } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { data: latestJobsPages, mutate: mutateLatestJobs } = useInfiniteJobs(24, { type: 'video' });
  const { user, loading: authLoading, authStatus } = useRequireAuth({ redirectIfLoggedOut: false });
  const engineIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    engines.forEach((engine) => {
      map.set(engine.label.toLowerCase(), engine.id);
    });
    return map;
  }, [engines]);
  const recentJobs = useMemo(
    () => (latestJobsPages?.flatMap((page) => page.jobs ?? []) ?? []).filter((job) => job.surface !== 'audio'),
    [latestJobsPages]
  );
  const provider = useResultProvider();
  const showCenterGallery = CLIENT_ENV.WORKSPACE_CENTER_GALLERY === 'true';
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const workflowCopy = useMemo(() => getLocalizedWorkflowCopy(uiLocale), [uiLocale]);
  const rawWorkspaceCopy = t('workspace.generate', DEFAULT_WORKSPACE_COPY);
  const workspaceCopy = useMemo(
    () =>
      mergeCopy(
        DEFAULT_WORKSPACE_COPY,
        (rawWorkspaceCopy ?? {}) as Partial<typeof DEFAULT_WORKSPACE_COPY>
      ),
    [rawWorkspaceCopy]
  );
  const processingCopy = (t('workspace.generate.processing', DEFAULT_PROCESSING_COPY) ??
    DEFAULT_PROCESSING_COPY) as typeof DEFAULT_PROCESSING_COPY;
  const formatTakeLabel = useCallback(
    (current: number, total: number) => {
      if (total <= 1) return '';
      const template = processingCopy.takeLabel ?? DEFAULT_PROCESSING_COPY.takeLabel;
      if (!template) return '';
      return template.replace('{current}', `${current}`).replace('{total}', `${total}`);
    },
    [processingCopy.takeLabel]
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hydratedForScope, setHydratedForScope] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [multiPromptEnabled, setMultiPromptEnabled] = useState(false);
  const [multiPromptScenes, setMultiPromptScenes] = useState<MultiPromptScene[]>(() => [createMultiPromptScene()]);
  const [shotType, setShotType] = useState<'customize' | 'intelligent'>('customize');
  const [voiceIdsInput, setVoiceIdsInput] = useState<string>('');
  const [klingElements, setKlingElements] = useState<KlingElementState[]>(() => [createKlingElement()]);
  const [cfgScale, setCfgScale] = useState<number | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | undefined>();
  const [isPricing, setPricing] = useState(false);
  const [memberTier, setMemberTier] = useState<'Member' | 'Plus' | 'Pro'>('Member');
  const [notice, setNotice] = useState<string | null>(null);
  const [topUpModal, setTopUpModal] = useState<{
    message: string;
    amountLabel?: string;
    shortfallCents?: number;
  } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

  const storageScope = useMemo(() => userId ?? 'anon', [userId]);
  const readScopedStorage = useCallback(
    (base: string): string | null => {
      return readScopedWorkspaceStorage(base, storageScope);
    },
    [storageScope]
  );
  const readStorage = useCallback(
    (base: string): string | null => {
      return readWorkspaceStorage(base, storageScope);
    },
    [storageScope]
  );
  const writeScopedStorage = useCallback(
    (base: string, value: string | null) => {
      writeScopedWorkspaceStorage(base, storageScope, value);
    },
    [storageScope]
  );
  const writeStorage = useCallback(
    (base: string, value: string | null) => {
      writeWorkspaceStorage(base, storageScope, value);
    },
    [storageScope]
  );
  const workspaceRequest = useMemo(
    () => resolveWorkspaceRequestParams(searchParams, pathname),
    [pathname, searchParams]
  );
  const {
    fromVideoId,
    requestedJobId,
    resolvedRequestedEngineId,
    requestedEngineToken,
    requestedMode,
    searchString,
    loginRedirectTarget,
  } = workspaceRequest;
  const skipOnboardingRef = useRef<boolean>(false);
  const hydratedJobRef = useRef<string | null>(null);
  const preserveStoredDraftRef = useRef<boolean>(false);
  const requestedEngineOverrideIdRef = useRef<string | null>(null);
  const requestedEngineOverrideTokenRef = useRef<string | null>(null);
  const requestedModeOverrideRef = useRef<Mode | null>(null);

  useEffect(() => {
    if (!resolvedRequestedEngineId) return;
    requestedEngineOverrideIdRef.current = resolvedRequestedEngineId;
    requestedEngineOverrideTokenRef.current = requestedEngineToken;
    requestedModeOverrideRef.current = requestedMode;
  }, [resolvedRequestedEngineId, requestedEngineToken, requestedMode]);

  const effectiveRequestedEngineId = resolvedRequestedEngineId ?? requestedEngineOverrideIdRef.current;
  const effectiveRequestedEngineToken = requestedEngineToken ?? requestedEngineOverrideTokenRef.current;
  const effectiveRequestedMode = requestedMode ?? requestedModeOverrideRef.current;

  useEffect(() => {
    const skipIntent = consumeWorkspaceOnboardingSkipIntent(fromVideoId);
    if (skipIntent.shouldSkip) {
      skipOnboardingRef.current = true;
    }
    if (process.env.NODE_ENV !== 'production') {
      if (skipIntent.skippedViaFlag) {
        console.log('[app] skip onboarding via flag');
      }
      if (skipIntent.lastTarget) {
        console.log('[app] read last target', {
          lastTarget: skipIntent.lastTarget,
          shouldSkip: skipIntent.lastTargetShouldSkip,
        });
      }
      if (skipIntent.fromVideoId) {
        console.log('[app] skip onboarding due to fromVideoId', { fromVideoId: skipIntent.fromVideoId });
      }
    }
  }, [fromVideoId]);
  const [renders, setRenders] = useState<LocalRender[]>([]);
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);
  const [sharedVideoSettings, setSharedVideoSettings] = useState<SharedVideoPreview | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<SelectedVideoPreview | null>(null);
  const [guidedSampleFeed, setGuidedSampleFeed] = useState<GalleryFeedState>({ visibleGroups: [], sampleOnly: false });
  const [previewAutoPlayRequestId, setPreviewAutoPlayRequestId] = useState(0);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const [galleryRetentionTick, setGalleryRetentionTick] = useState(0);
  const [viewerTarget, setViewerTarget] = useState<
    { kind: 'pending'; id: string } | { kind: 'summary'; summary: GroupSummary } | { kind: 'group'; group: VideoGroup } | null
  >(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${DESKTOP_RAIL_MIN_WIDTH}px)`).matches;
  });
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const rendersRef = useRef<LocalRender[]>([]);
  const persistedRendersRef = useRef<string | null>(null);
  const pendingPollRef = useRef<number | null>(null);
  const statusErrorCountsRef = useRef<Map<string, { unauthorized: number }>>(new Map());
  const hydratedScopeRef = useRef<string | null>(null);
  const hasStoredFormRef = useRef<boolean>(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      setUserId(user.id);
      setAuthChecked(true);
      return;
    }
    if (authStatus === 'refreshing' || authStatus === 'unknown') {
      const lastKnownUserId = readLastKnownUserId();
      if (lastKnownUserId) {
        setUserId(lastKnownUserId);
      } else {
        setUserId(null);
      }
      setAuthChecked(true);
      return;
    }
    setUserId(null);
    setAuthChecked(true);
  }, [authLoading, authStatus, user?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setGalleryRetentionTick((current) => current + 1);
    }, 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!engines.length) return;
    if (requestedJobId) return;
    if (hydratedScopeRef.current === storageScope) return;
    hydratedScopeRef.current = storageScope;
    setHydratedForScope(null);

    setRenders([]);
    setBatchHeroes({});
    setActiveBatchId(null);
    setActiveGroupId(null);

    try {
      const promptValue = readStorage(STORAGE_KEYS.prompt);
      setPrompt(promptValue ?? DEFAULT_PROMPT);

      const negativeValue = readStorage(STORAGE_KEYS.negativePrompt);
      setNegativePrompt(negativeValue ?? '');

      const storedMultiPromptEnabled = readStorage(STORAGE_KEYS.multiPromptEnabled);
      setMultiPromptEnabled(storedMultiPromptEnabled === 'true');
      setMultiPromptScenes(
        parseStoredMultiPromptScenes(readStorage(STORAGE_KEYS.multiPromptScenes), createLocalId, createMultiPromptScene)
      );

      const storedShotType = readStorage(STORAGE_KEYS.shotType);
      if (storedShotType === 'customize' || storedShotType === 'intelligent') {
        setShotType(storedShotType);
      }
      const storedVoiceIds = readStorage(STORAGE_KEYS.voiceIds);
      if (typeof storedVoiceIds === 'string') {
        setVoiceIdsInput(storedVoiceIds);
      }

      const formValue = readStorage(STORAGE_KEYS.form);
      const initialForm = buildInitialWorkspaceFormState({
        engines,
        storedFormRaw: readStoredWorkspaceForm(storageScope, formValue),
        effectiveRequestedEngineId,
        effectiveRequestedEngineToken,
        effectiveRequestedMode,
      });
      preserveStoredDraftRef.current = initialForm.preserveStoredDraft;
      hasStoredFormRef.current = initialForm.hasStoredForm;
      if (initialForm.form) {
        setForm(initialForm.form);
      }
      if (initialForm.debugEngineOverride && process.env.NODE_ENV !== 'production') {
        console.log('[generate] engine override from storage hydrate', initialForm.debugEngineOverride);
      }
      if (initialForm.formToPersist) {
        const formToPersist = initialForm.formToPersist;
        queueMicrotask(() => {
          try {
            writeStorage(STORAGE_KEYS.form, JSON.stringify(formToPersist));
          } catch {
            // noop
          }
        });
      }

      const storedTier = readStorage(STORAGE_KEYS.memberTier);
      if (storedTier === 'Member' || storedTier === 'Plus' || storedTier === 'Pro') {
        setMemberTier(storedTier);
      }

      const pendingValue = readScopedStorage(STORAGE_KEYS.pendingRenders);
      const pendingHydration = buildPendingRenderHydrationState(pendingValue);
      if (pendingHydration.pendingRenders.length) {
        setRenders(pendingHydration.pendingRenders);
        setBatchHeroes(pendingHydration.batchHeroes);
        setActiveBatchId(pendingHydration.activeBatchId);
        setActiveGroupId(pendingHydration.activeGroupId);
      }
      persistedRendersRef.current = pendingHydration.serialized;
    } catch {
      setRenders([]);
      setBatchHeroes({});
      setActiveBatchId(null);
      setActiveGroupId(null);
    } finally {
      setHydratedForScope(storageScope);
    }
  }, [
    engines,
    readScopedStorage,
    readStorage,
    writeStorage,
    setMemberTier,
    storageScope,
    effectiveRequestedEngineId,
    effectiveRequestedMode,
    effectiveRequestedEngineToken,
    requestedJobId,
  ]);

  useEffect(() => {
    rendersRef.current = renders;
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedScopeRef.current !== storageScope) return;
    const serialized = serializePendingRenders(renders);
    if (serialized === persistedRendersRef.current) return;
    persistedRendersRef.current = serialized;
    writeScopedStorage(STORAGE_KEYS.pendingRenders, serialized);
  }, [renders, storageScope, writeScopedStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jobsNeedingRefresh = getRendersNeedingStatusRefresh(renders);
    if (!jobsNeedingRefresh.length) {
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
      return;
    }
    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        jobsNeedingRefresh.map(async (render) => {
          if (!render.jobId) return;
          try {
            const status = await getJobStatus(render.jobId);
            statusErrorCountsRef.current.delete(render.jobId);
            if (cancelled) return;
            setRenders((prev) =>
              prev.map((item) =>
                item.jobId === render.jobId ? applyPolledJobStatusToRender(item, status) : item
              )
            );
            setSelectedPreview((cur) =>
              applyPolledJobStatusToSelectedPreview(cur, render, status)
            );
          } catch (error) {
            const statusCode = typeof error === 'object' && error ? (error as { status?: unknown }).status : undefined;
            if (statusCode === 404) {
              statusErrorCountsRef.current.delete(render.jobId);
              if (cancelled) return;
              setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
              setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              return;
            }

            if (statusCode === 401) {
              const meta = statusErrorCountsRef.current.get(render.jobId) ?? { unauthorized: 0 };
              meta.unauthorized += 1;
              statusErrorCountsRef.current.set(render.jobId, meta);
              if (meta.unauthorized >= 3) {
                statusErrorCountsRef.current.delete(render.jobId);
                if (cancelled) return;
                setRenders((prev) => prev.filter((item) => item.jobId !== render.jobId));
                setSelectedPreview((cur) => (cur && cur.id === render.jobId ? null : cur));
              }
              return;
            }

            // ignore other transient errors and retry on next tick
          }
        })
      );
    };

    void poll();
    if (pendingPollRef.current !== null) {
      window.clearInterval(pendingPollRef.current);
    }
    pendingPollRef.current = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      if (pendingPollRef.current !== null) {
        window.clearInterval(pendingPollRef.current);
        pendingPollRef.current = null;
      }
    };
  }, [renders, setSelectedPreview]);

  useEffect(() => {
    if (!recentJobs.length) return;
    let heroCandidates: Array<{ batchId: string | null; localKey: string }> = [];

    setRenders((previous) => {
      if (!recentJobs.length) return previous;
      const result = mergeRecentJobsIntoLocalRenders(previous, recentJobs, { engineIdByLabel });
      heroCandidates = result.heroCandidates;
      return result.renders;
    });

    if (heroCandidates.length) {
      setBatchHeroes((previous) => {
        const next = { ...previous };
        let modified = false;
        heroCandidates.forEach(({ batchId, localKey }) => {
          if (!batchId || !localKey) return;
          if (!next[batchId]) {
            next[batchId] = localKey;
            modified = true;
          }
        });
        return modified ? next : previous;
      });
    }
  }, [engineIdByLabel, recentJobs]);

  useEffect(() => {
    const shouldRemove = (render: LocalRender) =>
      isAudioWorkspaceRender({ jobId: render.jobId, engineId: render.engineId });
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }

    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });

    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) =>
      clearSelectedPreviewForRemovedRenders(current, removedRefs, { clearAudioPreview: true })
    );
  }, [renders]);

  useEffect(() => {
    if (!renders.length || !recentJobs.length) return;
    const recentJobIds = buildRecentJobIdSet(recentJobs);
    if (!recentJobIds.size) return;
    const shouldRemove = (render: LocalRender) => shouldRemoveCompletedSyncedRender(render, recentJobIds);
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }
    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });
    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) => clearSelectedPreviewForRemovedRenders(current, removedRefs));
  }, [recentJobs, renders]);

  useEffect(() => {
    if (!renders.length) return;
    const now = Date.now();
    const shouldRemove = (render: LocalRender) => isExpiredRefundedFailedGalleryItem(render, now);
    const removedRefs = filterLocalRenders(renders, shouldRemove);
    if (!hasRemovedRenderRefs(removedRefs)) {
      return;
    }
    setRenders((prev) => {
      if (prev === renders) return removedRefs.renders;
      const nextRemoval = filterLocalRenders(prev, shouldRemove);
      return nextRemoval.changed ? nextRemoval.renders : prev;
    });
    setBatchHeroes((prev) => pruneBatchHeroes(prev, removedRefs.removedGroupIds));
    setActiveBatchId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setActiveGroupId((current) => clearRemovedGroupId(current, removedRefs.removedGroupIds));
    setSelectedPreview((current) => clearSelectedPreviewForRemovedRenders(current, removedRefs));
  }, [renders, galleryRetentionTick]);

  const renderGroups = useMemo(() => buildRenderGroups(renders), [renders]);
  const effectiveBatchId = useMemo(() => activeBatchId ?? selectedPreview?.batchId ?? null, [activeBatchId, selectedPreview?.batchId]);
  useEffect(() => {
    if (!effectiveBatchId) return;
    if (batchHeroes[effectiveBatchId]) return;
    const group = renderGroups.get(effectiveBatchId);
    if (!group || !group.items.length) return;
    setBatchHeroes((prev) => {
      if (prev[effectiveBatchId]) return prev;
      return { ...prev, [effectiveBatchId]: group.items[0].localKey };
    });
  }, [effectiveBatchId, renderGroups, batchHeroes]);
  useEffect(() => {
    const currentIterations = form?.iterations ?? 1;
    if (currentIterations <= 1 && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [form?.iterations, viewMode]);
  const pendingGroups = useMemo(() => buildPendingGroupSummaries(renderGroups, batchHeroes), [renderGroups, batchHeroes]);
  const normalizedPendingGroups = useMemo(() => normalizeGroupSummaries(pendingGroups), [pendingGroups]);
  const pendingSummaryMap = useMemo(() => buildPendingSummaryMap(pendingGroups), [pendingGroups]);
  const activeVideoGroups = useMemo(() => adaptGroupSummaries(pendingGroups, provider), [pendingGroups, provider]);
  const [compositeOverride, setCompositeOverride] = useState<VideoGroup | null>(null);
  const [compositeOverrideSummary, setCompositeOverrideSummary] = useState<GroupSummary | null>(null);
  const isGuidedSamplesActive = guidedSampleFeed.sampleOnly;
  const guidedSampleGroups = guidedSampleFeed.visibleGroups;
  const restoredPreviewJobRef = useRef<string | null>(null);
  const applyVideoSettingsSnapshotRef = useRef<(snapshot: unknown) => void>(() => undefined);
  const activeVideoGroup = useMemo<VideoGroup | null>(() => {
    if (compositeOverride) return null;
    if (!activeVideoGroups.length) return null;
    if (!activeGroupId) return activeVideoGroups[0] ?? null;
    return activeVideoGroups.find((group) => group.id === activeGroupId) ?? activeVideoGroups[0] ?? null;
  }, [activeVideoGroups, activeGroupId, compositeOverride]);
  const compositeGroup = compositeOverride ?? activeVideoGroup ?? null;
  const selectedPreviewGroup = useMemo(() => mapSelectedPreviewToGroup(selectedPreview, provider), [selectedPreview, provider]);
  const initialPreviewFallbackGroup =
    effectiveRequestedEngineId || effectiveRequestedEngineToken || requestedJobId || fromVideoId
      ? null
      : initialPreviewGroup;
  const displayCompositeGroup = compositeGroup ?? selectedPreviewGroup ?? initialPreviewFallbackGroup;
  const compositePreviewPosterSrc = useMemo(() => getCompositePreviewPosterSrc(displayCompositeGroup), [displayCompositeGroup]);

  useEffect(() => {
    if (compositeOverrideSummary) {
      return;
    }
    if (!pendingGroups.length) {
      if (activeGroupId !== null) {
        setActiveGroupId(null);
      }
      return;
    }
    if (!activeGroupId || !pendingGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(pendingGroups[0].id);
    }
  }, [pendingGroups, activeGroupId, compositeOverrideSummary]);

  const isGenerationLoading = useMemo(() => isGenerationGroupLoading(pendingGroups), [pendingGroups]);
  const generationSkeletonCount = useMemo(
    () => getGenerationSkeletonCount(renders, form?.iterations),
    [renders, form?.iterations]
  );
  const viewerGroup = useMemo<VideoGroup | null>(() => {
    if (!viewerTarget) return null;
    if (viewerTarget.kind === 'pending') {
      const summary = pendingSummaryMap.get(viewerTarget.id);
      if (!summary) return null;
      return adaptGroupSummary(normalizeGroupSummary(summary), provider);
    }
    if (viewerTarget.kind === 'group') {
      return viewerTarget.group;
    }
    return adaptGroupSummary(normalizeGroupSummary(viewerTarget.summary), provider);
  }, [viewerTarget, pendingSummaryMap, provider]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (!form) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.form, JSON.stringify({ ...form, updatedAt: Date.now() }));
    } catch {
      // noop
    }
  }, [form, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [prompt, hydratedForScope, storageScope, writeStorage]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [negativePrompt, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptEnabled, multiPromptEnabled ? 'true' : 'false');
    } catch {
      // noop
    }
  }, [multiPromptEnabled, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.multiPromptScenes, JSON.stringify(multiPromptScenes));
    } catch {
      // noop
    }
  }, [multiPromptScenes, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.shotType, shotType);
    } catch {
      // noop
    }
  }, [shotType, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.voiceIds, voiceIdsInput);
    } catch {
      // noop
    }
  }, [voiceIdsInput, hydratedForScope, storageScope, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedForScope !== storageScope) return;
    if (preserveStoredDraftRef.current) return;
    try {
      writeStorage(STORAGE_KEYS.memberTier, memberTier);
    } catch {
      // noop
    }
  }, [memberTier, hydratedForScope, storageScope, writeStorage]);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null);
  const [assetLibrary, setAssetLibrary] = useState<UserAsset[]>([]);
  const [isAssetLibraryLoading, setIsAssetLibraryLoading] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState<string | null>(null);
  const [assetLibrarySource, setAssetLibrarySource] = useState<AssetLibrarySource>('all');
  const [assetLibraryLoadedKey, setAssetLibraryLoadedKey] = useState<string | null>(null);
  const [assetDeletePendingId, setAssetDeletePendingId] = useState<string | null>(null);

  const assetLibraryKind = useMemo<AssetLibraryKind>(() => {
    if (!assetPickerTarget) return 'image';
    if (assetPickerTarget.kind === 'field' && assetPickerTarget.field.type === 'video') {
      return 'video';
    }
    return 'image';
  }, [assetPickerTarget]);
  const assetLibraryRequestKey = assetPickerTarget
    ? buildAssetLibraryCacheKey(assetLibraryKind, assetLibrarySource)
    : null;
  const visibleAssetLibrary = useMemo(
    () => assetLibrary.filter((asset) => asset.kind === assetLibraryKind),
    [assetLibrary, assetLibraryKind]
  );

  const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});
  const klingElementsRef = useRef<KlingElementState[]>([]);

useEffect(() => {
  assetsRef.current = inputAssets;
}, [inputAssets]);

useEffect(() => {
  return () => {
    Object.values(assetsRef.current).forEach((entries) => {
      entries.forEach((asset) => {
        revokeAssetPreview(asset);
      });
    });
  };
}, []);

useEffect(() => {
  klingElementsRef.current = klingElements;
}, [klingElements]);

useEffect(() => {
  return () => {
    klingElementsRef.current.forEach((element) => {
      revokeKlingAssetPreview(element.frontal);
      element.references.forEach((asset) => revokeKlingAssetPreview(asset));
      revokeKlingAssetPreview(element.video);
    });
  };
}, []);

const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 6000);
  }, []);

  const showComposerError = useCallback((message: string) => {
    setPreflightError(message);
  }, []);

  const fetchAssetLibrary = useCallback(async (options?: { source?: AssetLibrarySource; kind?: AssetLibraryKind }) => {
    const source = options?.source ?? assetLibrarySource;
    const kind = options?.kind ?? assetLibraryKind;
    const requestKey = buildAssetLibraryCacheKey(kind, source);
    setIsAssetLibraryLoading(true);
    setAssetLibraryError(null);
    try {
      const assetResponse = await authFetch(buildAssetLibraryUrl(kind, source));
      if (assetResponse.status === 401) {
        setAssetLibrary([]);
        setAssetLibraryError(
          kind === 'video' ? 'Sign in to access your video library.' : 'Sign in to access your image library.'
        );
        setAssetLibraryLoadedKey(requestKey);
        return;
      }
      const payload = await assetResponse.json().catch(() => null);
      if (!assetResponse.ok || !payload?.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : kind === 'video'
              ? 'Failed to load videos'
              : 'Failed to load images';
        throw new Error(message);
      }
      setAssetLibrary(normalizeAssetLibraryPayload(payload, source, kind));
      setAssetLibraryLoadedKey(requestKey);
    } catch (error) {
      console.error('[assets] failed to load library', error);
      setAssetLibraryError(
        error instanceof Error
          ? error.message
          : kind === 'video'
            ? 'Failed to load videos'
            : 'Failed to load images'
      );
      setAssetLibraryLoadedKey(requestKey);
    } finally {
      setIsAssetLibraryLoading(false);
    }
  }, [assetLibraryKind, assetLibrarySource]);

  useEffect(() => {
    if (!assetPickerTarget || !assetLibraryRequestKey || isAssetLibraryLoading) return;
    if (assetLibraryLoadedKey === assetLibraryRequestKey) return;
    setAssetLibrary([]);
    setAssetLibraryError(null);
    void fetchAssetLibrary({ kind: assetLibraryKind, source: assetLibrarySource });
  }, [
    assetLibraryKind,
    assetLibraryLoadedKey,
    assetLibraryRequestKey,
    assetLibrarySource,
    assetPickerTarget,
    fetchAssetLibrary,
    isAssetLibraryLoading,
  ]);

  const handleDeleteLibraryAsset = useCallback(
    async (asset: UserAsset) => {
      if (!asset?.id) return;
      setAssetDeletePendingId(asset.id);
      try {
        const response = await authFetch('/api/user-assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: asset.id }),
        });
        const payload = await response.json().catch(() => null);
        const success = response.ok && Boolean(payload?.ok);
        const notFound = response.status === 404 || payload?.error === 'NOT_FOUND';
        if (!success && !notFound) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to delete image';
          throw new Error(message);
        }

        setAssetLibrary((previous) => previous.filter((entry) => entry.id !== asset.id));
        setInputAssets((previous) => {
          let changed = false;
          const next: typeof previous = {};
          for (const [fieldId, entries] of Object.entries(previous)) {
            let fieldChanged = false;
            const updated = entries.map((entry) => {
              if (entry && entry.assetId === asset.id) {
                fieldChanged = true;
                changed = true;
                if (entry.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(entry.previewUrl);
                }
                return null;
              }
              return entry;
            });
            next[fieldId] = fieldChanged ? updated : entries;
          }
          return changed ? next : previous;
        });
      } catch (error) {
        console.error('[assets] failed to delete asset', error);
        showNotice(error instanceof Error ? error.message : 'Failed to delete image');
        throw error;
      } finally {
        setAssetDeletePendingId(null);
      }
    },
    [showNotice]
  );

const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'Provider reported this render as failed.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('The provider is still processing this render.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
}, []);

  const closeTopUpModal = useCallback(() => {
    setTopUpModal(null);
    setTopUpAmount(1000);
    setTopUpError(null);
  }, []);
  const getSeedanceFieldBlockedMessage = useCallback(
    (field: EngineInputField) => {
      if (!isUnifiedSeedanceEngineId(form?.engineId)) return null;
      const fieldHasOwnAssets = (inputAssets[field.id] ?? []).some((asset) => asset !== null);
      const blockKey = getSeedanceFieldBlockKey(field.id, inputAssets, fieldHasOwnAssets);
      if (blockKey === 'clearReferences') {
        return workflowCopy.clearReferencesToUseStartEnd;
      }
      if (blockKey === 'clearStartEnd') {
        return workflowCopy.clearStartEndToUseReferences;
      }
      return null;
    },
    [form?.engineId, inputAssets, workflowCopy.clearReferencesToUseStartEnd, workflowCopy.clearStartEndToUseReferences]
  );

  const handleOpenAssetLibrary = useCallback(
    (field: EngineInputField, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const nextSource = getAssetLibrarySourceForField(field);
      if (nextSource !== assetLibrarySource) {
        setAssetLibrarySource(nextSource);
        setAssetLibrary([]);
        setAssetLibraryError(null);
        setAssetLibraryLoadedKey(null);
      }
      setAssetPickerTarget({ kind: 'field', field, slotIndex });
    },
    [assetLibrarySource, getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleOpenKlingAssetLibrary = useCallback(
    (elementId: string, slot: 'frontal' | 'reference', slotIndex?: number) => {
      if (assetLibrarySource !== 'all') {
        setAssetLibrarySource('all');
        setAssetLibrary([]);
        setAssetLibraryError(null);
        setAssetLibraryLoadedKey(null);
      }
      setAssetPickerTarget({ kind: 'kling', elementId, slot, slotIndex });
    },
    [assetLibrarySource]
  );

  const handleSelectLibraryAsset = useCallback(
    async (field: EngineInputField, asset: UserAsset, slotIndex?: number) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const mismatchMessage = getLibraryAssetFieldMismatchMessage(field, asset);
      if (mismatchMessage) {
        showNotice(mismatchMessage);
        return;
      }

      let resolvedAsset = asset;

      if (field.type === 'video' && asset.kind === 'video') {
        try {
          if (shouldMirrorVideoLibraryAsset(asset)) {
            const mirrored = await saveAssetToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Video',
              source: asset.source === 'recent' ? 'saved_job_output' : asset.source,
              kind: 'video',
              jobId: asset.jobId ?? null,
              sourceOutputId: asset.sourceOutputId ?? null,
            });
            resolvedAsset = mergeMirroredLibraryAsset(asset, mirrored);
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror generated video asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this video. Try importing the source clip directly.');
          return;
        }
      }

      if (field.type === 'image' && asset.kind === 'image') {
        try {
          if (shouldMirrorCharacterImageAsset(asset)) {
            const mirrored = await saveImageToLibrary({
              url: asset.url,
              label:
                field.label ??
                asset.url.split('/').pop() ??
                'Image',
              source: asset.source,
            });
            resolvedAsset = mergeMirroredLibraryAsset(asset, mirrored);
            setAssetLibrary((previous) =>
              previous.map((entry) =>
                entry.id === asset.id || entry.url === asset.url ? resolvedAsset : entry
              )
            );
          }
        } catch (error) {
          console.error('[assets] failed to mirror character library asset', error);
          showNotice(error instanceof Error ? error.message : 'Unable to prepare this character asset. Try another image.');
          return;
        }
      }

      const newAsset = buildReferenceAssetFromLibraryAsset(field, resolvedAsset);

      setInputAssets((previous) => {
        return insertReferenceAsset(previous, field, newAsset, slotIndex, {
          release: revokeAssetPreview,
          onMaxReached: () => showNotice(`Maximum ${field.label ?? 'reference image'} count reached for this engine.`),
        });
      });

      setAssetPickerTarget(null);
    },
    [getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleSelectKlingLibraryAsset = useCallback(
    (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => {
      const newAsset = buildKlingLibraryAsset(asset);
      setKlingElements((previous) =>
        insertKlingLibraryAsset(previous, target, newAsset, revokeKlingAssetPreview)
      );

      setAssetPickerTarget(null);
    },
    []
  );

  const handleAssetAdd = useCallback(
    (field: EngineInputField, file: File, slotIndex?: number, meta?: { durationSec?: number }) => {
      const blockedMessage = getSeedanceFieldBlockedMessage(field);
      if (blockedMessage) {
        showNotice(blockedMessage);
        return;
      }
      const assetId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: ReferenceAsset = {
        id: assetId,
        fieldId: field.id,
        previewUrl,
        kind: field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image',
        name: file.name,
        size: file.size,
        type: file.type,
        durationSec: typeof meta?.durationSec === 'number' ? meta.durationSec : null,
        status: 'uploading' as const,
      };

      setInputAssets((previous) => {
        return insertReferenceAsset(previous, field, baseAsset, slotIndex, {
          release: revokeAssetPreview,
          onMaxReached: () => revokeAssetPreview(baseAsset),
        });
      });

      const upload = async () => {
        try {
          const preparedFile =
            field.type === 'image'
              ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
              : file;
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint =
            field.type === 'video'
              ? '/api/uploads/video'
              : field.type === 'audio'
                ? '/api/uploads/audio'
                : '/api/uploads/image';
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(uploadAssetType, response.status, payload, 'Upload failed');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            width?: number | null;
            height?: number | null;
            size?: number;
            mime?: string;
            name?: string;
          };
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'ready' as const,
                url: assetResponse.url,
                width: assetResponse.width ?? entry.width,
                height: assetResponse.height ?? entry.height,
                size: assetResponse.size ?? entry.size,
                type: assetResponse.mime ?? entry.type,
                assetId: assetResponse.id,
              };
            });
            return { ...previous, [field.id]: next };
          });
        } catch (error) {
          const uploadAssetType: UploadableAssetKind =
            field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image';
          const message = getUploadFailureMessage(uploadAssetType, error, 'Upload failed');
          const uploadError = error as UploadFailure;
          console.error(
            '[assets] upload failed',
            {
              fieldId: field.id,
              assetType: uploadAssetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error
          );
          setInputAssets((previous) => {
            const current = previous[field.id];
            if (!current) return previous;
            const next = current.map((entry) => {
              if (!entry || entry.id !== assetId) return entry;
              return {
                ...entry,
                status: 'error' as const,
                error: message,
              };
            });
            return { ...previous, [field.id]: next };
          });
          showNotice?.(message);
        }
      };

      void upload();
    },
    [getSeedanceFieldBlockedMessage, showNotice]
  );

  const handleAssetRemove = useCallback((field: EngineInputField, index: number) => {
    setInputAssets((previous) => {
      return removeReferenceAsset(previous, field, index, revokeAssetPreview);
    });
  }, []);

  const handleMultiPromptAddScene = useCallback(() => {
    setMultiPromptScenes((previous) => [...previous, createMultiPromptScene()]);
  }, []);

  const handleMultiPromptRemoveScene = useCallback((id: string) => {
    setMultiPromptScenes((previous) => {
      const next = previous.filter((scene) => scene.id !== id);
      return next.length ? next : [createMultiPromptScene()];
    });
  }, []);

  const handleMultiPromptUpdateScene = useCallback(
    (id: string, patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>) => {
      setMultiPromptScenes((previous) =>
        previous.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene))
      );
    },
    []
  );

  const handleSeedChange = useCallback((value: string) => {
    setForm((current) => {
      if (!current) return current;
      const trimmed = value.trim();
      if (!trimmed) {
        return { ...current, seed: null };
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return current;
      return { ...current, seed: Math.trunc(parsed) };
    });
  }, []);

  const handleCameraFixedChange = useCallback((value: boolean) => {
    setForm((current) => (current ? { ...current, cameraFixed: value } : current));
  }, []);

  const handleSafetyCheckerChange = useCallback((value: boolean) => {
    setForm((current) => (current ? { ...current, safetyChecker: value } : current));
  }, []);

  const handleKlingElementAdd = useCallback(() => {
    setKlingElements((previous) => [...previous, createKlingElement()]);
  }, []);

  const handleKlingElementRemove = useCallback((id: string) => {
    setKlingElements((previous) => {
      const next = previous.filter((element) => element.id !== id);
      return next.length ? next : [createKlingElement()];
    });
  }, []);

  const handleKlingElementAssetRemove = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => {
      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: null };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: null };
          }
          const references = [...element.references];
          if (typeof index === 'number' && index >= 0 && index < references.length) {
            revokeKlingAssetPreview(references[index]);
            references[index] = null;
          }
          return { ...element, references };
        })
      );
    },
    []
  );

  const handleKlingElementAssetAdd = useCallback(
    (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => {
      const assetId = createLocalId('element_asset');
      const previewUrl = URL.createObjectURL(file);
      const baseAsset: KlingElementAsset = {
        id: assetId,
        previewUrl,
        name: file.name,
        kind: slot === 'video' ? 'video' : 'image',
        status: 'uploading' as const,
        url: undefined as string | undefined,
      };

      setKlingElements((previous) =>
        previous.map((element) => {
          if (element.id !== elementId) return element;
          if (slot === 'frontal') {
            revokeKlingAssetPreview(element.frontal);
            return { ...element, frontal: baseAsset };
          }
          if (slot === 'video') {
            revokeKlingAssetPreview(element.video);
            return { ...element, video: baseAsset };
          }
          const references = [...element.references];
          let targetIndex = typeof index === 'number' ? index : references.findIndex((entry) => entry === null);
          if (targetIndex < 0) {
            targetIndex = references.length;
          }
          if (targetIndex >= references.length) {
            return element;
          }
          revokeKlingAssetPreview(references[targetIndex]);
          references[targetIndex] = baseAsset;
          return { ...element, references };
        })
      );

      const upload = async () => {
        try {
          const preparedFile =
            slot === 'video'
              ? file
              : await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 });
          const formData = new FormData();
          formData.append('file', preparedFile, preparedFile.name);
          const uploadEndpoint = slot === 'video' ? '/api/uploads/video' : '/api/uploads/image';
          const response = await authFetch(uploadEndpoint, {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) {
            throw createUploadFailure(slot === 'video' ? 'video' : 'image', response.status, payload, 'Upload failed');
          }
          const assetResponse = payload.asset as {
            id: string;
            url: string;
            name?: string;
          };
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const updateAsset = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                if (asset.previewUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(asset.previewUrl);
                }
                return {
                  ...asset,
                  status: 'ready' as const,
                  url: assetResponse.url,
                  previewUrl: assetResponse.url || asset.previewUrl,
                  name: assetResponse.name ?? asset.name,
                };
              };
              if (slot === 'frontal') {
                return { ...element, frontal: updateAsset(element.frontal) };
              }
              if (slot === 'video') {
                return { ...element, video: updateAsset(element.video) };
              }
              const references = element.references.map((asset) => updateAsset(asset));
              return { ...element, references };
            })
          );
        } catch (error) {
          const assetType = slot === 'video' ? 'video' : 'image';
          const message = getUploadFailureMessage(assetType, error, 'Upload failed.');
          const uploadError = error as UploadFailure;
          console.error(
            '[kling-assets] upload failed',
            {
              elementId,
              slot,
              assetType,
              status: uploadError?.status ?? null,
              code: uploadError?.code ?? null,
              maxMB: uploadError?.maxMB ?? null,
              message,
            },
            error
          );
          setKlingElements((previous) =>
            previous.map((element) => {
              if (element.id !== elementId) return element;
              const markError = (asset: typeof baseAsset | null) => {
                if (!asset || asset.id !== assetId) return asset;
                return { ...asset, status: 'error' as const, error: message };
              };
              if (slot === 'frontal') return { ...element, frontal: markError(element.frontal) };
              if (slot === 'video') return { ...element, video: markError(element.video) };
              const references = element.references.map((asset) => markError(asset));
              return { ...element, references };
            })
          );
          showNotice?.(message);
        }
      };

      void upload();
    },
    [showNotice]
  );

  const handleSelectPresetAmount = useCallback((value: number) => {
    setTopUpAmount(value);
  }, []);

  const handleCustomAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setTopUpAmount(1000);
      return;
    }
    setTopUpAmount(Math.max(1000, Math.round(value * 100)));
  }, []);

  const handleConfirmTopUp = useCallback(async () => {
    if (!topUpModal) return;
    const amountCents = Math.max(1000, topUpAmount);
    setIsTopUpLoading(true);
    setTopUpError(null);
    try {
      const res = await authFetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'Wallet top-up failed');
      }
      if (json?.url) {
        window.location.href = json.url as string;
        return;
      }
      closeTopUpModal();
      showNotice('Top-up initiated. Complete the payment to update your balance.');
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : 'Failed to start top-up');
    } finally {
      setIsTopUpLoading(false);
    }
  }, [topUpAmount, topUpModal, closeTopUpModal, showNotice]);

  const handleTopUpSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleConfirmTopUp();
    },
    [handleConfirmTopUp]
  );

  useEffect(() => {
    if (!authChecked) return undefined;
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch('/api/member-status');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          const tier = (json?.tier ?? 'Member') as 'Member' | 'Plus' | 'Pro';
          setMemberTier(tier);
        }
      } catch {
        // noop
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked || skipOnboardingRef.current) return undefined;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] onboarding check running', { skip: skipOnboardingRef.current });
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/user/exports/summary');
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok) return;
        if (cancelled) return;
        if ((json.total ?? 0) === 0 && json.onboardingDone !== true) {
          const params: Record<string, string> = { tab: 'starter', first: '1' };
          const search = new URLSearchParams(params).toString();
          router.replace(`/gallery?${search}`);
          await authFetch('/api/user/preferences', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ onboardingDone: true }),
          }).catch(() => undefined);
        }
      } catch (error) {
        console.warn('[app] onboarding redirect failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, router]);

  useEffect(() => {
    if (!fromVideoId) return undefined;
    let cancelled = false;
    (async () => {
      let shouldStripParam = false;
      try {
        const res = await authFetch(`/api/videos/${encodeURIComponent(fromVideoId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok || !json.video || cancelled) return;
        const video = normalizeSharedVideoPayload(json.video as SharedVideoPreview);
        const overrideGroup = mapSharedVideoToGroup(video, provider);
        setCompositeOverride(overrideGroup);
        setCompositeOverrideSummary(null);
        setSharedPrompt(video.prompt ?? video.promptExcerpt ?? null);
        setSharedVideoSettings(video);
        setSelectedPreview({
          id: video.id,
          videoUrl: video.videoUrl ?? undefined,
          previewVideoUrl: video.previewVideoUrl ?? undefined,
          thumbUrl: video.thumbUrl ?? undefined,
          aspectRatio: video.aspectRatio ?? undefined,
          prompt: video.prompt ?? video.promptExcerpt ?? undefined,
        });
        shouldStripParam = true;
      } catch (error) {
        console.warn('[app] failed to load shared video', error);
      } finally {
        if (cancelled) return;
        if (shouldStripParam && searchString.includes('from=')) {
          const params = new URLSearchParams(searchString);
          params.delete('from');
          const next = params.toString();
          router.replace(next ? `/app?${next}` : '/app');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromVideoId, provider, router, searchString]);

  useEffect(() => {
    if (!compositeOverride) {
      setSharedPrompt(null);
      setSharedVideoSettings(null);
    }
  }, [compositeOverride]);

  useEffect(() => {
    if (!topUpModal) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopUpModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topUpModal, closeTopUpModal]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPreview || renders.length > 0) return;
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
    if (hasStoredFormRef.current) return;
    const storedPreviewJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (storedPreviewJobId.startsWith('job_')) return;
    const latestJobWithMedia = recentJobs.find((job) => job.thumbUrl || job.videoUrl);
    if (!latestJobWithMedia) return;
    setSelectedPreview({
      id: latestJobWithMedia.jobId,
      videoUrl: latestJobWithMedia.videoUrl ?? undefined,
      previewVideoUrl: latestJobWithMedia.previewVideoUrl ?? undefined,
      aspectRatio: latestJobWithMedia.aspectRatio ?? undefined,
      thumbUrl: latestJobWithMedia.thumbUrl ?? undefined,
      priceCents: latestJobWithMedia.finalPriceCents ?? latestJobWithMedia.pricingSnapshot?.totalCents,
      currency: latestJobWithMedia.currency ?? latestJobWithMedia.pricingSnapshot?.currency,
      prompt: latestJobWithMedia.prompt ?? undefined,
    });
  }, [effectiveRequestedEngineId, effectiveRequestedEngineToken, readScopedStorage, recentJobs, renders.length, selectedPreview]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authChecked) return;
    if (!engines.length) return;
    if (hydratedForScope !== storageScope) return;
    if (effectiveRequestedEngineId || effectiveRequestedEngineToken) return;
    if (requestedJobId) return;
    if (fromVideoId) return;
    if (renders.length > 0) return;
    if (compositeOverride) return;
    if (compositeOverrideSummary) return;

    const storedJobId = (readScopedStorage(STORAGE_KEYS.previewJobId) ?? '').trim();
    if (!storedJobId.startsWith('job_')) return;
    if (restoredPreviewJobRef.current === storedJobId) return;
    restoredPreviewJobRef.current = storedJobId;

    void authFetch(`/api/jobs/${encodeURIComponent(storedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              status?: string;
              progress?: number;
              videoUrl?: string;
              previewVideoUrl?: string;
              thumbUrl?: string;
              aspectRatio?: string;
              finalPriceCents?: number;
              currency?: string;
              pricing?: { totalCents?: number; currency?: string } | null;
              settingsSnapshot?: unknown;
              createdAt?: string;
            }
          | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }

        const snapshot = payload.settingsSnapshot as
          | {
              schemaVersion?: unknown;
              surface?: unknown;
              engineId?: unknown;
              engineLabel?: unknown;
              prompt?: unknown;
              core?: unknown;
            }
          | null
          | undefined;
        if (snapshot?.schemaVersion !== 1 || snapshot?.surface !== 'video') {
          throw new Error('Invalid settings snapshot for preview');
        }

        applyVideoSettingsSnapshotRef.current(snapshot);

        const core = snapshot.core && typeof snapshot.core === 'object' ? (snapshot.core as Record<string, unknown>) : {};
        const durationSec = typeof core.durationSec === 'number' && Number.isFinite(core.durationSec) ? core.durationSec : undefined;
        const engineId = typeof snapshot.engineId === 'string' ? snapshot.engineId : 'unknown-engine';
        const engineLabel = typeof snapshot.engineLabel === 'string' ? snapshot.engineLabel : engineId;
        const promptValue = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
        const thumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : undefined;
        const videoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : undefined;
        const previewVideoUrl =
          typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length
            ? payload.previewVideoUrl
            : undefined;
        const url = videoUrl ?? thumbUrl;
        if (!url) {
          throw new Error('Job has no preview media');
        }
        const createdAt =
          typeof payload.createdAt === 'string' && payload.createdAt.length ? payload.createdAt : new Date().toISOString();

        setCompositeOverride(
          mapSharedVideoToGroup(
            {
              id: storedJobId,
              engineId,
              engineLabel,
              durationSec: durationSec ?? 0,
              prompt: promptValue,
              thumbUrl,
              videoUrl,
              previewVideoUrl,
              aspectRatio: payload.aspectRatio ?? undefined,
              createdAt,
            },
            provider
          )
        );
        setCompositeOverrideSummary(null);
        setSelectedPreview({
          id: storedJobId,
          videoUrl,
          previewVideoUrl,
          thumbUrl,
          aspectRatio: payload.aspectRatio ?? undefined,
          progress: typeof payload.progress === 'number' ? payload.progress : undefined,
          status:
            payload.status === 'failed' ? 'failed' : payload.status === 'completed' ? 'completed' : ('pending' as const),
          priceCents: payload.finalPriceCents ?? payload.pricing?.totalCents ?? undefined,
          currency: payload.currency ?? payload.pricing?.currency ?? undefined,
          prompt: promptValue,
        });
      })
      .catch(() => {
        // ignore preview restore failures
      });
  }, [
    authChecked,
    engines.length,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    compositeOverride,
    compositeOverrideSummary,
    fromVideoId,
    hydratedForScope,
    readScopedStorage,
    renders.length,
    requestedJobId,
    storageScope,
    provider,
  ]);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
  }, []);

  const engineOverride = useMemo<EngineCaps | null>(() => {
    if (!effectiveRequestedEngineToken) return null;
    if (!engines.length) return null;
    if (hasStoredFormRef.current) return null;
    return (
      engines.find((engine) => matchesEngineToken(engine, effectiveRequestedEngineToken)) ?? null
    );
  }, [engines, effectiveRequestedEngineToken]);

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    if (!engines.length) return null;
    if (engineOverride) return engineOverride;
    if (form && engines.some((engine) => engine.id === form.engineId)) {
      return engines.find((engine) => engine.id === form.engineId) ?? engines[0];
    }
    return engines[0];
  }, [engines, form, engineOverride]);

  const supportsKlingV3Controls =
    selectedEngine?.id === 'kling-3-pro' ||
    selectedEngine?.id === 'kling-3-standard' ||
    selectedEngine?.id === 'kling-3-4k';
  const supportsKlingV3VoiceControl =
    selectedEngine?.id === 'kling-3-pro' || selectedEngine?.id === 'kling-3-standard';
  const isSeedance = selectedEngine?.id === 'seedance-1-5-pro';
  const isUnifiedSeedance = isUnifiedSeedanceEngineId(selectedEngine?.id);
  const isUnifiedHappyHorse = isHappyHorseEngineId(selectedEngine?.id);
  const multiPromptTotalSec = useMemo(
    () => multiPromptScenes.reduce((sum, scene) => sum + (scene.duration || 0), 0),
    [multiPromptScenes]
  );
  const multiPromptActive = Boolean(supportsKlingV3Controls && multiPromptEnabled);
  const multiPromptInvalid = multiPromptActive
    ? multiPromptScenes.length === 0 ||
      multiPromptScenes.some((scene) => !scene.prompt.trim()) ||
      multiPromptTotalSec < MULTI_PROMPT_MIN_SEC ||
      multiPromptTotalSec > MULTI_PROMPT_MAX_SEC
    : false;
  const voiceIds = useMemo(
    () =>
      voiceIdsInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [voiceIdsInput]
  );
  const voiceControlEnabled = Boolean(supportsKlingV3VoiceControl && voiceIds.length);
  const promptMaxChars = !multiPromptActive ? (selectedEngine?.inputLimits.promptMaxChars ?? null) : null;
  const promptCharLimitExceeded = typeof promptMaxChars === 'number' && prompt.length > promptMaxChars;
  const seedValue =
    typeof form?.seed === 'number' && Number.isFinite(form.seed) ? String(form.seed) : '';
  const cameraFixedValue = typeof form?.cameraFixed === 'boolean' ? form.cameraFixed : false;
  const safetyCheckerValue = typeof form?.safetyChecker === 'boolean' ? form.safetyChecker : true;
  const effectivePrompt = multiPromptActive ? buildMultiPromptSummary(multiPromptScenes) : prompt;
  const primaryAudioDurationSec = useMemo(() => {
    for (const entries of Object.values(inputAssets)) {
      for (const asset of entries) {
        if (asset?.kind === 'audio' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);
  const primaryVideoDurationSec = useMemo(() => {
    for (const fieldId of PRIMARY_VIDEO_SLOT_IDS) {
      const entries = inputAssets[fieldId] ?? [];
      for (const asset of entries) {
        if (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec)) {
          return Math.max(1, Math.round(asset.durationSec));
        }
      }
    }
    return null;
  }, [inputAssets]);
  const multiPromptError = multiPromptInvalid
    ? `Multi-prompt requires a prompt per scene and total duration between ${MULTI_PROMPT_MIN_SEC}s and ${MULTI_PROMPT_MAX_SEC}s.`
    : null;

  useEffect(() => {
    if (!supportsKlingV3Controls && multiPromptEnabled) {
      setMultiPromptEnabled(false);
    }
  }, [supportsKlingV3Controls, multiPromptEnabled]);

  useEffect(() => {
    if (form?.engineId === 'pika-image-to-video') {
      setForm((current) => {
        if (!current || current.engineId !== 'pika-image-to-video') return current;
        return { ...current, engineId: 'pika-text-to-video' };
      });
    }
  }, [form?.engineId, setForm]);

  const engineModeOptions = useMemo(() => getEngineModeOptions(selectedEngine), [selectedEngine]);

  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    engines.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [engines]);

  const applyVideoSettingsSnapshot = useCallback(
    (snapshot: unknown) => {
      try {
        const resolved = resolveVideoSettingsSnapshot(snapshot, {
          engines,
          engineMap,
          createLocalId,
          createFallbackScene: createMultiPromptScene,
          createFallbackKlingElement: createKlingElement,
        });
        setPrompt(resolved.prompt);
        setNegativePrompt(resolved.negativePrompt);
        if (resolved.memberTier) {
          setMemberTier(resolved.memberTier);
        }
        if (resolved.cfgScale !== null) {
          setCfgScale(resolved.cfgScale);
        }
        if (resolved.shotType) {
          setShotType(resolved.shotType);
        }
        setVoiceIdsInput(resolved.voiceIdsInput);
        setMultiPromptEnabled(resolved.multiPrompt.enabled);
        setMultiPromptScenes(resolved.multiPrompt.scenes);
        setForm((current) => buildVideoSettingsFormState(resolved, current ?? null));

        const nextInputAssets = resolved.inputAssets;
        if (nextInputAssets) {
          setInputAssets((previous) => {
            Object.values(previous).forEach((entries) => {
              entries.forEach((asset) => revokeAssetPreview(asset));
            });
            return nextInputAssets;
          });
        }

        const nextKlingElements = resolved.klingElements;
        if (nextKlingElements) {
          setKlingElements((previous) => {
            previous.forEach((element) => {
              revokeKlingAssetPreview(element.frontal);
              element.references.forEach((asset) => revokeKlingAssetPreview(asset));
              revokeKlingAssetPreview(element.video);
            });
            return nextKlingElements;
          });
        }

        queueMicrotask(() => {
          focusComposer();
        });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Failed to apply settings.');
      }
    },
    [engineMap, engines, focusComposer]
  );

  useEffect(() => {
    applyVideoSettingsSnapshotRef.current = applyVideoSettingsSnapshot;
  }, [applyVideoSettingsSnapshot]);

  const hydrateVideoSettingsFromJob = useCallback(
    async (jobId: string | null | undefined) => {
      if (!jobId) return;
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (!response.ok) {
          if (response.status === 404) return;
          return;
        }
        const payload = (await response.json().catch(() => null)) as VideoJobPayload | null;
        if (!payload?.ok) return;
        if (payload.settingsSnapshot) {
          applyVideoSettingsSnapshot(payload.settingsSnapshot);
        }

        const mediaPatch = buildVideoJobMediaPatch(payload);
        if (!mediaPatch) return;

        setSelectedPreview((current) => applyVideoJobMediaPatchToSelectedPreview(current, jobId, mediaPatch));
        setCompositeOverride((current) => applyVideoJobMediaPatchToCompositeOverride(current, jobId, mediaPatch));
      } catch {
        // ignore best-effort recalls from gallery
      }
    },
    [applyVideoSettingsSnapshot]
  );

  const applyVideoSettingsFromTile = useCallback(
    (tile: QuadPreviewTile) => {
      try {
        applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromTile(tile));
      } catch {
        // ignore
      }
    },
    [applyVideoSettingsSnapshot]
  );

  useEffect(() => {
    if (!sharedVideoSettings) return;
    applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromSharedVideo(sharedVideoSettings));
    void hydrateVideoSettingsFromJob(sharedVideoSettings.id);
  }, [applyVideoSettingsSnapshot, hydrateVideoSettingsFromJob, sharedVideoSettings]);

  useEffect(() => {
    if (!requestedJobId) return;
    if (!engines.length) return;
    if (hydratedJobRef.current === requestedJobId) return;
    hydratedJobRef.current = requestedJobId;
    setNotice(null);
    void authFetch(`/api/jobs/${encodeURIComponent(requestedJobId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as VideoJobPayload | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `Failed to load job (${response.status})`);
        }
        applyVideoSettingsSnapshot(payload.settingsSnapshot);

        try {
          if (requestedJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, requestedJobId);
          }
        } catch {
          // ignore storage failures
        }

        const requestedPreview = buildRequestedJobPreview(requestedJobId, payload);
        if (requestedPreview) {
          setCompositeOverride(mapSharedVideoToGroup(requestedPreview.sharedVideo, provider));
          setCompositeOverrideSummary(null);
          setSelectedPreview(requestedPreview.selectedPreview);
        }
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : 'Failed to load job settings.');
      });
  }, [applyVideoSettingsSnapshot, engines.length, provider, requestedJobId, writeScopedStorage]);

  const referenceInputStatus = useMemo(() => getReferenceInputStatus(inputAssets), [inputAssets]);
  const seedanceAssetState = useMemo(() => getSeedanceAssetState(inputAssets), [inputAssets]);
  const hasPrimaryImageInput = useMemo(
    () => hasInputAssetInSlots(inputAssets, PRIMARY_IMAGE_SLOT_IDS, 'image'),
    [inputAssets]
  );
  const hasLastFrameInput = useMemo(
    () => hasInputAssetInSlots(inputAssets, ['last_frame_url'], 'image'),
    [inputAssets]
  );

  const implicitMode = useMemo<Mode>(() => {
    if (!selectedEngine) return form?.mode ?? 't2v';
    if (isUnifiedSeedance) {
      return getUnifiedSeedanceMode(inputAssets);
    }
    if (isUnifiedHappyHorse && (form?.mode === 't2v' || !form?.mode)) {
      return getUnifiedHappyHorseMode(inputAssets);
    }
    const modes = selectedEngine.modes;
    if (referenceInputStatus.hasAudio && modes.includes('a2v')) return 'a2v';
    if (referenceInputStatus.hasVideo && modes.includes('v2v')) return 'v2v';
    if (referenceInputStatus.hasVideo && modes.includes('r2v')) return 'r2v';
    if (referenceInputStatus.hasVideo && modes.includes('reframe')) return 'reframe';
    if (referenceInputStatus.hasImage && modes.includes('i2v')) return 'i2v';
    if (modes.includes('t2v')) return 't2v';
    return modes[0] ?? 't2v';
  }, [form?.mode, inputAssets, isUnifiedHappyHorse, isUnifiedSeedance, referenceInputStatus.hasAudio, referenceInputStatus.hasImage, referenceInputStatus.hasVideo, selectedEngine]);

  const audioToVideoSupported = Boolean(selectedEngine?.modes.includes('a2v'));
  const audioWorkflowLocked = referenceInputStatus.hasAudio && audioToVideoSupported;
  const audioWorkflowUnsupported =
    referenceInputStatus.hasAudio &&
    Boolean(selectedEngine) &&
    !audioToVideoSupported &&
    !(isUnifiedSeedance && seedanceAssetState.hasReferenceAudio);

  const activeManualMode = useMemo<Mode | null>(() => {
    if (!selectedEngine) return null;
    if (isUnifiedSeedance) return null;
    if (referenceInputStatus.hasAudio && !isUnifiedSeedance) return null;
    const currentMode = form?.mode ?? null;
    if (
      (currentMode === 'v2v' ||
        currentMode === 'reframe' ||
        currentMode === 'ref2v' ||
        currentMode === 'extend' ||
        currentMode === 'retake') &&
        selectedEngine.modes.includes(currentMode)
    ) {
      return currentMode;
    }
    return null;
  }, [form?.mode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine]);

  const activeMode: Mode = activeManualMode ?? implicitMode;
  const allowsUnifiedVeoFirstLast = useMemo(() => {
    return Boolean(
      selectedEngine &&
        UNIFIED_VEO_FIRST_LAST_ENGINE_IDS.has(selectedEngine.id) &&
        activeManualMode === null &&
        (activeMode === 't2v' || activeMode === 'i2v')
    );
  }, [activeManualMode, activeMode, selectedEngine]);
  const submissionMode = useMemo<Mode>(() => {
    if (allowsUnifiedVeoFirstLast && hasPrimaryImageInput && hasLastFrameInput) {
      return 'fl2v';
    }
    return activeMode;
  }, [activeMode, allowsUnifiedVeoFirstLast, hasLastFrameInput, hasPrimaryImageInput]);
  const showSafetyCheckerControl = useMemo(() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) return false;
    return [...(schema.required ?? []), ...(schema.optional ?? [])].some((field) => {
      if (field.id !== 'enable_safety_checker') return false;
      return !field.modes || field.modes.includes(submissionMode);
    });
  }, [selectedEngine, submissionMode]);
  const effectiveDurationSec = useMemo(() => {
    if (multiPromptActive) return multiPromptTotalSec;
    if (submissionMode === 'a2v' && typeof primaryAudioDurationSec === 'number') return primaryAudioDurationSec;
    if ((submissionMode === 'v2v' || submissionMode === 'reframe') && typeof primaryVideoDurationSec === 'number') {
      return primaryVideoDurationSec;
    }
    return form?.durationSec ?? 0;
  }, [multiPromptActive, multiPromptTotalSec, submissionMode, primaryAudioDurationSec, primaryVideoDurationSec, form?.durationSec]);

  useEffect(() => {
    if (!selectedEngine || !form) return;
    if (activeManualMode) return;
    if (form.mode === implicitMode) return;
    setForm((current) => {
      if (!current || current.mode === implicitMode) return current;
      return coerceFormState(selectedEngine, implicitMode, { ...current, mode: implicitMode });
    });
  }, [activeManualMode, form, implicitMode, selectedEngine, setForm]);

  useEffect(() => {
    if (!supportsKlingV3Controls) return;
    if (activeMode !== 'i2v') return;
    if (shotType !== 'customize') {
      setShotType('customize');
    }
  }, [activeMode, supportsKlingV3Controls, shotType]);

  const capability = useMemo(() => {
    if (!selectedEngine) return undefined;
    return getModeCaps(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const generateAudioField = useMemo(() => {
    if (!selectedEngine) return null;
    return findGenerateAudioField(selectedEngine, submissionMode);
  }, [selectedEngine, submissionMode]);

  const supportsAudioToggle =
    Boolean(selectedEngine && capability?.audioToggle && generateAudioField && supportsAudioPricingToggle(selectedEngine));

  useEffect(() => {
    if (!voiceControlEnabled) return;
    setForm((current) => {
      if (!current || current.audio) return current;
      return { ...current, audio: true };
    });
  }, [voiceControlEnabled]);

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      requestedEngineOverrideIdRef.current = null;
      requestedEngineOverrideTokenRef.current = null;
      requestedModeOverrideRef.current = null;
      preserveStoredDraftRef.current = false;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = getPreferredEngineMode(nextEngine, candidate?.mode ?? null);
        const normalizedPrevious = candidate ? { ...candidate, engineId: nextEngine.id, mode: nextMode } : null;
        return coerceFormState(nextEngine, nextMode, normalizedPrevious);
      });
    },
    [engines]
  );

  useEffect(() => {
    if (!engineOverride) return;
    if (hasStoredFormRef.current) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (candidate?.engineId === engineOverride.id) return candidate;
      const preferredMode = getPreferredEngineMode(engineOverride, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, engineId: engineOverride.id, mode: preferredMode } : null;
      const nextState = coerceFormState(engineOverride, preferredMode, normalizedPrevious);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[generate] engine override applied', {
          previous: candidate?.engineId,
          next: nextState.engineId,
        });
      }
      queueMicrotask(() => {
        try {
          writeStorage(STORAGE_KEYS.form, JSON.stringify(nextState));
        } catch {
          // noop
        }
      });
      return nextState;
    });
  }, [engineOverride, writeStorage]);

  useEffect(() => {
    const pinnedToken = requestedEngineOverrideTokenRef.current;
    if (!pinnedToken) return;
    if (!authChecked) return;
    if (hydratedForScope !== storageScope) return;
    if (!selectedEngine) return;
    if (matchesEngineToken(selectedEngine, pinnedToken)) return;
    const pinnedEngine = engines.find((engine) => matchesEngineToken(engine, pinnedToken));
    if (!pinnedEngine) return;
    setForm((current) => {
      const candidate = current ?? null;
      const nextMode = getPreferredEngineMode(pinnedEngine, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, engineId: pinnedEngine.id, mode: nextMode } : null;
      return coerceFormState(pinnedEngine, nextMode, normalizedPrevious);
    });
  }, [authChecked, hydratedForScope, storageScope, selectedEngine, engines]);

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      const nextMode = getPreferredEngineMode(selectedEngine, mode);
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine]
  );

  const composerModeToggles = useMemo(
    () =>
      buildComposerModeToggles({
        selectedEngine,
        audioWorkflowLocked,
        uiLocale,
        workflowCopy,
      }),
    [audioWorkflowLocked, selectedEngine, uiLocale, workflowCopy]
  );

  const showRetakeWorkflowAction = Boolean(selectedEngine?.id === 'ltx-2-3' && selectedEngine.modes.includes('retake'));

  const composerWorkflowNotice = useMemo(
    () =>
      getComposerWorkflowNotice({
        selectedEngine,
        hasAudioInput: referenceInputStatus.hasAudio,
        audioWorkflowUnsupported,
        workflowCopy,
      }),
    [audioWorkflowUnsupported, referenceInputStatus.hasAudio, selectedEngine, workflowCopy]
  );

  const handleComposerModeToggle = useCallback(
    (mode: Mode | null) => {
      if (!selectedEngine) return;
      if (
        referenceInputStatus.hasAudio &&
        !isUnifiedSeedance &&
        (mode === 'v2v' || mode === 'reframe' || mode === 'extend' || mode === 'retake')
      ) {
        showNotice(workflowCopy.removeAudioToUseEdit);
        return;
      }
      const nextMode = mode ?? implicitMode;
      setForm((current) =>
        coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null)
      );
    },
    [implicitMode, isUnifiedSeedance, referenceInputStatus.hasAudio, selectedEngine, showNotice, workflowCopy]
  );

  const handleDurationChange = useCallback(
    (raw: number | string) => {
      if (multiPromptActive) return;
      setForm((current) => {
        if (!current) return current;
        const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
        const durationSec = Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : current.durationSec;
        return {
          ...current,
          durationSec,
          durationOption: raw,
          numFrames: null,
        };
      });
    },
    [multiPromptActive]
  );

  const handleFramesChange = useCallback((value: number) => {
    setForm((current) => {
      if (!current) return current;
      const safeFrames = Math.max(1, Math.round(value));
      return {
        ...current,
        numFrames: safeFrames,
        durationSec: framesToSeconds(safeFrames),
        durationOption: safeFrames,
      };
    });
  }, []);

  const handleResolutionChange = useCallback(
    (resolution: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed = capability?.resolution && capability.resolution.length ? capability.resolution : selectedEngine.resolutions;
        if (allowed.length && !allowed.includes(resolution)) {
          const fallback = allowed.includes(current.resolution) ? current.resolution : allowed[0];
          return fallback === current.resolution ? current : { ...current, resolution: fallback };
        }
        if (current.resolution === resolution) return current;
        return { ...current, resolution };
      });
    },
    [capability, selectedEngine]
  );

  const handleAspectRatioChange = useCallback(
    (ratio: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed =
          capability?.aspectRatio && capability.aspectRatio.length
            ? capability.aspectRatio
            : capability
              ? []
              : selectedEngine.aspectRatios;
        if (allowed.length && !allowed.includes(ratio)) {
          const fallback = allowed.includes(current.aspectRatio) ? current.aspectRatio : allowed[0];
          return fallback === current.aspectRatio ? current : { ...current, aspectRatio: fallback };
        }
        if (current.aspectRatio === ratio) return current;
        return { ...current, aspectRatio: ratio };
      });
    },
    [capability, selectedEngine]
  );

  const handleFpsChange = useCallback((fps: number) => {
    setForm((current) => {
      if (!current) return current;
      if (current.fps === fps) return current;
      return { ...current, fps };
    });
  }, []);

  const inputSchemaSummary = useMemo(
    () =>
      summarizeWorkspaceInputSchema({
        selectedEngine,
        activeMode,
        allowsUnifiedVeoFirstLast,
        isUnifiedHappyHorse,
        isUnifiedSeedance,
        uiLocale,
      }),
    [activeMode, allowsUnifiedVeoFirstLast, isUnifiedHappyHorse, isUnifiedSeedance, selectedEngine, uiLocale]
  );

  const extraInputFields = useMemo(
    () => [...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields],
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );

  useEffect(() => {
    setForm((current) => {
      if (!current) return current;
      const allowedFieldIds = new Set(extraInputFields.map(({ field }) => field.id));
      const nextExtraInputValues = Object.entries(current.extraInputValues).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (allowedFieldIds.has(key)) {
          acc[key] = value;
        }
        return acc;
      }, {});
      if (JSON.stringify(nextExtraInputValues) === JSON.stringify(current.extraInputValues)) {
        return current;
      }
      return { ...current, extraInputValues: nextExtraInputValues };
    });
  }, [extraInputFields]);

  useEffect(() => {
    setInputAssets((previous) => {
      if (!inputSchemaSummary.assetFields.length) {
        if (Object.keys(previous).length === 0) return previous;
        Object.values(previous).forEach((entries) => {
          entries.forEach((asset) => revokeAssetPreview(asset));
        });
        return {};
      }
      const allowed = new Set(inputSchemaSummary.assetFields.map((entry) => entry.field.id));
      let changed = false;
      const next: Record<string, (ReferenceAsset | null)[]> = {};
      Object.entries(previous).forEach(([fieldId, items]) => {
        if (allowed.has(fieldId)) {
          next[fieldId] = items;
        } else {
          changed = true;
          items.forEach((asset) => revokeAssetPreview(asset));
        }
      });
      return changed ? next : previous;
    });
  }, [inputSchemaSummary.assetFields]);

  const primaryAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'primary'),
    [inputSchemaSummary.assetFields]
  );

  const referenceAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'reference'),
    [inputSchemaSummary.assetFields]
  );

  const genericImageFieldIds = useMemo(
    () => buildAssetFieldIdSet(
      inputSchemaSummary.assetFields,
      (entry) => entry.role === 'generic' && entry.field.type === 'image'
    ),
    [inputSchemaSummary.assetFields]
  );

  const frameAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'frame'),
    [inputSchemaSummary.assetFields]
  );
  const referenceAudioFieldIds = useMemo(
    () => buildReferenceAudioFieldIds(inputSchemaSummary.assetFields, SEEDANCE_REFERENCE_AUDIO_FIELD_IDS),
    [inputSchemaSummary.assetFields]
  );

  const primaryAssetFieldLabel = useMemo(
    () => getPrimaryAssetFieldLabel(inputSchemaSummary.assetFields),
    [inputSchemaSummary.assetFields]
  );
  const guestUploadLockedReason = !authChecked || (!authLoading && !user?.id) ? workspaceCopy.authGate.uploadLocked : null;
  const composerAssetFields = useMemo(() => {
    return inputSchemaSummary.assetFields.map((entry) => {
      const fieldHasOwnAssets = (inputAssets[entry.field.id] ?? []).some((asset) => asset !== null);
      const blockKey = isUnifiedSeedance
        ? getSeedanceFieldBlockKey(entry.field.id, inputAssets, fieldHasOwnAssets)
        : null;
      const workflowDisabledReason =
        blockKey === 'clearReferences'
          ? workflowCopy.clearReferencesToUseStartEnd
          : blockKey === 'clearStartEnd'
            ? workflowCopy.clearStartEndToUseReferences
            : null;
      const disabledReason = workflowDisabledReason ?? guestUploadLockedReason;
      return {
        ...entry,
        disabled: Boolean(disabledReason),
        disabledReason,
      };
    });
  }, [
    guestUploadLockedReason,
    inputAssets,
    inputSchemaSummary.assetFields,
    isUnifiedSeedance,
    workflowCopy.clearReferencesToUseStartEnd,
    workflowCopy.clearStartEndToUseReferences,
  ]);

  useEffect(() => {
    if (!selectedEngine) {
      if (cfgScale !== null) {
        setCfgScale(null);
      }
      return;
    }
    const cfgParam = selectedEngine.params?.cfg_scale;
    if (cfgParam) {
      if (cfgScale === null) {
        setCfgScale(cfgParam.default ?? null);
      }
    } else {
      if (cfgScale !== null) {
        setCfgScale(null);
      }
    }
  }, [cfgScale, selectedEngine, form?.mode]);

  const composerAssets = useMemo(() => buildComposerAttachments(inputAssets), [inputAssets]);
  const handleExtraInputValueChange = useCallback((field: EngineInputField, value: unknown) => {
    setForm((current) => {
      if (!current) return current;
      const normalized = normalizeExtraInputValue(field, value);
      const next = { ...current.extraInputValues };
      if (normalized === undefined) {
        delete next[field.id];
      } else {
        next[field.id] = normalized;
      }
      return { ...current, extraInputValues: next };
    });
  }, []);

  const composerPromotedActions = useMemo(
    () =>
      buildComposerPromotedActions({
        form,
        promotedFields: inputSchemaSummary.promotedFields,
        uiLocale,
        onToggle: handleExtraInputValueChange,
      }),
    [form, handleExtraInputValueChange, inputSchemaSummary.promotedFields, uiLocale]
  );

  const startRender = useCallback(async () => {
    if (!form || !selectedEngine) return;
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    setPreflightError(undefined);
    const trimmedPrompt = effectivePrompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = supportsNegativePromptInput(inputSchemaSummary);
    const lumaContext = getLumaRay2GenerationContext({
      selectedEngineId: selectedEngine.id,
      submissionMode,
      form,
    });
    const validationMessage = getStartRenderValidationMessage({
      audioWorkflowUnsupported,
      audioUnsupportedMessage: workflowCopy.audioUnsupported,
      multiPromptActive,
      multiPromptInvalid,
      multiPromptError,
      promptLength: prompt.length,
      promptCharLimitExceeded,
      promptMaxChars,
      selectedEngineLabel: selectedEngine.label,
      trimmedPrompt,
      trimmedNegativePrompt,
      inputSchemaSummary,
      inputAssets,
      extraInputFields,
      form,
      lumaContext,
    });
    if (validationMessage) {
      showComposerError(validationMessage);
      return;
    }

    const iterationCount = Math.max(1, form.iterations ?? 1);
    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (iterationCount > 1) {
      const totalCents = typeof preflight?.pricing?.totalCents === 'number' ? preflight.pricing.totalCents * iterationCount : undefined;
      emitClientMetric('group_render_initiated', {
        batchId,
        iterations: iterationCount,
        engine: selectedEngine.id,
        total_cents: totalCents ?? null,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      });
    }

    const paymentMode: 'wallet' | 'platform' = token ? 'wallet' : 'platform';
    const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

    const presentInsufficientFunds = (shortfallCents?: number) => {
      const normalizedShortfall = typeof shortfallCents === 'number' ? Math.max(0, shortfallCents) : undefined;

      let friendlyNotice: string = workspaceCopy.wallet.insufficient;
      let formattedShortfall: string | undefined;
      if (typeof normalizedShortfall === 'number' && normalizedShortfall > 0) {
        try {
          formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
            style: 'currency',
            currency: currencyCode,
          }).format(normalizedShortfall / 100);
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        } catch {
          formattedShortfall = `${currencyCode} ${(normalizedShortfall / 100).toFixed(2)}`;
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        }
      }

      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      showComposerError(friendlyNotice);
    };

    if (paymentMode === 'wallet') {
      const unitCostCents =
        typeof preflight?.pricing?.totalCents === 'number'
          ? preflight.pricing.totalCents
          : typeof preflight?.total === 'number'
            ? preflight.total
            : null;
      if (typeof unitCostCents === 'number' && unitCostCents > 0) {
        const requiredCents = unitCostCents * iterationCount;
        try {
          const res = await authFetch('/api/wallet');
          if (res.ok) {
            const walletJson = await res.json();
            const balanceCents =
              typeof walletJson.balanceCents === 'number'
                ? walletJson.balanceCents
                : typeof walletJson.balance === 'number'
                  ? Math.round(walletJson.balance * 100)
                  : typeof walletJson.balance === 'string'
                    ? Math.round(Number(walletJson.balance) * 100)
                  : undefined;
            if (typeof balanceCents === 'number') {
              const shortfall = requiredCents - balanceCents;
              if (shortfall > 0) {
                presentInsufficientFunds(shortfall);
                return;
              }
            }
          }
        } catch (walletError) {
          console.warn('[startRender] wallet balance check failed', walletError);
        }
      }
    }

    const generationInputs = prepareGenerationInputs({
      selectedEngineId: selectedEngine.id,
      activeMode,
      submissionMode,
      form,
      inputSchema: selectedEngine.inputSchema,
      inputSchemaSummary,
      extraInputFields,
      inputAssets,
      primaryAssetFieldIds,
      referenceAssetFieldIds,
      genericImageFieldIds,
      frameAssetFieldIds,
      referenceAudioFieldIds,
      supportsKlingV3Controls,
      klingElements,
      multiPromptActive,
      multiPromptScenes,
    });
    if (!generationInputs.ok) {
      showComposerError(generationInputs.message);
      return;
    }

    const {
      inputsPayload,
      primaryAttachment,
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
      primaryImageUrl,
      primaryAudioUrl,
      endImageUrl,
      extraInputValues,
      klingElementsPayload,
      multiPromptPayload,
    } = generationInputs;

    const runIteration = async (iterationIndex: number) => {
      const guardMessage = getGenerationIterationGuardMessage({
        selectedEngineId: selectedEngine.id,
        submissionMode,
        allowsUnifiedVeoFirstLast,
        hasLastFrameInput,
        isUnifiedSeedance,
        primaryImageUrl,
        primaryAudioUrl,
        primaryAssetFieldLabel,
        referenceImageUrls,
        referenceVideoUrls,
        referenceAudioUrls,
        inputsPayload,
        primaryAttachment,
        addReferenceMediaBeforeAudioMessage: workflowCopy.addReferenceMediaBeforeAudio,
        extendOrRetakeSourceVideoMessage: workflowCopy.addSourceVideo(getLocalizedModeLabel(submissionMode, uiLocale)),
      });
      if (guardMessage) {
        showComposerError(guardMessage);
        return;
      }

      const localRender = prepareLocalGenerationRender({
        batchId,
        iterationIndex,
        iterationCount,
        selectedEngine,
        form,
        effectiveDurationSec,
        effectivePrompt,
        preflight,
        formatTakeLabel,
      });
      const {
        localKey,
        id,
        thumb,
        etaSeconds,
        etaLabel,
        friendlyMessage,
        startedAt,
        minDurationMs,
        minReadyAt,
        initialRender,
        selectedPreview: initialSelectedPreview,
      } = localRender;

      let progressMessage = friendlyMessage;
      const totalMs = minDurationMs;
      let progressInterval: number | null = null;
      let progressTimeout: number | null = null;

      const stopProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) {
          window.clearInterval(progressInterval);
          progressInterval = null;
        }
        if (progressTimeout !== null) {
          window.clearTimeout(progressTimeout);
          progressTimeout = null;
        }
      };

      const startProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) return;
        progressInterval = window.setInterval(() => {
          const now = Date.now();
          const elapsed = now - startedAt;
          const pct = Math.min(95, Math.round((elapsed / totalMs) * 100));
          setRenders((prev) =>
            prev.map((r) =>
              r.localKey === localKey && !r.videoUrl
                ? {
                    ...r,
                    progress: pct < 5 ? 5 : pct,
                    message: progressMessage,
                  }
                : r
            )
          );
          setSelectedPreview((cur) =>
            cur && cur.localKey === localKey && !cur.videoUrl
              ? { ...cur, progress: pct < 5 ? 5 : pct, message: progressMessage }
              : cur
          );
        }, 400);
        const timeoutMs = Math.max(totalMs * 1.5, totalMs + 15000);
        progressTimeout = window.setTimeout(() => {
          stopProgressTracking();
        }, timeoutMs);
      };

      setRenders((prev) => [initialRender, ...prev]);
      setBatchHeroes((prev) => {
        if (prev[batchId]) return prev;
        return { ...prev, [batchId]: localKey };
      });
      setActiveBatchId(batchId);
      setActiveGroupId(batchId);
      if (iterationCount > 1) {
        setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
      }
      setSelectedPreview(initialSelectedPreview);

      startProgressTracking();

      try {
        const { payload: generatePayload, resolvedDurationSeconds } = buildWorkspaceGeneratePayload({
          selectedEngineId: selectedEngine.id,
          activeMode,
          submissionMode,
          form,
          trimmedPrompt,
          trimmedNegativePrompt,
          effectiveDurationSec,
          memberTier,
          paymentMode,
          cfgScale,
          capability,
          supportsNegativePrompt,
          supportsAudioToggle,
          isSeedance,
          supportsKlingV3Controls,
          supportsKlingV3VoiceControl,
          voiceIds,
          voiceControlEnabled,
          shotType,
          localKey,
          batchId,
          iterationIndex,
          iterationCount,
          friendlyMessage,
          etaSeconds,
          etaLabel,
          lumaContext,
          inputsPayload,
          primaryImageUrl,
          primaryAudioUrl,
          referenceImageUrls,
          endImageUrl,
          extraInputValues,
          multiPromptPayload,
          klingElementsPayload,
        });

        emitClientMetric('generation_started', {
          local_key: localKey,
          batch_id: batchId,
          group_id: batchId,
          iteration_index: iterationIndex,
          iteration_count: iterationCount,
          batch_size: iterationCount,
          engine: selectedEngine.id,
          mode: submissionMode,
          duration_sec: resolvedDurationSeconds,
          payment_mode: paymentMode,
          has_audio: Boolean(form.audio),
        });

        const res = await runGenerate(generatePayload, token ? { token } : undefined);

        const resolvedJobId = res.jobId ?? id;
        const resolvedBatchId = res.batchId ?? batchId;
        const resolvedGroupId = res.groupId ?? batchId;
        const resolvedIterationIndex = res.iterationIndex ?? iterationIndex;
        const resolvedIterationCount = res.iterationCount ?? iterationCount;
        const resolvedThumb = res.thumbUrl ?? thumb;
        const resolvedPriceCents =
          res.pricing?.totalCents ?? preflight?.pricing?.totalCents ?? undefined;
        const resolvedCurrency =
          res.pricing?.currency ?? preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';
        const resolvedEtaSeconds =
          typeof res.etaSeconds === 'number' ? res.etaSeconds : etaSeconds;
        const resolvedEtaLabel = res.etaLabel ?? etaLabel;
        const resolvedMessage = res.message ?? friendlyMessage;
        const resolvedStatus =
          res.status ?? (res.videoUrl ? 'completed' : 'pending');
        const resolvedProgress =
          typeof res.progress === 'number' ? res.progress : res.videoUrl ? 100 : 5;
        const resolvedPricingSnapshot = res.pricing ?? preflight?.pricing;
        const resolvedPaymentStatus = res.paymentStatus ?? 'pending_payment';
        const resolvedRenderIds = res.renderIds ?? undefined;
        const resolvedHeroRenderId = res.heroRenderId ?? null;
        const resolvedVideoUrl = res.videoUrl ?? undefined;

        try {
          if (resolvedJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, resolvedJobId);
          }
        } catch {
          // ignore storage failures
        }

        const now = Date.now();
        const gatingActive = Boolean(resolvedVideoUrl) && now < minReadyAt;
        const clampedProgress = resolvedProgress < 5 ? 5 : resolvedProgress;
        const gatedProgress = gatingActive ? Math.min(clampedProgress, 95) : clampedProgress;

        setRenders((prev) =>
          prev.map((render) =>
            render.localKey === localKey
              ? (() => {
                  const nextFailedAt =
                    resolvedStatus === 'failed' && isRefundedPaymentStatus(resolvedPaymentStatus)
                      ? render.failedAt ?? now
                      : undefined;
                  return {
                  ...render,
                  id: resolvedJobId,
                  jobId: resolvedJobId,
                  batchId: resolvedBatchId,
                  groupId: resolvedGroupId,
                  iterationIndex: resolvedIterationIndex,
                  iterationCount: resolvedIterationCount,
                  thumbUrl: resolvedThumb,
                  message: resolvedMessage,
                  progress: gatedProgress,
                  status: gatingActive ? 'pending' : resolvedStatus,
                  priceCents: resolvedPriceCents,
                  currency: resolvedCurrency,
                  pricingSnapshot: resolvedPricingSnapshot,
                  paymentStatus: resolvedPaymentStatus,
                  failedAt: nextFailedAt,
                  etaSeconds: resolvedEtaSeconds,
                  etaLabel: resolvedEtaLabel,
                  renderIds: resolvedRenderIds,
                  heroRenderId: resolvedHeroRenderId,
                  readyVideoUrl: resolvedVideoUrl ?? render.readyVideoUrl,
                  videoUrl: gatingActive ? render.videoUrl : resolvedVideoUrl ?? render.videoUrl,
                  previewVideoUrl: render.previewVideoUrl,
                  };
                })()
              : render
          )
        );
        progressMessage = resolvedMessage;
        setSelectedPreview((cur) =>
          cur && cur.localKey === localKey
            ? {
                ...cur,
                id: resolvedJobId,
                batchId: resolvedBatchId,
                iterationIndex: resolvedIterationIndex,
                iterationCount: resolvedIterationCount,
                thumbUrl: resolvedThumb,
                progress: gatedProgress,
                message: resolvedMessage,
                priceCents: resolvedPriceCents,
                currency: resolvedCurrency,
                etaSeconds: resolvedEtaSeconds,
                etaLabel: resolvedEtaLabel,
                videoUrl: gatingActive ? cur.videoUrl : resolvedVideoUrl ?? cur.videoUrl,
                previewVideoUrl: cur.previewVideoUrl,
                status: gatingActive ? 'pending' : resolvedStatus,
              }
            : cur
        );

        if (resolvedIterationCount > 1) {
          setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
        }
        setActiveBatchId(resolvedBatchId);
        setActiveGroupId(resolvedBatchId ?? batchId ?? id);
        setBatchHeroes((prev) => {
          if (prev[resolvedBatchId]) return prev;
          return { ...prev, [resolvedBatchId]: localKey };
        });

        if (resolvedVideoUrl || resolvedStatus === 'completed') {
          stopProgressTracking();
        }

        if (typeof window !== 'undefined') {
          const detail = {
            ok: true,
            jobId: resolvedJobId,
            status: resolvedStatus ?? 'pending',
            progress: resolvedProgress,
            videoUrl: resolvedVideoUrl ?? null,
            thumbUrl: resolvedThumb ?? null,
            aspectRatio: form.aspectRatio ?? null,
            pricing: resolvedPricingSnapshot,
            finalPriceCents: resolvedPriceCents ?? null,
            currency: resolvedCurrency,
            paymentStatus: resolvedPaymentStatus ?? 'platform',
            batchId: resolvedBatchId ?? null,
            groupId: resolvedGroupId ?? null,
            iterationIndex: resolvedIterationIndex ?? null,
            iterationCount: resolvedIterationCount ?? null,
            renderIds: resolvedRenderIds ?? null,
            heroRenderId: resolvedHeroRenderId ?? null,
            localKey,
            message: resolvedMessage ?? null,
            etaSeconds: resolvedEtaSeconds ?? null,
            etaLabel: resolvedEtaLabel ?? null,
          };
          window.dispatchEvent(new CustomEvent('jobs:status', { detail }));
        }

        void mutateLatestJobs(undefined, { revalidate: true });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('wallet:invalidate'));
        }

        const jobId = resolvedJobId;
        const poll = async () => {
          try {
            const status = await getJobStatus(jobId);
            if (status.message) {
              progressMessage = status.message;
            }
            const target = rendersRef.current.find((r) => r.id === jobId);
            const now = Date.now();
            const minReadyAtCurrent = target?.minReadyAt ?? 0;
            const isCompleted = status.status === 'completed' || Boolean(status.videoUrl);
            if (isCompleted && target && now < minReadyAtCurrent) {
              window.setTimeout(poll, Math.max(500, minReadyAtCurrent - now));
              return;
            }
            const hasVideo = Boolean(status.videoUrl);
            const hasThumb = Boolean(status.thumbUrl && !isPlaceholderMediaUrl(status.thumbUrl));
            setRenders((prev) =>
              prev.map((r) =>
                r.id === jobId
                  ? (() => {
                      const nextStatus = status.status ?? r.status;
                      const nextPaymentStatus = status.paymentStatus ?? r.paymentStatus;
                      const nextFailedAt =
                        nextStatus === 'failed' && isRefundedPaymentStatus(nextPaymentStatus)
                          ? r.failedAt ?? now
                          : undefined;
                      return {
                      ...r,
                      status: nextStatus,
                      progress: status.progress ?? r.progress,
                      readyVideoUrl: status.videoUrl ?? r.readyVideoUrl,
                      videoUrl: status.videoUrl ?? r.videoUrl ?? r.readyVideoUrl,
                      previewVideoUrl: status.previewVideoUrl ?? r.previewVideoUrl,
                      thumbUrl: resolvePolledThumbUrl(r.thumbUrl, status.thumbUrl),
                      priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? r.priceCents,
                      currency: status.currency ?? status.pricing?.currency ?? r.currency,
                      pricingSnapshot: status.pricing ?? r.pricingSnapshot,
                      paymentStatus: nextPaymentStatus,
                      failedAt: nextFailedAt,
                    };
                  })()
                  : r
              )
            );
            setSelectedPreview((cur) =>
              cur && (cur.id === jobId || cur.localKey === localKey)
                ? {
                    ...cur,
                    status: status.status ?? cur.status,
                    id: jobId,
                    localKey,
                    progress: status.progress ?? cur.progress,
                    videoUrl: status.videoUrl ?? target?.readyVideoUrl ?? cur.videoUrl,
                    previewVideoUrl: status.previewVideoUrl ?? cur.previewVideoUrl,
                    thumbUrl: resolvePolledThumbUrl(cur.thumbUrl, status.thumbUrl),
                    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? cur.priceCents,
                    currency: status.currency ?? status.pricing?.currency ?? cur.currency,
                    etaLabel: cur.etaLabel,
                    etaSeconds: cur.etaSeconds,
                  }
                : cur
            );
            const shouldKeepPolling =
              status.status !== 'failed' &&
              (status.status !== 'completed' || !hasVideo || !hasThumb);
            if (shouldKeepPolling) {
              const delay = status.status === 'completed' && !hasVideo ? 4000 : 2000;
              window.setTimeout(poll, delay);
            }
            if (status.status === 'failed' || (status.status === 'completed' && hasVideo && hasThumb)) {
              stopProgressTracking();
            }
          } catch {
            window.setTimeout(poll, 3000);
          }
        };
        window.setTimeout(poll, 1500);

        if (resolvedVideoUrl) {
          stopProgressTracking();
        }
      } catch (error) {
        stopProgressTracking();
        emitClientMetric('generation_failed', {
          local_key: localKey,
          batch_id: batchId,
          group_id: batchId,
          iteration_index: iterationIndex,
          iteration_count: iterationCount,
          engine: selectedEngine.id,
          mode: submissionMode,
          error_code:
            error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
              ? (error as { code: string }).code
              : 'generation_request_failed',
          error_message: error instanceof Error ? error.message : 'Generation failed',
        });
        let fallbackBatchId: string | null = null;
        setRenders((prev) => {
          const next = prev.filter((r) => r.localKey !== localKey);
          fallbackBatchId = next[0]?.batchId ?? null;
          return next;
        });
        setBatchHeroes((prev) => {
          if (!prev[batchId]) return prev;
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
        setActiveBatchId((current) => (current === batchId ? fallbackBatchId : current));
        setActiveGroupId((current) => (current === batchId ? fallbackBatchId : current));
        setSelectedPreview((cur) => (cur && cur.localKey === localKey ? null : cur));
        if (isInsufficientFundsError(error)) {
          const shortfallCents = error.details?.requiredCents;
          presentInsufficientFunds(shortfallCents);
          return;
        }
        if (error && typeof error === 'object' && (error as { error?: string }).error === 'FAL_UNPROCESSABLE_ENTITY') {
          const payload = error as { userMessage?: string; providerMessage?: string; detail?: unknown };
          const userMessage =
            typeof payload.userMessage === 'string'
              ? payload.userMessage
              : `The provider rejected this ${primaryAssetFieldLabel.toLowerCase()}. Please try with a different one.`;
          const providerMessage =
            typeof payload.providerMessage === 'string'
              ? payload.providerMessage
              : typeof payload.detail === 'string'
                ? payload.detail
                : undefined;
          const composed =
            providerMessage && providerMessage !== userMessage
              ? `${userMessage}\n(${providerMessage})`
              : userMessage;
          showComposerError(composed);
          return;
        }
        const enrichedError = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
        const apiMessage =
          typeof enrichedError?.originalMessage === 'string' && enrichedError.originalMessage.trim().length
            ? enrichedError.originalMessage.trim()
            : undefined;
        const fallbackMessage =
          apiMessage ??
          (error instanceof Error && typeof error.message === 'string' && error.message.trim().length
            ? error.message
            : 'Generate failed');
        showComposerError(fallbackMessage);
      }
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [
    audioWorkflowUnsupported,
    form,
    activeMode,
    submissionMode,
    effectivePrompt,
    effectiveDurationSec,
    negativePrompt,
    selectedEngine,
    preflight,
    memberTier,
    showComposerError,
    writeScopedStorage,
    mutateLatestJobs,
    inputSchemaSummary,
    extraInputFields,
    inputAssets,
    setActiveGroupId,
    uiLocale,
    workflowCopy,
    capability,
    workspaceCopy.wallet.insufficient,
    workspaceCopy.wallet.insufficientWithAmount,
    cfgScale,
    formatTakeLabel,
    primaryAssetFieldLabel,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    referenceAudioFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    allowsUnifiedVeoFirstLast,
    hasLastFrameInput,
    supportsAudioToggle,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    multiPromptScenes,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    prompt.length,
    promptCharLimitExceeded,
    promptMaxChars,
    voiceIds,
    voiceControlEnabled,
    shotType,
    klingElements,
  ]);

  useEffect(() => {
    if (!selectedEngine || !authChecked) return;
    setForm((current) => {
      const candidate = current ?? null;
      if (!candidate) return candidate;
      const nextMode = getPreferredEngineMode(selectedEngine, candidate?.mode ?? null);
      const normalizedPrevious = candidate ? { ...candidate, mode: nextMode } : null;
      const nextState = coerceFormState(selectedEngine, nextMode, normalizedPrevious);
      if (candidate) {
        const hasChanged =
          candidate.engineId !== nextState.engineId ||
          candidate.mode !== nextState.mode ||
          candidate.durationSec !== nextState.durationSec ||
          candidate.durationOption !== nextState.durationOption ||
          candidate.numFrames !== nextState.numFrames ||
          candidate.resolution !== nextState.resolution ||
          candidate.aspectRatio !== nextState.aspectRatio ||
          candidate.fps !== nextState.fps ||
          candidate.iterations !== nextState.iterations ||
          candidate.seedLocked !== nextState.seedLocked ||
          candidate.loop !== nextState.loop ||
          candidate.audio !== nextState.audio ||
          candidate.seed !== nextState.seed ||
          candidate.cameraFixed !== nextState.cameraFixed ||
          candidate.safetyChecker !== nextState.safetyChecker;
        return hasChanged ? nextState : candidate;
      }
      return nextState;
    });
  }, [selectedEngine, authChecked]);

  useEffect(() => {
    if (!form || !selectedEngine || !authChecked) return;
    let canceled = false;

    const payload: PreflightRequest = {
      engine: form.engineId,
      mode: submissionMode,
      durationSec: effectiveDurationSec,
      resolution: form.resolution as PreflightRequest['resolution'],
      aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'],
      fps: form.fps,
      seedLocked: Boolean(form.seedLocked),
      loop: form.loop,
      ...(supportsAudioToggle ? { audio: form.audio } : {}),
      ...(voiceControlEnabled ? { voiceControl: true } : {}),
      user: { memberTier },
    };
    setPricing(true);
    setPreflightError(undefined);

    const timeout = setTimeout(() => {
      Promise.resolve()
        .then(() => runPreflight(payload))
        .then((response) => {
          if (canceled) return;
          setPreflight(response);
          if (!response.ok) {
            const message =
              (typeof response.error?.message === 'string' && response.error.message.trim().length
                ? response.error.message.trim()
                : undefined) ??
              response.messages?.find((entry) => typeof entry === 'string' && entry.trim().length)?.trim() ??
              'Unable to compute pricing';
            setPreflightError(message);
            return;
          }
          setPreflightError(undefined);
        })
        .catch((err) => {
          if (canceled) return;
          console.error('[preflight] failed', err);
          setPreflightError(err instanceof Error ? err.message : 'Preflight failed');
        })
        .finally(() => {
          if (!canceled) {
            setPricing(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [form, selectedEngine, memberTier, authChecked, supportsAudioToggle, effectiveDurationSec, voiceControlEnabled, submissionMode]);

  const handleQuadTileAction = useCallback(
    (action: QuadTileAction, tile: QuadPreviewTile) => {
      emitClientMetric('tile_action', { action, batchId: tile.batchId, version: tile.iterationIndex + 1 });
      const jobId = tile.jobId ?? tile.id;
      switch (action) {
        case 'continue': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(tile.prompt);
          focusComposer();
          break;
        }
        case 'refine': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setPrompt(`${tile.prompt}\n\n// refine here`);
          focusComposer();
          break;
        }
        case 'branch': {
          showNotice('Branching flow is coming soon in this build.');
          break;
        }
        case 'copy': {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(tile.prompt).then(
              () => showNotice('Prompt copied to clipboard'),
              () => showNotice('Unable to copy prompt, please copy manually.')
            );
          } else {
            showNotice('Clipboard not available in this context.');
          }
          break;
        }
        case 'open': {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(jobId);
          setActiveBatchId(tile.batchId);
          setViewMode('quad');
          setSelectedPreview({
            id: tile.id,
            localKey: tile.localKey,
            batchId: tile.batchId,
            iterationIndex: tile.iterationIndex,
            iterationCount: tile.iterationCount,
            videoUrl: tile.videoUrl,
            previewVideoUrl: tile.previewVideoUrl,
            aspectRatio: tile.aspectRatio,
            thumbUrl: tile.thumbUrl,
            progress: tile.progress,
            message: tile.message,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
            prompt: tile.prompt,
          });
          break;
        }
        default:
          break;
      }
    },
    [applyVideoSettingsFromTile, focusComposer, hydrateVideoSettingsFromJob, setPrompt, showNotice]
  );

  const handleCopySharedPrompt = useCallback(() => {
    const promptValue = sharedPrompt ?? selectedPreview?.prompt ?? null;
    if (!promptValue) {
      showNotice('No prompt available to copy.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(promptValue).then(
        () => showNotice('Prompt copied to clipboard'),
        () => showNotice('Unable to copy prompt, please copy manually.')
      );
    } else {
      showNotice('Clipboard not available in this context.');
    }
  }, [sharedPrompt, selectedPreview, showNotice]);

  const fallbackEngineId = selectedEngine?.id ?? 'unknown-engine';

  const handleGalleryGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction, options?: { autoPlayPreview?: boolean }) => {
      if (action === 'remove') {
        return;
      }
      if (group.source === 'active') {
        setActiveGroupId(group.id);
        const renderGroup = renderGroups.get(group.id);
        if (!renderGroup || renderGroup.items.length === 0) return;
        const preferredHeroKey =
          batchHeroes[group.id] ?? renderGroup.items.find((item) => item.videoUrl)?.localKey ?? renderGroup.items[0]?.localKey;
        const heroRender = preferredHeroKey
          ? renderGroup.items.find((item) => item.localKey === preferredHeroKey) ?? renderGroup.items[0]
          : renderGroup.items[0];
        if (!heroRender) return;
        const heroJobId = heroRender.jobId ?? heroRender.id;
        if (action === 'compare') {
          emitClientMetric('compare_used', { batchId: group.id });
          showNotice('Compare view is coming soon.');
          return;
        }
        const tile = buildQuadTileFromRender(heroRender, renderGroup, preflight?.currency ?? 'USD');
        if (action === 'open') {
          if (options?.autoPlayPreview) {
            setPreviewAutoPlayRequestId((current) => current + 1);
          }
          handleQuadTileAction('open', tile);
          setCompositeOverride(null);
          setCompositeOverrideSummary(null);
          setSharedPrompt(null);
          return;
        }
        if (action === 'continue') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('continue', tile);
          return;
        }
        if (action === 'refine') {
          applyVideoSettingsFromTile(tile);
          void hydrateVideoSettingsFromJob(heroJobId);
          handleQuadTileAction('refine', tile);
          return;
        }
        if (action === 'branch') {
          handleQuadTileAction('branch', tile);
        }
        return;
      }

      const hero = group.hero;

      if (action === 'compare') {
        emitClientMetric('compare_used', { batchId: group.id });
        showNotice('Compare view is coming soon.');
        return;
      }

      if (action === 'branch') {
        showNotice('Branching flow is coming soon in this build.');
        return;
      }

      const tile = buildQuadTileFromGroupMember(group, hero, fallbackEngineId);
      const heroJobId = hero.jobId ?? tile.id;

      if (action === 'open') {
        if (options?.autoPlayPreview) {
          setPreviewAutoPlayRequestId((current) => current + 1);
        }
        const targetBatchId = tile.batchId ?? group.batchId ?? null;
        if (tile.iterationCount > 1) {
          setViewMode('quad');
        } else {
          setViewMode('single');
        }
        if (targetBatchId) {
          setActiveBatchId(targetBatchId);
          if (tile.localKey) {
            setBatchHeroes((prev) => ({ ...prev, [targetBatchId]: tile.localKey! }));
          }
        }
        setSelectedPreview({
          id: tile.id,
          localKey: tile.localKey,
          batchId: tile.batchId,
          iterationIndex: tile.iterationIndex,
          iterationCount: tile.iterationCount,
          videoUrl: tile.videoUrl,
          previewVideoUrl: tile.previewVideoUrl,
          aspectRatio: tile.aspectRatio,
          thumbUrl: tile.thumbUrl,
          progress: tile.progress,
          message: tile.message,
          priceCents: tile.priceCents,
          currency: tile.currency,
          etaLabel: tile.etaLabel,
          prompt: tile.prompt,
        });
        const normalizedSummary = normalizeGroupSummary(group);
        setCompositeOverride(adaptGroupSummary(normalizedSummary, provider));
        setCompositeOverrideSummary(normalizedSummary);
        try {
          if (heroJobId.startsWith('job_')) {
            writeScopedStorage(STORAGE_KEYS.previewJobId, heroJobId);
          }
        } catch {
          // ignore storage failures
        }
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        return;
      }

      if (action === 'continue' || action === 'refine') {
        applyVideoSettingsFromTile(tile);
        void hydrateVideoSettingsFromJob(heroJobId);
        handleQuadTileAction(action, tile);
        return;
      }
    },
    [
      renderGroups,
      batchHeroes,
      preflight?.currency,
      handleQuadTileAction,
      showNotice,
      fallbackEngineId,
      setActiveGroupId,
      setViewMode,
      setActiveBatchId,
      setSelectedPreview,
      setPreviewAutoPlayRequestId,
      provider,
      setCompositeOverride,
      setCompositeOverrideSummary,
      applyVideoSettingsFromTile,
      hydrateVideoSettingsFromJob,
      writeScopedStorage,
    ]
  );

  const handleGalleryFeedStateChange = useCallback((state: GalleryFeedState) => {
    setGuidedSampleFeed((prev) => {
      if (prev.sampleOnly === state.sampleOnly && haveSameGroupOrder(prev.visibleGroups, state.visibleGroups)) {
        return prev;
      }
      return state;
    });
  }, []);

  useEffect(() => {
    if (isGuidedSamplesActive) return;
    if (compositeOverrideSummary?.hero.job?.curated) {
      setCompositeOverride(null);
      setCompositeOverrideSummary(null);
    }
  }, [compositeOverrideSummary, isGuidedSamplesActive]);

  useEffect(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (currentGroupId && guidedSampleGroups.some((group) => group.id === currentGroupId)) {
      return;
    }
    handleGalleryGroupAction(guidedSampleGroups[0], 'open');
  }, [compositeOverrideSummary?.id, guidedSampleGroups, handleGalleryGroupAction, isGuidedSamplesActive]);

  const currentGuidedSampleIndex = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return -1;
    const currentGroupId = compositeOverrideSummary?.id ?? null;
    if (!currentGroupId) return -1;
    return guidedSampleGroups.findIndex((group) => group.id === currentGroupId);
  }, [compositeOverrideSummary?.id, guidedSampleGroups, isGuidedSamplesActive]);

  const openGuidedSampleAt = useCallback(
    (index: number) => {
      const target = guidedSampleGroups[index];
      if (!target) return;
      handleGalleryGroupAction(target, 'open', { autoPlayPreview: true });
    },
    [guidedSampleGroups, handleGalleryGroupAction]
  );

  const guidedNavigation = useMemo(() => {
    if (!isGuidedSamplesActive || guidedSampleGroups.length === 0) return null;
    const activeIndex = currentGuidedSampleIndex >= 0 ? currentGuidedSampleIndex : 0;
    return {
      currentIndex: activeIndex,
      total: guidedSampleGroups.length,
      canPrev: activeIndex > 0,
      canNext: activeIndex < guidedSampleGroups.length - 1,
      onPrev: () => openGuidedSampleAt(activeIndex - 1),
      onNext: () => openGuidedSampleAt(activeIndex + 1),
    };
  }, [currentGuidedSampleIndex, guidedSampleGroups, isGuidedSamplesActive, openGuidedSampleAt]);

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );
  const handleActiveGroupOpen = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open', { autoPlayPreview: true });
    },
    [handleGalleryGroupAction]
  );
  const handleActiveGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') return;
      handleGalleryGroupAction(group, action, { autoPlayPreview: action === 'open' });
    },
    [handleGalleryGroupAction]
  );

  const singlePriceCents = typeof preflight?.total === 'number' ? preflight.total : null;
  const singlePrice =
    typeof singlePriceCents === 'number' ? singlePriceCents / 100 : null;
  const price =
    typeof singlePrice === 'number' && form?.iterations
      ? singlePrice * form.iterations
      : singlePrice;
  const currency = preflight?.currency ?? 'USD';

  if (isLoading && engines.length === 0) {
    return (
      <>
        <WorkspaceChrome
          isDesktopLayout={isDesktopLayout}
          desktopRail={<GalleryRailSkeleton />}
          mobileRail={<GalleryRailSkeleton />}
        >
          <WorkspaceBootContent initialPreviewGroup={initialPreviewFallbackGroup} initialPreviewPosterSrc={compositePreviewPosterSrc} />
        </WorkspaceChrome>
      </>
    );
  }

  if (enginesError && engines.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-state-warning">
        {workspaceCopy.errors.loadEngines}: {enginesError.message}
      </main>
    );
  }

  if (!selectedEngine || !form) {
    if (engines.length > 0) {
      return (
        <>
          <WorkspaceChrome
            isDesktopLayout={isDesktopLayout}
            desktopRail={<GalleryRailSkeleton />}
            mobileRail={<GalleryRailSkeleton />}
          >
            <WorkspaceBootContent initialPreviewGroup={initialPreviewFallbackGroup} initialPreviewPosterSrc={compositePreviewPosterSrc} />
          </WorkspaceChrome>
        </>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        {workspaceCopy.errors.noEngines}
      </main>
    );
  }

  return (
    <>
      <WorkspaceChrome
        isDesktopLayout={isDesktopLayout}
        desktopRail={
          <GalleryRail
            engine={selectedEngine}
            engineRegistry={engines}
            activeGroups={normalizedPendingGroups}
            onOpenGroup={openGroupViaGallery}
            onGroupAction={handleGalleryGroupAction}
            onFeedStateChange={handleGalleryFeedStateChange}
            variant="desktop"
          />
        }
        mobileRail={
          <GalleryRail
            engine={selectedEngine}
            engineRegistry={engines}
            activeGroups={normalizedPendingGroups}
            onOpenGroup={openGroupViaGallery}
            onGroupAction={handleGalleryGroupAction}
            onFeedStateChange={handleGalleryFeedStateChange}
            variant="mobile"
          />
        }
      >
            {notice && (
              <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
                {notice}
              </div>
            )}
            <div className="stack-gap-lg">
              {showCenterGallery ? (
                normalizedPendingGroups.length === 0 && !isGenerationLoading ? (
                  <div className="rounded-card border border-border bg-surface-glass-80 p-5 text-center text-sm text-text-secondary">
                    {workspaceCopy.gallery.empty}
                  </div>
                ) : (
                  <div className="grid grid-gap-sm sm:grid-cols-2">
                    {normalizedPendingGroups.map((group, index) => {
                      const engineId = group.hero.engineId;
                      const engine = engineId ? engineMap.get(engineId) ?? null : null;
                      return (
                        <GroupedJobCard
                          key={group.id}
                          group={group}
                          engine={engine ?? undefined}
                          onOpen={handleActiveGroupOpen}
                          onAction={handleActiveGroupAction}
                          allowRemove={false}
                          eagerPreview={index === 0}
                        />
                      );
                    })}
                    {isGenerationLoading &&
                      Array.from({ length: normalizedPendingGroups.length ? 0 : generationSkeletonCount }).map((_, index) => (
                        <div key={`workspace-gallery-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                          <div className="relative overflow-hidden rounded-card">
                            <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                              <div className="skeleton absolute inset-0" />
                            </div>
                          </div>
                          <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
                            <div className="h-3 w-24 rounded-full bg-skeleton" />
                          </div>
                        </div>
                      ))}
                  </div>
                )
              ) : null}
              <CompositePreviewDock
                group={displayCompositeGroup}
                isLoading={isGenerationLoading && !displayCompositeGroup}
                autoPlayRequestId={previewAutoPlayRequestId}
                copyPrompt={sharedVideoSettings ? null : sharedPrompt}
                onCopyPrompt={sharedVideoSettings ? undefined : sharedPrompt ? handleCopySharedPrompt : undefined}
                showTitle={false}
                guidedNavigation={guidedNavigation}
                engineSettings={
                  <EngineSettingsBar
                    engines={engines}
                    engineId={form.engineId}
                    onEngineChange={handleEngineChange}
                    mode={activeMode}
                    onModeChange={handleModeChange}
                    modeOptions={engineModeOptions}
                    modeLabel={getEngineModeLabel(selectedEngine?.id, activeMode, uiLocale)}
                    showModeBadge={false}
                  />
                }
                onOpenModal={(group) => {
                  if (!group) return;
                  if (renderGroups.has(group.id)) {
                    setViewerTarget({ kind: 'pending', id: group.id });
                    return;
                  }
                  if (compositeOverrideSummary && compositeOverrideSummary.id === group.id) {
                    setViewerTarget({ kind: 'summary', summary: compositeOverrideSummary });
                    return;
                  }
                  setViewerTarget({ kind: 'group', group });
                }}
              />
              <Composer
                engine={selectedEngine}
                prompt={prompt}
                onPromptChange={setPrompt}
                negativePrompt={negativePrompt}
                onNegativePromptChange={setNegativePrompt}
                price={price}
                currency={currency}
                isLoading={isPricing}
                error={preflightError}
                messages={preflight?.ok ? preflight.messages : undefined}
                textareaRef={composerRef}
                onGenerate={startRender}
                preflight={preflight}
                promptField={inputSchemaSummary.promptField}
                promptRequired={inputSchemaSummary.promptRequired}
                negativePromptField={inputSchemaSummary.negativePromptField}
                negativePromptRequired={inputSchemaSummary.negativePromptRequired}
                modeToggles={composerModeToggles}
                activeManualMode={activeManualMode}
                onModeToggle={handleComposerModeToggle}
                workflowNotice={composerWorkflowNotice}
                promotedActions={composerPromotedActions}
                assetFields={composerAssetFields}
                assets={composerAssets}
                onAssetAdd={handleAssetAdd}
                onAssetRemove={handleAssetRemove}
                onNotice={showNotice}
                onOpenLibrary={handleOpenAssetLibrary}
                multiPrompt={
                  supportsKlingV3Controls
                    ? {
                        enabled: multiPromptEnabled,
                        scenes: multiPromptScenes,
                        totalDurationSec: multiPromptTotalSec,
                        minDurationSec: MULTI_PROMPT_MIN_SEC,
                        maxDurationSec: MULTI_PROMPT_MAX_SEC,
                        onToggle: setMultiPromptEnabled,
                        onAddScene: handleMultiPromptAddScene,
                        onRemoveScene: handleMultiPromptRemoveScene,
                        onUpdateScene: handleMultiPromptUpdateScene,
                        error: multiPromptError,
                      }
                    : null
                }
                disableGenerate={multiPromptInvalid || audioWorkflowUnsupported}
                extraFields={
                  <>
                    {showRetakeWorkflowAction ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Edit workflow</p>
                          <p className="text-xs text-text-secondary">Use retake when you want to reinterpret an existing clip.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={form.mode === 'retake' ? 'primary' : 'outline'}
                          onClick={() => handleComposerModeToggle(form.mode === 'retake' ? null : 'retake')}
                          disabled={audioWorkflowLocked}
                          title={audioWorkflowLocked ? workflowCopy.removeAudioToUnlock : undefined}
                          className="min-h-0 h-auto rounded-full px-3 py-2 text-[11px] font-semibold tracking-micro"
                        >
                          {getLocalizedModeLabel('retake', uiLocale)}
                        </Button>
                      </div>
                    ) : null}
                    {supportsKlingV3Controls && activeMode === 'i2v' ? (
                      <KlingElementsBuilder
                        elements={klingElements}
                        onAddElement={handleKlingElementAdd}
                        onRemoveElement={handleKlingElementRemove}
                        onAddAsset={handleKlingElementAssetAdd}
                        onRemoveAsset={handleKlingElementAssetRemove}
                        onOpenLibrary={handleOpenKlingAssetLibrary}
                      />
                    ) : null}
                    <SettingsControls
                      engine={selectedEngine}
                      caps={capability}
                      durationSec={multiPromptActive ? multiPromptTotalSec : form.durationSec}
                      durationOption={form.durationOption ?? null}
                      onDurationChange={handleDurationChange}
                      numFrames={form.numFrames ?? undefined}
                      onNumFramesChange={handleFramesChange}
                      resolution={form.resolution}
                      onResolutionChange={handleResolutionChange}
                      aspectRatio={form.aspectRatio}
                      onAspectRatioChange={handleAspectRatioChange}
                      fps={form.fps}
                      onFpsChange={handleFpsChange}
                      mode={submissionMode}
                      showAudioControl={supportsAudioToggle}
                      audioEnabled={form.audio}
                      audioControlDisabled={voiceControlEnabled}
                      audioControlNote={voiceControlEnabled ? 'Audio locked by voice control' : undefined}
                      onAudioChange={(audio) => setForm((current) => (current ? { ...current, audio } : current))}
                      showLoopControl={isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)}
                      loopEnabled={
                        isLumaRay2EngineId(selectedEngine.id) && isLumaRay2GenerateMode(submissionMode)
                          ? Boolean(form.loop)
                          : undefined
                      }
                      onLoopChange={(next) =>
                        setForm((current) => (current ? { ...current, loop: next } : current))
                      }
                      showExtendControl={false}
                      seedLocked={form.seedLocked}
                      onSeedLockedChange={(seedLocked) =>
                        setForm((current) => (current ? { ...current, seedLocked } : current))
                      }
                      cfgScale={cfgScale}
                      onCfgScaleChange={(value) => setCfgScale(value)}
                      durationManaged={multiPromptActive}
                      durationManagedLabel={`Duration managed by multi-prompt · ${multiPromptTotalSec}s`}
                      showKlingV3Controls={supportsKlingV3Controls}
                      showKlingV3VoiceControls={supportsKlingV3VoiceControl}
                      klingShotType={shotType}
                      onKlingShotTypeChange={(value) => setShotType(value)}
                      voiceIdsValue={voiceIdsInput}
                      onVoiceIdsChange={(value) => setVoiceIdsInput(value)}
                      voiceControlActive={voiceControlEnabled}
                      showSeedanceControls={isSeedance}
                      seedValue={seedValue}
                      onSeedChange={handleSeedChange}
                      cameraFixed={cameraFixedValue}
                      onCameraFixedChange={handleCameraFixedChange}
                      safetyChecker={safetyCheckerValue}
                      onSafetyCheckerChange={handleSafetyCheckerChange}
                      showSafetyCheckerControl={showSafetyCheckerControl}
                      advancedFields={inputSchemaSummary.secondaryFields}
                      advancedFieldValues={form.extraInputValues}
                      onAdvancedFieldChange={handleExtraInputValueChange}
                      variant="advanced"
                    />
                  </>
                }
                settingsBar={
                  <CoreSettingsBar
                    engine={selectedEngine}
                    mode={submissionMode}
                    caps={capability}
                    iterations={form.iterations}
                    onIterationsChange={(iterations) =>
                      setForm((current) => {
                        const next = current ? { ...current, iterations } : current;
                        if (iterations <= 1) {
                          setViewMode('single');
                        }
                        return next;
                      })
                    }
                    durationSec={multiPromptActive ? multiPromptTotalSec : form.durationSec}
                    durationOption={form.durationOption ?? null}
                    onDurationChange={handleDurationChange}
                    numFrames={form.numFrames ?? undefined}
                    onNumFramesChange={handleFramesChange}
                    resolution={form.resolution}
                    onResolutionChange={handleResolutionChange}
                    aspectRatio={form.aspectRatio}
                    onAspectRatioChange={handleAspectRatioChange}
                    fps={form.fps}
                    onFpsChange={handleFpsChange}
                    showAudioControl={supportsAudioToggle}
                    audioEnabled={form.audio}
                    audioControlDisabled={voiceControlEnabled}
                    audioControlNote={voiceControlEnabled ? 'Audio locked by voice control' : undefined}
                    onAudioChange={(audio) => setForm((current) => (current ? { ...current, audio } : current))}
                    durationManaged={multiPromptActive}
                    durationManagedLabel={`Duration managed by multi-prompt · ${multiPromptTotalSec}s`}
                  />
                }
              />
            </div>
      </WorkspaceChrome>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setViewerTarget(null)}
          onRefreshJob={handleRefreshJob}
        />
      ) : null}
      {topUpModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={closeTopUpModal} />
          <form
            className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
            onSubmit={handleTopUpSubmit}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">Wallet balance too low</h2>
                <p className="mt-2 text-sm text-text-secondary">{topUpModal.message}</p>
                {topUpModal.amountLabel && (
                  <p className="mt-2 text-sm font-medium text-text-primary">
                    Suggested top-up: {topUpModal.amountLabel}
                  </p>
                )}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{workspaceCopy.topUp.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1000, 2500, 5000].map((value) => {
                      const formatted = (() => {
                        try {
                          return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(value / 100);
                        } catch {
                          return `${currency} ${(value / 100).toFixed(2)}`;
                        }
                      })();
                      const isActive = topUpAmount === value;
                      return (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectPresetAmount(value)}
                          className={clsx(
                            'min-h-0 h-8 px-3 py-1.5 text-sm font-medium',
                            isActive
                              ? 'border-brand bg-surface-2 text-brand hover:border-brand'
                              : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                          )}
                        >
                          {formatted}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <label htmlFor="custom-topup" className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                      {workspaceCopy.topUp.otherAmountLabel}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                          $
                        </span>
                        <Input
                          id="custom-topup"
                          type="number"
                          min={10}
                          step={1}
                          value={Math.max(10, Math.round(topUpAmount / 100))}
                          onChange={handleCustomAmountChange}
                          className="h-10 pl-6 pr-3"
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {workspaceCopy.topUp.minLabel.replace('{amount}', '$10')}
                      </span>
                    </div>
                  </div>
                  {topUpError && <p className="mt-2 text-sm text-state-warning">{topUpError}</p>}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeTopUpModal}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={workspaceCopy.topUp.close}
              >
                {workspaceCopy.topUp.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={closeTopUpModal} className="px-4">
                {workspaceCopy.topUp.maybeLater}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isTopUpLoading}
                className={clsx('px-4', !isTopUpLoading && 'hover:brightness-105')}
              >
                {isTopUpLoading ? workspaceCopy.topUp.submitting : workspaceCopy.topUp.submit}
              </Button>
            </div>
          </form>
        </div>
      )}
      {authModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">{workspaceCopy.authGate.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{workspaceCopy.authGate.body}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={workspaceCopy.authGate.close}
              >
                {workspaceCopy.authGate.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
                {workspaceCopy.authGate.primary}
              </ButtonLink>
              <ButtonLink
                href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
                variant="outline"
                size="sm"
                className="px-4"
              >
                {workspaceCopy.authGate.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
      {assetPickerTarget && (
        <AssetLibraryModal
          fieldLabel={
            assetPickerTarget.kind === 'field'
              ? assetPickerTarget.field.label ?? workspaceCopy.assetLibrary.fieldFallback
              : assetPickerTarget.slot === 'frontal'
                ? 'Kling frontal image'
                : `Kling reference ${typeof assetPickerTarget.slotIndex === 'number' ? assetPickerTarget.slotIndex + 1 : ''}`.trim()
          }
          assetType={assetLibraryKind}
          assets={visibleAssetLibrary}
          isLoading={isAssetLibraryLoading}
          error={assetLibraryError}
          source={assetLibrarySource}
          onSourceChange={(nextSource) => {
            if (nextSource === assetLibrarySource) return;
            setAssetLibrarySource(nextSource);
            setAssetLibraryError(null);
            setAssetLibrary([]);
            setAssetLibraryLoadedKey(null);
          }}
          onClose={() => setAssetPickerTarget(null)}
          onRefresh={(sourceOverride) => fetchAssetLibrary({ source: sourceOverride ?? assetLibrarySource, kind: assetLibraryKind })}
          onSelect={(asset) => {
            if (assetPickerTarget.kind === 'field') {
              void handleSelectLibraryAsset(assetPickerTarget.field, asset, assetPickerTarget.slotIndex);
              return;
            }
            handleSelectKlingLibraryAsset(assetPickerTarget, asset);
          }}
          onDelete={handleDeleteLibraryAsset}
          deletingAssetId={assetDeletePendingId}
        />
      )}
    </>
  );
}
const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);
