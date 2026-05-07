'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEngines, useInfiniteJobs, getJobStatus } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { useRouter } from 'next/navigation';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import { SettingsControls } from '@/components/SettingsControls';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import {
  Composer,
  type MultiPromptScene,
} from '@/components/Composer';
import type { KlingElementState, KlingElementsBuilderProps } from '@/components/KlingElementsBuilder';
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
import { Button } from '@/components/ui/Button';
import {
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
} from '@/lib/luma-ray2';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  getSeedanceFieldBlockKey,
  SEEDANCE_REFERENCE_AUDIO_FIELD_IDS,
} from '@/lib/seedance-workflow';
import {
  getLocalizedModeLabel,
  getLocalizedWorkflowCopy,
  normalizeUiLocale,
} from '@/lib/ltx-localization';
import { WorkspaceBootSurface } from './_components/WorkspaceBootSurface';
import { WorkspaceCenterGallery } from './_components/WorkspaceCenterGallery';
import { WorkspaceChrome } from './_components/WorkspaceChrome';
import {
  GalleryRailSkeleton,
} from './_components/WorkspaceBootSkeletons';
import { WorkspacePreviewDock } from './_components/WorkspacePreviewDock';
import type { WorkspaceViewerTarget } from './_components/WorkspacePreviewDock';
import { WorkspaceRuntimeModals } from './_components/WorkspaceRuntimeModals';
import { getCompositePreviewPosterSrc } from './_lib/composite-preview';
import {
  normalizeExtraInputValue,
  type FormState,
} from './_lib/workspace-form-state';
import {
  buildAssetFieldIdSet,
  buildComposerAttachments,
  buildReferenceAudioFieldIds,
  getPrimaryAssetFieldLabel,
  revokeAssetPreview,
  type ReferenceAsset,
} from './_lib/workspace-assets';
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
  MULTI_PROMPT_MAX_SEC,
  MULTI_PROMPT_MIN_SEC,
} from './_lib/workspace-input-helpers';
import {
  buildComposerPromotedActions,
  summarizeWorkspaceInputSchema,
} from './_lib/workspace-input-schema';
import { useWorkspaceAssets } from './_hooks/useWorkspaceAssets';
import { useWorkspaceComposerState } from './_hooks/useWorkspaceComposerState';
import { useWorkspaceDesktopLayout } from './_hooks/useWorkspaceDesktopLayout';
import { useWorkspaceDraftHydration } from './_hooks/useWorkspaceDraftHydration';
import { useWorkspaceDraftStorage } from './_hooks/useWorkspaceDraftStorage';
import { useWorkspaceGalleryActions } from './_hooks/useWorkspaceGalleryActions';
import { useWorkspaceGenerationRunner } from './_hooks/useWorkspaceGenerationRunner';
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

const KlingElementsBuilder = dynamic<KlingElementsBuilderProps>(
  () => import('@/components/KlingElementsBuilder').then((mod) => mod.KlingElementsBuilder),
  { ssr: false }
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
