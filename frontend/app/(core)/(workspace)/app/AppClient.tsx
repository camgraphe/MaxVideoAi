'use client';

import type { VideoGroup } from '@/types/video-groups';
import { getWorkspaceAppLoadState } from './_components/WorkspaceAppLoadState';
import { WorkspaceAppReadyView } from './_components/WorkspaceAppReadyView';
import { useWorkspaceAppBootstrap } from './_hooks/useWorkspaceAppBootstrap';
import { useWorkspaceAssetState } from './_hooks/useWorkspaceAssetState';
import { useWorkspaceAssets } from './_hooks/useWorkspaceAssets';
import { useWorkspaceComposerState } from './_hooks/useWorkspaceComposerState';
import { useWorkspaceDraftHydration } from './_hooks/useWorkspaceDraftHydration';
import { useWorkspaceDraftStorage } from './_hooks/useWorkspaceDraftStorage';
import { useWorkspaceGalleryActions } from './_hooks/useWorkspaceGalleryActions';
import { useWorkspaceGenerationRunner } from './_hooks/useWorkspaceGenerationRunner';
import { useWorkspaceInputSchemaState } from './_hooks/useWorkspaceInputSchemaState';
import { useWorkspaceJobRefresh } from './_hooks/useWorkspaceJobRefresh';
import { useWorkspaceNotice } from './_hooks/useWorkspaceNotice';
import { useWorkspacePreviewState } from './_hooks/useWorkspacePreviewState';
import { useWorkspacePricingGate } from './_hooks/useWorkspacePricingGate';
import { useWorkspaceRenderState } from './_hooks/useWorkspaceRenderState';
import { useWorkspaceRouteNavigation } from './_hooks/useWorkspaceRouteNavigation';
import { useWorkspaceRouteFormState } from './_hooks/useWorkspaceRouteFormState';
import { useWorkspaceVideoSettings } from './_hooks/useWorkspaceVideoSettings';

export default function AppClientPage({
  initialPreviewGroup = null,
}: {
  initialPreviewGroup?: VideoGroup | null;
}) {
  const app = useWorkspaceAppBootstrap();
  const confirmedAccount =
    app.authStatus === 'authed' && app.user?.id && app.session?.access_token ? app.user.id : null;
  const draftOwner = confirmedAccount ?? (app.authStatus === 'loggedOut' ? 'public' : null);
  const routeForm = useWorkspaceRouteFormState(draftOwner);
  const assetState = useWorkspaceAssetState(confirmedAccount);
  const noticeState = useWorkspaceNotice();
  const draft = useWorkspaceDraftStorage({
    authLoading: app.authLoading,
    authStatus: app.authStatus,
    authenticatedUserId: app.user?.id,
  });
  const { replaceWorkspaceRoute } = useWorkspaceRouteNavigation({
    authChecked: draft.authChecked,
    skipOnboardingRef: draft.skipOnboardingRef,
  });
  const renderState = useWorkspaceRenderState({
    recentJobs: app.recentJobs,
    engineIdByLabel: app.engineIdByLabel,
    provider: app.provider,
    storageScope: draft.storageScope,
    hydratedForScope: draft.hydratedForScope,
    formIterations: routeForm.form?.iterations,
    compositeOverride: routeForm.compositeOverride,
    compositeOverrideSummary: routeForm.compositeOverrideSummary,
    writeScopedStorage: draft.writeScopedStorage,
    workspaceCopy: app.workspaceCopy,
  });

  const activeDraft = useWorkspaceDraftHydration({
    ...routeForm,
    ...assetState,
    authStatus: app.authStatus,
    accountId: confirmedAccount,
    accessToken: app.session?.access_token ?? null,
    locale: app.uiLocale,
    engines: app.engines,
    requestedJobId: draft.requestedJobId,
    fromVideoId: draft.fromVideoId,
    effectiveRequestedEngineId: draft.effectiveRequestedEngineId,
    effectiveRequestedEngineToken: draft.effectiveRequestedEngineToken,
    effectiveRequestedMode: draft.effectiveRequestedMode,
    storageScope: draft.storageScope,
    hydratedForScope: draft.hydratedForScope,
    setHydratedForScope: draft.setHydratedForScope,
    readStorage: draft.readStorage,
    readScopedStorage: draft.readScopedStorage,
    writeStorage: draft.writeStorage,
    recentJobs: app.recentJobs,
    selectedPreview: renderState.selectedPreview,
    rendersLength: renderState.renders.length,
    preserveStoredDraftRef: draft.preserveStoredDraftRef,
    hasStoredFormRef: draft.hasStoredFormRef,
    setSelectedPreview: renderState.setSelectedPreview,
    hydratePendingRendersFromStorage: renderState.hydratePendingRendersFromStorage,
    resetRenderState: renderState.resetRenderState,
  });

  const previewState = useWorkspacePreviewState({
    provider: app.provider,
    selectedPreview: renderState.selectedPreview,
    pendingSummaryMap: renderState.pendingSummaryMap,
    compositeOverride: routeForm.compositeOverride,
    activeVideoGroup: renderState.activeVideoGroup,
    initialPreviewGroup,
    effectiveRequestedEngineId: draft.effectiveRequestedEngineId,
    effectiveRequestedEngineToken: draft.effectiveRequestedEngineToken,
    requestedJobId: draft.requestedJobId,
    fromVideoId: draft.fromVideoId,
  });
  const handleRefreshJob = useWorkspaceJobRefresh();
  const videoSettings = useWorkspaceVideoSettings({
    ...routeForm,
    ...assetState,
    accountScope: confirmedAccount,
    activeDraftReady: activeDraft.ready,
    hasActiveSetup: activeDraft.hasActiveSetup,
    draftRevision: activeDraft.revision,
    engines: app.engines,
    engineMap: app.engineMap,
    provider: app.provider,
    fromVideoId: draft.fromVideoId,
    requestedJobId: draft.requestedJobId,
    searchString: draft.searchString,
    authChecked: draft.authChecked,
    hydratedForScope: draft.hydratedForScope,
    storageScope: draft.storageScope,
    effectiveRequestedEngineId: draft.effectiveRequestedEngineId,
    effectiveRequestedEngineToken: draft.effectiveRequestedEngineToken,
    rendersLength: renderState.renders.length,
    readScopedStorage: draft.readScopedStorage,
    writeScopedStorage: draft.writeScopedStorage,
    replaceRoute: replaceWorkspaceRoute,
    setSelectedPreview: renderState.setSelectedPreview,
    setNotice: noticeState.setNotice,
  });
  const composer = useWorkspaceComposerState({
    engines: app.engines,
    form: routeForm.form,
    setForm: routeForm.setForm,
    inputAssets: assetState.inputAssets,
    klingElements: routeForm.klingElements,
    prompt: routeForm.prompt,
    multiPromptEnabled: routeForm.multiPromptEnabled,
    setMultiPromptEnabled: routeForm.setMultiPromptEnabled,
    multiPromptScenes: routeForm.multiPromptScenes,
    setMultiPromptScenes: routeForm.setMultiPromptScenes,
    voiceIdsInput: routeForm.voiceIdsInput,
    shotType: routeForm.shotType,
    setShotType: routeForm.setShotType,
    effectiveRequestedEngineToken: draft.effectiveRequestedEngineToken,
    authChecked: draft.authChecked,
    hydratedForScope: draft.hydratedForScope,
    storageScope: draft.storageScope,
    preserveStoredDraftRef: draft.preserveStoredDraftRef,
    requestedEngineOverrideIdRef: draft.requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef: draft.requestedEngineOverrideTokenRef,
    requestedModeOverrideRef: draft.requestedModeOverrideRef,
    writeStorage: draft.writeStorage,
    uiLocale: app.uiLocale,
    workflowCopy: app.workflowCopy,
    showNotice: noticeState.showNotice,
  });
  const assets = useWorkspaceAssets({
    accountScope: confirmedAccount,
    userId: confirmedAccount,
    inputAssets: assetState.inputAssets,
    setInputAssets: assetState.setInputAssets,
    commitInputAssetMutation: assetState.commitInputAssetMutation,
    engineId: routeForm.form?.engineId,
    inputSchema: composer.selectedEngine?.inputSchema,
    preferredMode: composer.submissionMode,
    workflowCopy: app.workflowCopy,
    showNotice: noticeState.showNotice,
    klingElements: routeForm.klingElements,
    setKlingElements: routeForm.setKlingElements,
  });
  const inputSchema = useWorkspaceInputSchemaState({
    hydrationReady: activeDraft.ready,
    selectedEngine: composer.selectedEngine,
    activeMode: composer.activeMode,
    submissionMode: composer.submissionMode,
    allowsUnifiedVeoFirstLast: composer.allowsUnifiedVeoFirstLast,
    isUnifiedHappyHorse: composer.isUnifiedHappyHorse,
    isUnifiedSeedance: composer.isUnifiedSeedance,
    isUnifiedGeminiOmni: composer.isUnifiedGeminiOmni,
    uiLocale: app.uiLocale,
    authChecked: draft.authChecked,
    authLoading: app.authLoading,
    authenticatedUserId: app.user?.id,
    uploadLockedCopy: app.workspaceCopy.authGate.uploadLocked,
    setInputAssets: assets.setInputAssets,
    setForm: routeForm.setForm,
  });
  const pricing = useWorkspacePricingGate({
    accessToken: app.session?.access_token ?? null,
    locale: app.uiLocale,
    topUpCopy: app.workspaceCopy.topUp,
    form: routeForm.form,
    selectedEngine: composer.selectedEngine,
    authChecked: draft.authChecked,
    memberTier: routeForm.memberTier,
    setMemberTier: routeForm.setMemberTier,
    supportsAudioToggle: composer.supportsAudioToggle,
    effectiveDurationSec: composer.effectiveDurationSec,
    voiceControlEnabled: composer.voiceControlEnabled,
    submissionMode: composer.submissionMode,
    inputAssets: assets.inputAssets,
  });
  const generation = useWorkspaceGenerationRunner({
    audioWorkflowUnsupported: composer.audioWorkflowUnsupported,
    klingO3UnsupportedVideoReason: composer.klingO3UnsupportedVideoReason,
    form: activeDraft.ready ? routeForm.form : null,
    activeMode: composer.activeMode,
    submissionMode: composer.submissionMode,
    effectivePrompt: composer.effectivePrompt,
    effectiveDurationSec: composer.effectiveDurationSec,
    negativePrompt: routeForm.negativePrompt,
    selectedEngine: composer.selectedEngine,
    preflight: pricing.preflight,
    accessToken: app.session?.access_token ?? null,
    authChecked: draft.authChecked,
    memberTier: routeForm.memberTier,
    showComposerError: pricing.showComposerError,
    writeScopedStorage: draft.writeScopedStorage,
    mutateLatestJobs: app.mutateLatestJobs,
    inputSchemaSummary: inputSchema.inputSchemaSummary,
    extraInputFields: inputSchema.extraInputFields,
    inputAssets: assets.inputAssets,
    setAuthModalOpen: pricing.setAuthModalOpen,
    setPreflightError: pricing.setPreflightError,
    setTopUpModal: pricing.setTopUpModal,
    setActiveGroupId: renderState.setActiveGroupId,
    setActiveBatchId: renderState.setActiveBatchId,
    setBatchHeroes: renderState.setBatchHeroes,
    setRenders: renderState.setRenders,
    setSelectedPreview: renderState.setSelectedPreview,
    setViewMode: renderState.setViewMode,
    rendersRef: renderState.rendersRef,
    uiLocale: app.uiLocale,
    workflowCopy: app.workflowCopy,
    workspaceCopy: app.workspaceCopy,
    capability: composer.capability,
    cfgScale: routeForm.cfgScale,
    formatTakeLabel: app.formatTakeLabel,
    primaryAssetFieldLabel: inputSchema.primaryAssetFieldLabel,
    primaryAssetFieldIds: inputSchema.primaryAssetFieldIds,
    referenceAssetFieldIds: inputSchema.referenceAssetFieldIds,
    referenceAudioFieldIds: inputSchema.referenceAudioFieldIds,
    genericImageFieldIds: inputSchema.genericImageFieldIds,
    frameAssetFieldIds: inputSchema.frameAssetFieldIds,
    allowsUnifiedVeoFirstLast: composer.allowsUnifiedVeoFirstLast,
    hasLastFrameInput: composer.hasLastFrameInput,
    supportsAudioToggle: composer.supportsAudioToggle,
    multiPromptActive: composer.multiPromptActive,
    multiPromptInvalid: composer.multiPromptInvalid,
    multiPromptError: composer.multiPromptError,
    multiPromptScenes: routeForm.multiPromptScenes,
    supportsKlingV3Controls: composer.supportsKlingV3Controls,
    supportsKlingV3VoiceControl: composer.supportsKlingV3VoiceControl,
    isSeedance: composer.isSeedance,
    isUnifiedSeedance: composer.isUnifiedSeedance,
    promptLength: routeForm.prompt.length,
    promptCharLimitExceeded: composer.promptCharLimitExceeded,
    promptMaxChars: composer.promptMaxChars,
    voiceIds: composer.voiceIds,
    voiceControlEnabled: composer.voiceControlEnabled,
    shotType: routeForm.shotType,
    klingElements: routeForm.klingElements,
  });
  const gallery = useWorkspaceGalleryActions({
    provider: app.provider,
    renderGroups: renderState.renderGroups,
    batchHeroes: renderState.batchHeroes,
    preflightCurrency: pricing.preflight?.currency,
    fallbackEngineId: composer.selectedEngine?.id ?? 'unknown-engine',
    sharedPrompt: routeForm.sharedPrompt,
    selectedPreview: renderState.selectedPreview,
    compositeOverrideSummary: routeForm.compositeOverrideSummary,
    applyVideoSettingsFromTile: videoSettings.applyVideoSettingsFromTile,
    hydrateVideoSettingsFromJob: videoSettings.hydrateVideoSettingsFromJob,
    focusComposer: routeForm.focusComposer,
    showNotice: noticeState.showNotice,
    writeScopedStorage: draft.writeScopedStorage,
    setPrompt: routeForm.setPrompt,
    setActiveGroupId: renderState.setActiveGroupId,
    setViewMode: renderState.setViewMode,
    setActiveBatchId: renderState.setActiveBatchId,
    setBatchHeroes: renderState.setBatchHeroes,
    setSelectedPreview: renderState.setSelectedPreview,
    setCompositeOverride: routeForm.setCompositeOverride,
    setCompositeOverrideSummary: routeForm.setCompositeOverrideSummary,
    setSharedPrompt: routeForm.setSharedPrompt,
  });
  const loadState = getWorkspaceAppLoadState({
    authLoading: app.authLoading,
    engineCount: app.engines.length,
    enginesError: app.enginesError,
    hasForm: activeDraft.ready && Boolean(routeForm.form),
    hasSelectedEngine: Boolean(composer.selectedEngine),
    initialPreviewFallbackGroup: previewState.initialPreviewFallbackGroup,
    initialPreviewPosterSrc: previewState.compositePreviewPosterSrc,
    isLoading: app.isLoading,
    loadEnginesError: app.workspaceCopy.errors.loadEngines,
    noEnginesError: app.workspaceCopy.errors.noEngines,
  });

  return (
    <>
      {loadState}
      <WorkspaceAppReadyView
        suspended={Boolean(loadState)}
        activeDraft={activeDraft}
        app={app}
        assets={assets}
        composer={composer}
        draft={draft}
        gallery={gallery}
        generation={generation}
        handleRefreshJob={handleRefreshJob}
        inputSchema={inputSchema}
        noticeState={noticeState}
        previewState={previewState}
        pricing={pricing}
        renderState={renderState}
        routeForm={routeForm}
      />
    </>
  );
}
