'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEngines, useInfiniteJobs, getJobStatus } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import { SettingsControls } from '@/components/SettingsControls';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import { EngineSettingsBar } from '@/components/EngineSettingsBar';
import {
  Composer,
  type MultiPromptScene,
} from '@/components/Composer';
import type { KlingElementState, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
import type { GalleryRailProps } from '@/components/GalleryRail';
import type { GroupSummary } from '@/types/groups';
import type { CompositePreviewDockProps } from '@/components/groups/CompositePreviewDock';
import dynamic from 'next/dynamic';
import { DEFAULT_PROCESSING_COPY } from '@/components/groups/ProcessingOverlay';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import type { VideoGroup } from '@/types/video-groups';
import {
  mapSelectedPreviewToGroup,
  type SharedVideoPreview,
} from '@/lib/video-preview-group';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard } from '@/components/GroupedJobCard';
import { normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supportsAudioPricingToggle } from '@/lib/pricing-addons';
import { readLastKnownUserId } from '@/lib/last-known';
import { Button } from '@/components/ui/Button';
import type { AssetLibraryModalProps } from '@/components/library/AssetLibraryModal';
import {
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
} from '@/lib/luma-ray2';
import { useI18n } from '@/lib/i18n/I18nProvider';
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
import { WorkspaceAuthGateModal } from './_components/WorkspaceAuthGateModal';
import { WorkspaceTopUpModal } from './_components/WorkspaceTopUpModal';
import { getCompositePreviewPosterSrc } from './_lib/composite-preview';
import {
  normalizeExtraInputValue,
  type FormState,
} from './_lib/workspace-form-state';
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
  buildComposerAttachments,
  buildReferenceAudioFieldIds,
  getPrimaryAssetFieldLabel,
  getReferenceInputStatus,
  hasInputAssetInSlots,
  PRIMARY_IMAGE_SLOT_IDS,
  PRIMARY_VIDEO_SLOT_IDS,
  revokeAssetPreview,
  type ReferenceAsset,
} from './_lib/workspace-assets';
import {
  DEFAULT_WORKSPACE_COPY,
  mergeCopy,
} from './_lib/workspace-copy';
import {
  DEFAULT_PROMPT,
  DESKTOP_RAIL_MIN_WIDTH,
  UNIFIED_VEO_FIRST_LAST_ENGINE_IDS,
} from './_lib/workspace-client-helpers';
import {
  buildMultiPromptSummary,
  createKlingElement,
  createLocalId,
  createMultiPromptScene,
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
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
  consumeWorkspaceOnboardingSkipIntent,
  parseStoredMultiPromptScenes,
  readStoredWorkspaceForm,
  resolveWorkspaceRequestParams,
} from './_lib/workspace-hydration';
import {
  buildComposerPromotedActions,
  summarizeWorkspaceInputSchema,
} from './_lib/workspace-input-schema';
import { useWorkspaceAssets } from './_hooks/useWorkspaceAssets';
import { useWorkspaceGalleryActions } from './_hooks/useWorkspaceGalleryActions';
import { useWorkspaceGenerationRunner } from './_hooks/useWorkspaceGenerationRunner';
import { useWorkspacePricingGate } from './_hooks/useWorkspacePricingGate';
import { useWorkspaceRenderState } from './_hooks/useWorkspaceRenderState';
import { useWorkspaceVideoSettings } from './_hooks/useWorkspaceVideoSettings';

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
  const [memberTier, setMemberTier] = useState<'Member' | 'Plus' | 'Pro'>('Member');
  const [notice, setNotice] = useState<string | null>(null);

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
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);
  const [sharedVideoSettings, setSharedVideoSettings] = useState<SharedVideoPreview | null>(null);
  const [viewerTarget, setViewerTarget] = useState<
    { kind: 'pending'; id: string } | { kind: 'summary'; summary: GroupSummary } | { kind: 'group'; group: VideoGroup } | null
  >(null);
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
  const [compositeOverride, setCompositeOverride] = useState<VideoGroup | null>(null);
  const [compositeOverrideSummary, setCompositeOverrideSummary] = useState<GroupSummary | null>(null);
  const {
    renders,
    setRenders,
    rendersRef,
    selectedPreview,
    setSelectedPreview,
    setActiveBatchId,
    batchHeroes,
    setBatchHeroes,
    setActiveGroupId,
    setViewMode,
    renderGroups,
    normalizedPendingGroups,
    pendingSummaryMap,
    activeVideoGroup,
    isGenerationLoading,
    generationSkeletonCount,
    hydratePendingRendersFromStorage,
    resetRenderState,
  } = useWorkspaceRenderState({
    recentJobs,
    engineIdByLabel,
    provider,
    storageScope,
    hydratedForScope,
    formIterations: form?.iterations,
    compositeOverride,
    compositeOverrideSummary,
    writeScopedStorage,
  });
  const applyVideoSettingsSnapshotRef = useRef<(snapshot: unknown) => void>(() => undefined);
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
    if (typeof window === 'undefined') return;
    if (!engines.length) return;
    if (requestedJobId) return;
    if (hydratedScopeRef.current === storageScope) return;
    hydratedScopeRef.current = storageScope;
    setHydratedForScope(null);

    resetRenderState();

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
      hydratePendingRendersFromStorage(pendingValue);
    } catch {
      resetRenderState();
    } finally {
      setHydratedForScope(storageScope);
    }
  }, [
    engines,
    hydratePendingRendersFromStorage,
    readScopedStorage,
    readStorage,
    resetRenderState,
    writeStorage,
    setMemberTier,
    storageScope,
    effectiveRequestedEngineId,
    effectiveRequestedMode,
    effectiveRequestedEngineToken,
    requestedJobId,
  ]);

  const compositeGroup = compositeOverride ?? activeVideoGroup ?? null;
  const selectedPreviewGroup = useMemo(() => mapSelectedPreviewToGroup(selectedPreview, provider), [selectedPreview, provider]);
  const initialPreviewFallbackGroup =
    effectiveRequestedEngineId || effectiveRequestedEngineToken || requestedJobId || fromVideoId
      ? null
      : initialPreviewGroup;
  const displayCompositeGroup = compositeGroup ?? selectedPreviewGroup ?? initialPreviewFallbackGroup;
  const compositePreviewPosterSrc = useMemo(() => getCompositePreviewPosterSrc(displayCompositeGroup), [displayCompositeGroup]);

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

  const {
    inputAssets,
    setInputAssets,
    assetPickerTarget,
    assetLibraryKind,
    assetLibrarySource,
    visibleAssetLibrary,
    isAssetLibraryLoading,
    assetLibraryError,
    assetDeletePendingId,
    fetchAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    handleOpenAssetLibrary,
    handleOpenKlingAssetLibrary,
    handleSelectLibraryAsset,
    handleSelectKlingLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  } = useWorkspaceAssets({
    engineId: form?.engineId,
    workflowCopy,
    showNotice,
    klingElements,
    setKlingElements,
  });

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
  }, [
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    readScopedStorage,
    recentJobs,
    renders.length,
    selectedPreview,
    setSelectedPreview,
  ]);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
  }, []);
  const replaceWorkspaceRoute = useCallback((href: string) => {
    router.replace(href);
  }, [router]);

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

  const {
    applyVideoSettingsSnapshot,
    hydrateVideoSettingsFromJob,
    applyVideoSettingsFromTile,
  } = useWorkspaceVideoSettings({
    engines,
    engineMap,
    provider,
    fromVideoId,
    requestedJobId,
    searchString,
    sharedVideoSettings,
    authChecked,
    hydratedForScope,
    storageScope,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    rendersLength: renders.length,
    compositeOverride,
    compositeOverrideSummary,
    focusComposer,
    readScopedStorage,
    writeScopedStorage,
    replaceRoute: replaceWorkspaceRoute,
    setPrompt,
    setNegativePrompt,
    setMemberTier,
    setCfgScale,
    setShotType,
    setVoiceIdsInput,
    setMultiPromptEnabled,
    setMultiPromptScenes,
    setForm,
    setInputAssets,
    setKlingElements,
    setSelectedPreview,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setSharedPrompt,
    setSharedVideoSettings,
    setNotice,
  });

  useEffect(() => {
    applyVideoSettingsSnapshotRef.current = applyVideoSettingsSnapshot;
  }, [applyVideoSettingsSnapshot]);

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
  }, [inputSchemaSummary.assetFields, setInputAssets]);

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

  const {
    preflight,
    preflightError,
    isPricing,
    price,
    currency,
    topUpModal,
    topUpAmount,
    isTopUpLoading,
    topUpError,
    authModalOpen,
    showComposerError,
    closeTopUpModal,
    handleSelectPresetAmount,
    handleCustomAmountChange,
    handleTopUpSubmit,
    setAuthModalOpen,
    setPreflightError,
    setTopUpModal,
  } = useWorkspacePricingGate({
    form,
    selectedEngine,
    authChecked,
    memberTier,
    setMemberTier,
    supportsAudioToggle,
    effectiveDurationSec,
    voiceControlEnabled,
    submissionMode,
    showNotice,
  });

  const { startRender } = useWorkspaceGenerationRunner({
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
    setAuthModalOpen,
    setPreflightError,
    setTopUpModal,
    setActiveGroupId,
    setActiveBatchId,
    setBatchHeroes,
    setRenders,
    setSelectedPreview,
    setViewMode,
    rendersRef,
    uiLocale,
    workflowCopy,
    workspaceCopy,
    capability,
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
    promptLength: prompt.length,
    promptCharLimitExceeded,
    promptMaxChars,
    voiceIds,
    voiceControlEnabled,
    shotType,
    klingElements,
  });

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

  const fallbackEngineId = selectedEngine?.id ?? 'unknown-engine';
  const {
    previewAutoPlayRequestId,
    guidedNavigation,
    handleCopySharedPrompt,
    handleGalleryGroupAction,
    handleGalleryFeedStateChange,
    openGroupViaGallery,
    handleActiveGroupOpen,
    handleActiveGroupAction,
  } = useWorkspaceGalleryActions({
    provider,
    renderGroups,
    batchHeroes,
    preflightCurrency: preflight?.currency,
    fallbackEngineId,
    sharedPrompt,
    selectedPreview,
    compositeOverrideSummary,
    applyVideoSettingsFromTile,
    hydrateVideoSettingsFromJob,
    focusComposer,
    showNotice,
    writeScopedStorage,
    setPrompt,
    setActiveGroupId,
    setViewMode,
    setActiveBatchId,
    setBatchHeroes,
    setSelectedPreview,
    setCompositeOverride,
    setCompositeOverrideSummary,
    setSharedPrompt,
  });

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
      {topUpModal ? (
        <WorkspaceTopUpModal
          modal={topUpModal}
          copy={workspaceCopy.topUp}
          currency={currency}
          topUpAmount={topUpAmount}
          isTopUpLoading={isTopUpLoading}
          topUpError={topUpError}
          onClose={closeTopUpModal}
          onSubmit={handleTopUpSubmit}
          onSelectPresetAmount={handleSelectPresetAmount}
          onCustomAmountChange={handleCustomAmountChange}
        />
      ) : null}
      {authModalOpen ? (
        <WorkspaceAuthGateModal
          copy={workspaceCopy.authGate}
          loginRedirectTarget={loginRedirectTarget}
          onClose={() => setAuthModalOpen(false)}
        />
      ) : null}
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
          onSourceChange={handleAssetLibrarySourceChange}
          onClose={closeAssetLibrary}
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
