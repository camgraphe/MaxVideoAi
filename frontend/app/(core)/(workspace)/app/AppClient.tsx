'use client';

import type { VideoGroup } from '@/types/video-groups';
import { getWorkspaceAppLoadState } from './_components/WorkspaceAppLoadState';
import { WorkspaceAppReadyView } from './_components/WorkspaceAppReadyView';
import { useWorkspaceAppBootstrap } from './_hooks/useWorkspaceAppBootstrap';
import { useWorkspaceAssets } from './_hooks/useWorkspaceAssets';
import { useWorkspaceComposerState } from './_hooks/useWorkspaceComposerState';
import { useWorkspaceDesktopLayout } from './_hooks/useWorkspaceDesktopLayout';
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

export default function AppClientPage({ initialPreviewGroup = null }: { initialPreviewGroup?: VideoGroup | null }) {
  const app = useWorkspaceAppBootstrap();
  const routeForm = useWorkspaceRouteFormState();
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
  const isDesktopLayout = useWorkspaceDesktopLayout();
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
  });

  useWorkspaceDraftHydration({
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
    form: routeForm.form,
    prompt: routeForm.prompt,
    negativePrompt: routeForm.negativePrompt,
    multiPromptEnabled: routeForm.multiPromptEnabled,
    multiPromptScenes: routeForm.multiPromptScenes,
    shotType: routeForm.shotType,
    voiceIdsInput: routeForm.voiceIdsInput,
    memberTier: routeForm.memberTier,
    recentJobs: app.recentJobs,
    selectedPreview: renderState.selectedPreview,
    rendersLength: renderState.renders.length,
    preserveStoredDraftRef: draft.preserveStoredDraftRef,
    hasStoredFormRef: draft.hasStoredFormRef,
    setForm: routeForm.setForm,
    setPrompt: routeForm.setPrompt,
    setNegativePrompt: routeForm.setNegativePrompt,
    setMultiPromptEnabled: routeForm.setMultiPromptEnabled,
    setMultiPromptScenes: routeForm.setMultiPromptScenes,
    setShotType: routeForm.setShotType,
    setVoiceIdsInput: routeForm.setVoiceIdsInput,
    setMemberTier: routeForm.setMemberTier,
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
  const assets = useWorkspaceAssets({
    engineId: routeForm.form?.engineId,
    workflowCopy: app.workflowCopy,
    showNotice: noticeState.showNotice,
    klingElements: routeForm.klingElements,
    setKlingElements: routeForm.setKlingElements,
  });
  const handleRefreshJob = useWorkspaceJobRefresh();
  const videoSettings = useWorkspaceVideoSettings({
    engines: app.engines,
    engineMap: app.engineMap,
    provider: app.provider,
    fromVideoId: draft.fromVideoId,
    requestedJobId: draft.requestedJobId,
    searchString: draft.searchString,
    sharedVideoSettings: routeForm.sharedVideoSettings,
    authChecked: draft.authChecked,
    hydratedForScope: draft.hydratedForScope,
    storageScope: draft.storageScope,
    effectiveRequestedEngineId: draft.effectiveRequestedEngineId,
    effectiveRequestedEngineToken: draft.effectiveRequestedEngineToken,
    rendersLength: renderState.renders.length,
    compositeOverride: routeForm.compositeOverride,
    compositeOverrideSummary: routeForm.compositeOverrideSummary,
    focusComposer: routeForm.focusComposer,
    readScopedStorage: draft.readScopedStorage,
    writeScopedStorage: draft.writeScopedStorage,
    replaceRoute: replaceWorkspaceRoute,
    setPrompt: routeForm.setPrompt,
    setNegativePrompt: routeForm.setNegativePrompt,
    setMemberTier: routeForm.setMemberTier,
    setCfgScale: routeForm.setCfgScale,
    setShotType: routeForm.setShotType,
    setVoiceIdsInput: routeForm.setVoiceIdsInput,
    setMultiPromptEnabled: routeForm.setMultiPromptEnabled,
    setMultiPromptScenes: routeForm.setMultiPromptScenes,
    setForm: routeForm.setForm,
    setInputAssets: assets.setInputAssets,
    setKlingElements: routeForm.setKlingElements,
    setSelectedPreview: renderState.setSelectedPreview,
    setCompositeOverride: routeForm.setCompositeOverride,
    setCompositeOverrideSummary: routeForm.setCompositeOverrideSummary,
    setSharedPrompt: routeForm.setSharedPrompt,
    setSharedVideoSettings: routeForm.setSharedVideoSettings,
    setNotice: noticeState.setNotice,
  });
  const composer = useWorkspaceComposerState({
    engines: app.engines,
    form: routeForm.form,
    setForm: routeForm.setForm,
    inputAssets: assets.inputAssets,
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
    hasStoredFormRef: draft.hasStoredFormRef,
    preserveStoredDraftRef: draft.preserveStoredDraftRef,
    requestedEngineOverrideIdRef: draft.requestedEngineOverrideIdRef,
    requestedEngineOverrideTokenRef: draft.requestedEngineOverrideTokenRef,
    requestedModeOverrideRef: draft.requestedModeOverrideRef,
    writeStorage: draft.writeStorage,
    uiLocale: app.uiLocale,
    workflowCopy: app.workflowCopy,
    showNotice: noticeState.showNotice,
  });
  const inputSchema = useWorkspaceInputSchemaState({
    selectedEngine: composer.selectedEngine,
    activeMode: composer.activeMode,
    allowsUnifiedVeoFirstLast: composer.allowsUnifiedVeoFirstLast,
    isUnifiedHappyHorse: composer.isUnifiedHappyHorse,
    isUnifiedSeedance: composer.isUnifiedSeedance,
    uiLocale: app.uiLocale,
    authChecked: draft.authChecked,
    authLoading: app.authLoading,
    authenticatedUserId: app.user?.id,
    uploadLockedCopy: app.workspaceCopy.authGate.uploadLocked,
    setInputAssets: assets.setInputAssets,
    setForm: routeForm.setForm,
  });
  const pricing = useWorkspacePricingGate({
    form: routeForm.form,
    selectedEngine: composer.selectedEngine,
    authChecked: draft.authChecked,
    memberTier: routeForm.memberTier,
    setMemberTier: routeForm.setMemberTier,
    supportsAudioToggle: composer.supportsAudioToggle,
    effectiveDurationSec: composer.effectiveDurationSec,
    voiceControlEnabled: composer.voiceControlEnabled,
    submissionMode: composer.submissionMode,
    showNotice: noticeState.showNotice,
  });
  const generation = useWorkspaceGenerationRunner({
    audioWorkflowUnsupported: composer.audioWorkflowUnsupported,
    form: routeForm.form,
    activeMode: composer.activeMode,
    submissionMode: composer.submissionMode,
    effectivePrompt: composer.effectivePrompt,
    effectiveDurationSec: composer.effectiveDurationSec,
    negativePrompt: routeForm.negativePrompt,
    selectedEngine: composer.selectedEngine,
    preflight: pricing.preflight,
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
    engineCount: app.engines.length,
    enginesError: app.enginesError,
    hasForm: Boolean(routeForm.form),
    hasSelectedEngine: Boolean(composer.selectedEngine),
    initialPreviewFallbackGroup: previewState.initialPreviewFallbackGroup,
    initialPreviewPosterSrc: previewState.compositePreviewPosterSrc,
    isDesktopLayout,
    isLoading: app.isLoading,
    loadEnginesError: app.workspaceCopy.errors.loadEngines,
    noEnginesError: app.workspaceCopy.errors.noEngines,
  });

  if (loadState) return loadState;

  return (
    <WorkspaceAppReadyView
      app={app}
      assets={assets}
      composer={composer}
      draft={draft}
      gallery={gallery}
      generation={generation}
      handleRefreshJob={handleRefreshJob}
      inputSchema={inputSchema}
      isDesktopLayout={isDesktopLayout}
      noticeState={noticeState}
      previewState={previewState}
      pricing={pricing}
      renderState={renderState}
      routeForm={routeForm}
    />
  );
}
