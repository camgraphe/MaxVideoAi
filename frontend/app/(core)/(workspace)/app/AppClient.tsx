'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEngines, useInfiniteJobs, getJobStatus } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { useRouter } from 'next/navigation';
import type { EngineCaps } from '@/types/engines';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { GalleryRailProps } from '@/components/GalleryRail';
import type { GroupSummary } from '@/types/groups';
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
import { normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  getLocalizedWorkflowCopy,
  normalizeUiLocale,
} from '@/lib/ltx-localization';
import { WorkspaceBootSurface } from './_components/WorkspaceBootSurface';
import { WorkspaceCenterGallery } from './_components/WorkspaceCenterGallery';
import { WorkspaceChrome } from './_components/WorkspaceChrome';
import { WorkspaceComposerSurface } from './_components/WorkspaceComposerSurface';
import {
  GalleryRailSkeleton,
} from './_components/WorkspaceBootSkeletons';
import { WorkspacePreviewDock } from './_components/WorkspacePreviewDock';
import type { WorkspaceViewerTarget } from './_components/WorkspacePreviewDock';
import { WorkspaceRuntimeModals } from './_components/WorkspaceRuntimeModals';
import { getCompositePreviewPosterSrc } from './_lib/composite-preview';
import {
  type FormState,
} from './_lib/workspace-form-state';
import {
  DEFAULT_WORKSPACE_COPY,
  mergeCopy,
} from './_lib/workspace-copy';
import {
  DEFAULT_PROMPT,
} from './_lib/workspace-client-helpers';
import {
  createKlingElement,
  createMultiPromptScene,
} from './_lib/workspace-input-helpers';
import { useWorkspaceAssets } from './_hooks/useWorkspaceAssets';
import { useWorkspaceComposerState } from './_hooks/useWorkspaceComposerState';
import { useWorkspaceDesktopLayout } from './_hooks/useWorkspaceDesktopLayout';
import { useWorkspaceDraftHydration } from './_hooks/useWorkspaceDraftHydration';
import { useWorkspaceDraftStorage } from './_hooks/useWorkspaceDraftStorage';
import { useWorkspaceGalleryActions } from './_hooks/useWorkspaceGalleryActions';
import { useWorkspaceGenerationRunner } from './_hooks/useWorkspaceGenerationRunner';
import { useWorkspaceInputSchemaState } from './_hooks/useWorkspaceInputSchemaState';
import { useWorkspacePricingGate } from './_hooks/useWorkspacePricingGate';
import { useWorkspaceRenderState } from './_hooks/useWorkspaceRenderState';
import { useWorkspaceVideoSettings } from './_hooks/useWorkspaceVideoSettings';

const GalleryRail = dynamic<GalleryRailProps>(
  () => import('@/components/GalleryRail').then((mod) => mod.GalleryRail),
  {
    ssr: false,
    loading: () => <GalleryRailSkeleton />,
  }
);

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

  const {
    fromVideoId,
    requestedJobId,
    searchString,
    loginRedirectTarget,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    effectiveRequestedMode,
    authChecked,
    storageScope,
    hydratedForScope,
    setHydratedForScope,
    readScopedStorage,
    readStorage,
    writeScopedStorage,
    writeStorage,
    skipOnboardingRef,
    preserveStoredDraftRef,
    hasStoredFormRef,
    requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef,
    requestedModeOverrideRef,
  } = useWorkspaceDraftStorage({
    authLoading,
    authStatus,
    authenticatedUserId: user?.id,
  });
  const [sharedPrompt, setSharedPrompt] = useState<string | null>(null);
  const [sharedVideoSettings, setSharedVideoSettings] = useState<SharedVideoPreview | null>(null);
  const [viewerTarget, setViewerTarget] = useState<WorkspaceViewerTarget>(null);
  const isDesktopLayout = useWorkspaceDesktopLayout();
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

  useWorkspaceDraftHydration({
    engines,
    requestedJobId,
    fromVideoId,
    effectiveRequestedEngineId,
    effectiveRequestedEngineToken,
    effectiveRequestedMode,
    storageScope,
    hydratedForScope,
    setHydratedForScope,
    readStorage,
    readScopedStorage,
    writeStorage,
    form,
    prompt,
    negativePrompt,
    multiPromptEnabled,
    multiPromptScenes,
    shotType,
    voiceIdsInput,
    memberTier,
    recentJobs,
    selectedPreview,
    rendersLength: renders.length,
    preserveStoredDraftRef,
    hasStoredFormRef,
    setForm,
    setPrompt,
    setNegativePrompt,
    setMultiPromptEnabled,
    setMultiPromptScenes,
    setShotType,
    setVoiceIdsInput,
    setMemberTier,
    setSelectedPreview,
    hydratePendingRendersFromStorage,
    resetRenderState,
  });

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
  }, [authChecked, router, skipOnboardingRef]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
  }, []);
  const replaceWorkspaceRoute = useCallback((href: string) => {
    router.replace(href);
  }, [router]);

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

  const {
    selectedEngine,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    isUnifiedHappyHorse,
    multiPromptTotalSec,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    voiceIds,
    voiceControlEnabled,
    promptMaxChars,
    promptCharLimitExceeded,
    seedValue,
    cameraFixedValue,
    safetyCheckerValue,
    effectivePrompt,
    hasLastFrameInput,
    audioWorkflowLocked,
    audioWorkflowUnsupported,
    activeManualMode,
    activeMode,
    allowsUnifiedVeoFirstLast,
    submissionMode,
    showSafetyCheckerControl,
    effectiveDurationSec,
    capability,
    supportsAudioToggle,
    engineModeOptions,
    composerModeToggles,
    showRetakeWorkflowAction,
    composerWorkflowNotice,
    handleMultiPromptAddScene,
    handleMultiPromptRemoveScene,
    handleMultiPromptUpdateScene,
    handleSeedChange,
    handleCameraFixedChange,
    handleSafetyCheckerChange,
    handleEngineChange,
    handleModeChange,
    handleComposerModeToggle,
    handleDurationChange,
    handleFramesChange,
    handleResolutionChange,
    handleAspectRatioChange,
    handleFpsChange,
  } = useWorkspaceComposerState({
    engines,
    form,
    setForm,
    inputAssets,
    prompt,
    multiPromptEnabled,
    setMultiPromptEnabled,
    multiPromptScenes,
    setMultiPromptScenes,
    voiceIdsInput,
    shotType,
    setShotType,
    effectiveRequestedEngineToken,
    authChecked,
    hydratedForScope,
    storageScope,
    hasStoredFormRef,
    preserveStoredDraftRef,
    requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef,
    requestedModeOverrideRef,
    writeStorage,
    uiLocale,
    workflowCopy,
    showNotice,
  });

  const {
    inputSchemaSummary,
    extraInputFields,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    referenceAudioFieldIds,
    primaryAssetFieldLabel,
    guestUploadLockedReason,
  } = useWorkspaceInputSchemaState({
    selectedEngine,
    activeMode,
    allowsUnifiedVeoFirstLast,
    isUnifiedHappyHorse,
    isUnifiedSeedance,
    uiLocale,
    authChecked,
    authLoading,
    authenticatedUserId: user?.id,
    uploadLockedCopy: workspaceCopy.authGate.uploadLocked,
    setInputAssets,
    setForm,
  });
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
      <WorkspaceBootSurface
        isDesktopLayout={isDesktopLayout}
        initialPreviewGroup={initialPreviewFallbackGroup}
        initialPreviewPosterSrc={compositePreviewPosterSrc}
      />
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
        <WorkspaceBootSurface
          isDesktopLayout={isDesktopLayout}
          initialPreviewGroup={initialPreviewFallbackGroup}
          initialPreviewPosterSrc={compositePreviewPosterSrc}
        />
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
              <WorkspaceCenterGallery
                show={showCenterGallery}
                groups={normalizedPendingGroups}
                engineMap={engineMap}
                isGenerationLoading={isGenerationLoading}
                generationSkeletonCount={generationSkeletonCount}
                emptyLabel={workspaceCopy.gallery.empty}
                onOpenGroup={handleActiveGroupOpen}
                onGroupAction={handleActiveGroupAction}
              />
              <WorkspacePreviewDock
                group={displayCompositeGroup}
                isLoading={isGenerationLoading && !displayCompositeGroup}
                autoPlayRequestId={previewAutoPlayRequestId}
                sharedPrompt={sharedPrompt}
                hasSharedVideoSettings={Boolean(sharedVideoSettings)}
                onCopySharedPrompt={handleCopySharedPrompt}
                guidedNavigation={guidedNavigation}
                engines={engines}
                engineId={form.engineId}
                selectedEngineId={selectedEngine.id}
                activeMode={activeMode}
                engineModeOptions={engineModeOptions}
                modeLabelLocale={uiLocale}
                onEngineChange={handleEngineChange}
                onModeChange={handleModeChange}
                renderGroups={renderGroups}
                compositeOverrideSummary={compositeOverrideSummary}
                setViewerTarget={setViewerTarget}
              />
              <WorkspaceComposerSurface
                selectedEngine={selectedEngine}
                form={form}
                setForm={setForm}
                prompt={prompt}
                setPrompt={setPrompt}
                negativePrompt={negativePrompt}
                setNegativePrompt={setNegativePrompt}
                price={price}
                currency={currency}
                isPricing={isPricing}
                preflightError={preflightError}
                preflight={preflight}
                composerRef={composerRef}
                startRender={startRender}
                inputSchemaSummary={inputSchemaSummary}
                inputAssets={inputAssets}
                isUnifiedSeedance={isUnifiedSeedance}
                workflowCopy={workflowCopy}
                guestUploadLockedReason={guestUploadLockedReason}
                uiLocale={uiLocale}
                composerModeToggles={composerModeToggles}
                activeManualMode={activeManualMode}
                handleComposerModeToggle={handleComposerModeToggle}
                composerWorkflowNotice={composerWorkflowNotice}
                handleAssetAdd={handleAssetAdd}
                handleAssetRemove={handleAssetRemove}
                handleOpenAssetLibrary={handleOpenAssetLibrary}
                showNotice={showNotice}
                supportsKlingV3Controls={supportsKlingV3Controls}
                supportsKlingV3VoiceControl={supportsKlingV3VoiceControl}
                multiPromptEnabled={multiPromptEnabled}
                setMultiPromptEnabled={setMultiPromptEnabled}
                multiPromptScenes={multiPromptScenes}
                multiPromptTotalSec={multiPromptTotalSec}
                multiPromptActive={multiPromptActive}
                multiPromptInvalid={multiPromptInvalid}
                multiPromptError={multiPromptError}
                handleMultiPromptAddScene={handleMultiPromptAddScene}
                handleMultiPromptRemoveScene={handleMultiPromptRemoveScene}
                handleMultiPromptUpdateScene={handleMultiPromptUpdateScene}
                audioWorkflowUnsupported={audioWorkflowUnsupported}
                audioWorkflowLocked={audioWorkflowLocked}
                showRetakeWorkflowAction={showRetakeWorkflowAction}
                activeMode={activeMode}
                submissionMode={submissionMode}
                capability={capability}
                handleDurationChange={handleDurationChange}
                handleFramesChange={handleFramesChange}
                handleResolutionChange={handleResolutionChange}
                handleAspectRatioChange={handleAspectRatioChange}
                handleFpsChange={handleFpsChange}
                supportsAudioToggle={supportsAudioToggle}
                voiceControlEnabled={voiceControlEnabled}
                cfgScale={cfgScale}
                setCfgScale={setCfgScale}
                shotType={shotType}
                setShotType={setShotType}
                voiceIdsInput={voiceIdsInput}
                setVoiceIdsInput={setVoiceIdsInput}
                isSeedance={isSeedance}
                seedValue={seedValue}
                handleSeedChange={handleSeedChange}
                cameraFixedValue={cameraFixedValue}
                handleCameraFixedChange={handleCameraFixedChange}
                safetyCheckerValue={safetyCheckerValue}
                handleSafetyCheckerChange={handleSafetyCheckerChange}
                showSafetyCheckerControl={showSafetyCheckerControl}
                klingElements={klingElements}
                handleKlingElementAdd={handleKlingElementAdd}
                handleKlingElementRemove={handleKlingElementRemove}
                handleKlingElementAssetAdd={handleKlingElementAssetAdd}
                handleKlingElementAssetRemove={handleKlingElementAssetRemove}
                handleOpenKlingAssetLibrary={handleOpenKlingAssetLibrary}
                setViewMode={setViewMode}
              />
            </div>
      </WorkspaceChrome>
      <WorkspaceRuntimeModals
        viewerGroup={viewerGroup}
        onCloseViewer={() => setViewerTarget(null)}
        onRefreshJob={handleRefreshJob}
        topUpModal={topUpModal}
        topUpCopy={workspaceCopy.topUp}
        currency={currency}
        topUpAmount={topUpAmount}
        isTopUpLoading={isTopUpLoading}
        topUpError={topUpError}
        onCloseTopUp={closeTopUpModal}
        onTopUpSubmit={handleTopUpSubmit}
        onSelectPresetAmount={handleSelectPresetAmount}
        onCustomAmountChange={handleCustomAmountChange}
        authModalOpen={authModalOpen}
        authGateCopy={workspaceCopy.authGate}
        loginRedirectTarget={loginRedirectTarget}
        onCloseAuthModal={() => setAuthModalOpen(false)}
        assetPickerTarget={assetPickerTarget}
        assetLibraryKind={assetLibraryKind}
        assetLibrarySource={assetLibrarySource}
        visibleAssetLibrary={visibleAssetLibrary}
        isAssetLibraryLoading={isAssetLibraryLoading}
        assetLibraryError={assetLibraryError}
        assetDeletePendingId={assetDeletePendingId}
        fieldFallbackLabel={workspaceCopy.assetLibrary.fieldFallback}
        onAssetLibrarySourceChange={handleAssetLibrarySourceChange}
        onCloseAssetLibrary={closeAssetLibrary}
        onRefreshAssets={fetchAssetLibrary}
        onSelectFieldAsset={handleSelectLibraryAsset}
        onSelectKlingAsset={handleSelectKlingLibraryAsset}
        onDeleteAsset={handleDeleteLibraryAsset}
      />
    </>
  );
}
