'use client';

import { WorkspaceAppShell } from './WorkspaceAppShell';
import { WorkspaceComposerSurface } from './WorkspaceComposerSurface';
import { WorkspaceRuntimeModals } from './WorkspaceRuntimeModals';
import type { useWorkspaceAppBootstrap } from '../_hooks/useWorkspaceAppBootstrap';
import type { useWorkspaceAssets } from '../_hooks/useWorkspaceAssets';
import type { useWorkspaceComposerState } from '../_hooks/useWorkspaceComposerState';
import type { useWorkspaceDraftStorage } from '../_hooks/useWorkspaceDraftStorage';
import type { useWorkspaceGalleryActions } from '../_hooks/useWorkspaceGalleryActions';
import type { useWorkspaceGenerationRunner } from '../_hooks/useWorkspaceGenerationRunner';
import type { useWorkspaceInputSchemaState } from '../_hooks/useWorkspaceInputSchemaState';
import type { useWorkspaceJobRefresh } from '../_hooks/useWorkspaceJobRefresh';
import type { useWorkspaceNotice } from '../_hooks/useWorkspaceNotice';
import type { useWorkspacePreviewState } from '../_hooks/useWorkspacePreviewState';
import type { useWorkspacePricingGate } from '../_hooks/useWorkspacePricingGate';
import type { useWorkspaceRenderState } from '../_hooks/useWorkspaceRenderState';
import type { useWorkspaceRouteFormState } from '../_hooks/useWorkspaceRouteFormState';
import { buildWorkspaceInProgressMessage } from '../_lib/workspace-copy';

type WorkspaceAppReadyViewProps = {
  app: ReturnType<typeof useWorkspaceAppBootstrap>;
  assets: ReturnType<typeof useWorkspaceAssets>;
  composer: ReturnType<typeof useWorkspaceComposerState>;
  draft: ReturnType<typeof useWorkspaceDraftStorage>;
  gallery: ReturnType<typeof useWorkspaceGalleryActions>;
  generation: ReturnType<typeof useWorkspaceGenerationRunner>;
  handleRefreshJob: ReturnType<typeof useWorkspaceJobRefresh>;
  inputSchema: ReturnType<typeof useWorkspaceInputSchemaState>;
  isDesktopLayout: boolean;
  noticeState: ReturnType<typeof useWorkspaceNotice>;
  previewState: ReturnType<typeof useWorkspacePreviewState>;
  pricing: ReturnType<typeof useWorkspacePricingGate>;
  renderState: ReturnType<typeof useWorkspaceRenderState>;
  routeForm: ReturnType<typeof useWorkspaceRouteFormState>;
};

export function WorkspaceAppReadyView({
  app,
  assets,
  composer,
  draft,
  gallery,
  generation,
  handleRefreshJob,
  inputSchema,
  isDesktopLayout,
  noticeState,
  previewState,
  pricing,
  renderState,
  routeForm,
}: WorkspaceAppReadyViewProps) {
  const { engineMap, engineScores, engines, showCenterGallery, uiLocale, workflowCopy, workspaceCopy } = app;
  const { loginRedirectTarget } = draft;
  const { notice, showNotice } = noticeState;
  const {
    assetDeletePendingId,
    assetLibraryError,
    assetLibraryKind,
    assetLibrarySource,
    assetPickerTarget,
    closeAssetLibrary,
    fetchAssetLibrary,
    handleAssetAdd,
    handleAssetLibrarySourceChange,
    handleAssetRemove,
    handleDeleteLibraryAsset,
    handleKlingElementAdd,
    handleKlingElementAssetAdd,
    handleKlingElementAssetRemove,
    handleKlingElementRemove,
    handleOpenAssetLibrary,
    handleOpenKlingAssetLibrary,
    handleSelectKlingLibraryAsset,
    handleSelectLibraryAsset,
    inputAssets,
    isAssetLibraryLoading,
    visibleAssetLibrary,
  } = assets;
  const {
    isGenerationLoading,
    generationSkeletonCount,
    normalizedPendingGroups,
    pendingGroups,
    renderGroups,
    setViewMode,
  } = renderState;
  const inProgressMessage = buildWorkspaceInProgressMessage(pendingGroups.length, workspaceCopy);
  const { displayCompositeGroup, setViewerTarget, viewerGroup } = previewState;
  const {
    form,
    setForm,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    multiPromptEnabled,
    setMultiPromptEnabled,
    multiPromptScenes,
    shotType,
    setShotType,
    voiceIdsInput,
    setVoiceIdsInput,
    klingElements,
    cfgScale,
    setCfgScale,
    sharedPrompt,
    sharedVideoSettings,
    compositeOverrideSummary,
    composerRef,
  } = routeForm;
  const {
    activeManualMode,
    activeMode,
    audioWorkflowLocked,
    audioWorkflowUnsupported,
    cameraFixedValue,
    capability,
    composerModeToggles,
    composerWorkflowNotice,
    engineModeOptions,
    handleAspectRatioChange,
    handleCameraFixedChange,
    handleComposerModeToggle,
    handleDurationChange,
    handleEngineChange,
    handleFpsChange,
    handleFramesChange,
    handleModeChange,
    handleMultiPromptAddScene,
    handleMultiPromptRemoveScene,
    handleMultiPromptUpdateScene,
    handleResolutionChange,
    handleSafetyCheckerChange,
    handleSeedChange,
    isSeedance,
    isUnifiedKlingO3,
    isUnifiedSeedance,
    klingO3DisabledEngineReasons,
    klingO3UnsupportedVideoReason,
    multiPromptActive,
    multiPromptError,
    multiPromptInvalid,
    multiPromptTotalSec,
    safetyCheckerValue,
    seedValue,
    selectedEngine,
    showRetakeWorkflowAction,
    showSafetyCheckerControl,
    submissionMode,
    supportsAudioToggle,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    voiceControlEnabled,
  } = composer;
  const {
    guestUploadLockedReason,
    inputSchemaSummary,
  } = inputSchema;
  const {
    authModalOpen,
    checkoutCaptchaError,
    checkoutCaptchaRequired,
    checkoutCaptchaResetGeneration,
    checkoutCaptchaToken,
    closeTopUpModal,
    currency,
    handleCheckoutCaptchaError,
    handleCheckoutCaptchaToken,
    handleCustomAmountChange,
    handleSelectPresetAmount,
    handleTopUpSubmit,
    isPricing,
    isTopUpLoading,
    preflight,
    preflightError,
    price,
    setAuthModalOpen,
    topUpAmount,
    topUpError,
    topUpModal,
  } = pricing;
  const {
    guidedNavigation,
    handleActiveGroupAction,
    handleActiveGroupOpen,
    handleCopySharedPrompt,
    handleGalleryFeedStateChange,
    handleGalleryGroupAction,
    openGroupViaGallery,
    previewAutoPlayRequestId,
  } = gallery;

  if (!selectedEngine || !form) return null;

  return (
    <>
      <WorkspaceAppShell
        isDesktopLayout={isDesktopLayout}
        selectedEngine={selectedEngine}
        engines={engines}
        normalizedPendingGroups={normalizedPendingGroups}
        openGroupViaGallery={openGroupViaGallery}
        handleGalleryGroupAction={handleGalleryGroupAction}
        handleGalleryFeedStateChange={handleGalleryFeedStateChange}
        notice={notice}
        showCenterGallery={showCenterGallery}
        engineMap={engineMap}
        isGenerationLoading={isGenerationLoading}
        generationSkeletonCount={generationSkeletonCount}
        galleryEmptyLabel={workspaceCopy.gallery.empty}
        handleActiveGroupOpen={handleActiveGroupOpen}
        handleActiveGroupAction={handleActiveGroupAction}
        displayCompositeGroup={displayCompositeGroup}
        previewAutoPlayRequestId={previewAutoPlayRequestId}
        sharedPrompt={sharedPrompt}
        hasSharedVideoSettings={Boolean(sharedVideoSettings)}
        handleCopySharedPrompt={handleCopySharedPrompt}
        guidedNavigation={guidedNavigation}
        engineId={form.engineId}
        selectedEngineId={selectedEngine.id}
        activeMode={activeMode}
        engineModeOptions={engineModeOptions}
        modeLabelLocale={uiLocale}
        handleEngineChange={handleEngineChange}
        handleModeChange={handleModeChange}
        disabledEngineReasons={klingO3DisabledEngineReasons}
        engineScores={engineScores}
        renderGroups={renderGroups}
        compositeOverrideSummary={compositeOverrideSummary}
        setViewerTarget={setViewerTarget}
        composerSurface={
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
            startRender={generation.startRender}
            inputSchemaSummary={inputSchemaSummary}
            inputAssets={inputAssets}
            isUnifiedSeedance={isUnifiedSeedance}
            isUnifiedKlingO3={isUnifiedKlingO3}
            klingO3UnsupportedVideoReason={klingO3UnsupportedVideoReason}
            workflowCopy={workflowCopy}
            guestUploadLockedReason={guestUploadLockedReason}
            uiLocale={uiLocale}
            composerModeToggles={composerModeToggles}
            activeManualMode={activeManualMode}
            handleComposerModeToggle={handleComposerModeToggle}
            composerWorkflowNotice={composerWorkflowNotice}
            inProgressMessage={inProgressMessage}
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
        }
      />
      <WorkspaceRuntimeModals
        viewerGroup={viewerGroup}
        onCloseViewer={() => setViewerTarget(null)}
        onRefreshJob={handleRefreshJob}
        topUpModal={topUpModal}
        topUpCopy={workspaceCopy.topUp}
        currency="USD"
        topUpAmount={topUpAmount}
        isTopUpLoading={isTopUpLoading}
        topUpError={topUpError}
        checkoutCaptchaError={checkoutCaptchaError}
        checkoutCaptchaRequired={checkoutCaptchaRequired}
        checkoutCaptchaResetGeneration={checkoutCaptchaResetGeneration}
        checkoutCaptchaToken={checkoutCaptchaToken}
        onCheckoutCaptchaError={handleCheckoutCaptchaError}
        onCheckoutCaptchaToken={handleCheckoutCaptchaToken}
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
