'use client';

import { useSeedanceDraftWorkflow } from '../_hooks/useSeedanceDraftWorkflow';
import { SeedanceDraftFinalAction } from '@/components/library/SeedanceDraftFinalAction.client';
import { Button } from '@/components/ui/Button';
import { useMemo } from 'react';
import { useSeedanceDraftLocalPreview } from '../_hooks/useSeedanceDraftLocalPreview';
import { SeedanceDraftLocalPreviewResult } from './SeedanceDraftLocalPreviewResult.client';
import dynamic from 'next/dynamic';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import type { useWorkspaceDraftHydration } from '../_hooks/useWorkspaceDraftHydration';
import { WorkspaceActiveDraftStatus } from './WorkspaceActiveDraftStatus';
import { useWorkspaceModelReview } from '../_hooks/useWorkspaceModelReview';
import { WorkspaceModelReviewCommands } from './WorkspaceModelReviewCommands';
import { WorkspaceAppShell } from './WorkspaceAppShell';
import { WorkspaceRecentReferences } from './WorkspaceRecentReferences.client';
import { getKlingO3AssetState, supportsKlingO3VideoToVideo } from '../_lib/kling-o3-unified-workflow';
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
import { formatWorkspaceTopupPaymentAmount } from '../_lib/workspace-topup';

const WorkspaceModelReview = dynamic(() => import('./WorkspaceModelReview.client').then(module => module.WorkspaceModelReview), { ssr: false });

type WorkspaceAppReadyViewProps = {
  localSeedanceDraftPreview?: boolean;
  localSeedanceDraftWorkflow?: boolean;
  suspended: boolean;
  activeDraft: ReturnType<typeof useWorkspaceDraftHydration>;
  app: ReturnType<typeof useWorkspaceAppBootstrap>;
  assets: ReturnType<typeof useWorkspaceAssets>;
  composer: ReturnType<typeof useWorkspaceComposerState>;
  draft: ReturnType<typeof useWorkspaceDraftStorage>;
  gallery: ReturnType<typeof useWorkspaceGalleryActions>;
  generation: ReturnType<typeof useWorkspaceGenerationRunner>;
  handleRefreshJob: ReturnType<typeof useWorkspaceJobRefresh>;
  inputSchema: ReturnType<typeof useWorkspaceInputSchemaState>;
  noticeState: ReturnType<typeof useWorkspaceNotice>;
  previewState: ReturnType<typeof useWorkspacePreviewState>;
  pricing: ReturnType<typeof useWorkspacePricingGate>;
  renderState: ReturnType<typeof useWorkspaceRenderState>;
  routeForm: ReturnType<typeof useWorkspaceRouteFormState>;
};

export function WorkspaceAppReadyView({
  localSeedanceDraftPreview = false,
  localSeedanceDraftWorkflow = false,
  suspended,
  activeDraft,
  app,
  assets,
  composer,
  draft,
  gallery,
  generation,
  handleRefreshJob,
  inputSchema,
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
    assetLibraryHasMore,
    assetLibraryKind,
    assetLibrarySource,
    assetPickerTarget,
    closeAssetLibrary,
    fetchAssetLibrary,
    loadMoreAssetLibrary,
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
    isAssetLibraryLoadingMore,
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
    topUpChargeCurrency,
    topUpError,
    topUpModal,
    topUpPaymentAmountMinor,
    topUpQuoteError,
    topUpQuoteLoading,
  } = pricing;
  const topUpPaymentAmountLabel = topUpModal && typeof topUpPaymentAmountMinor === 'number'
    && Number.isFinite(topUpPaymentAmountMinor) && topUpChargeCurrency
      ? formatWorkspaceTopupPaymentAmount(topUpPaymentAmountMinor, topUpChargeCurrency, uiLocale)
      : null;
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

  const currentSetup = useMemo(
    () => form ? { form, inputAssets, klingElements, prompt, negativePrompt, multiPromptEnabled, multiPromptScenes, shotType, voiceIdsInput, cfgScale } : null,
    [form, inputAssets, klingElements, prompt, negativePrompt, multiPromptEnabled, multiPromptScenes, shotType, voiceIdsInput, cfgScale],
  );
  const modelReview = useWorkspaceModelReview({
    recoverySetup: activeDraft.recoverySetup,
    onRemoveRecovery: activeDraft.removeRecovery,
    current: currentSetup,
    engines, locale: uiLocale, authStatus: app.authStatus,
    onGuestEngineChange: composer.handleEngineChange, onRequestAuth: () => setAuthModalOpen(true),
    onModelSwitchNotice: showNotice,
    accountId: app.authStatus === 'authed' && app.session?.access_token ? app.user?.id ?? null : null,
    accessToken: app.authStatus === 'authed' ? app.session?.access_token ?? null : null,
    memberTier: routeForm.memberTier, disabledEngineReasons: klingO3DisabledEngineReasons, engineScores,
    applyPreparedForm: composer.applyPreparedForm, setInputAssets: assets.setInputAssets,
    setKlingElements: routeForm.setKlingElements, setPrompt, setNegativePrompt, setMultiPromptEnabled,
    setMultiPromptScenes: routeForm.setMultiPromptScenes, setShotType, setVoiceIdsInput, setCfgScale,
  });
  const draftPreview = useSeedanceDraftLocalPreview({
    enabled: localSeedanceDraftPreview,
    form, engineId: selectedEngine?.id, mode: submissionMode, prompt,
    onResolutionChange: handleResolutionChange, showNotice,
  });
  const workflowAccount = app.authStatus === 'authed' && app.user?.id && app.session?.access_token
    ? { userId: app.user.id, token: app.session.access_token } : null;
  const draftWorkflow = useSeedanceDraftWorkflow({ enabled: localSeedanceDraftWorkflow && !localSeedanceDraftPreview,
    form, engineId: selectedEngine?.id, mode: submissionMode, prompt, account: workflowAccount,
    onResolutionChange: handleResolutionChange, showNotice });
  const draftControls = localSeedanceDraftPreview ? draftPreview : localSeedanceDraftWorkflow ? draftWorkflow : undefined;
  if (suspended || !selectedEngine || !form) return null;

  return (
    <>
      <WorkspaceRecentReferences userId={app.user?.id} locale={uiLocale} engineId={selectedEngine.id} engine={selectedEngine}
        fields={inputSchemaSummary.assetFields} inputAssets={inputAssets} inputSchema={selectedEngine.inputSchema}
        mode={submissionMode} onInsert={handleSelectLibraryAsset} availability={{
          inputAssets, isUnifiedSeedance, isUnifiedKlingO3, guestUploadLockedReason, workflowCopy,
          klingO3VideoToVideoSupported: supportsKlingO3VideoToVideo(selectedEngine),
          hasAnyVideoInput: getKlingO3AssetState({ inputAssets, klingElements }).hasAnyVideoInput,
          showOmniStudioPanel: selectedEngine.id === 'gemini-omni-flash',
          previousInteractionId: form.extraInputValues.previous_interaction_id,
          showLumaRay32KeyframeEditor: selectedEngine.id === 'luma-ray-3-2' && submissionMode === 'v2v',
        }}>
      {({ recentMedia, recentDropProps, refreshRecentMedia }) => <WorkspaceAppShell
        recentMedia={recentMedia}
        onOpenRecentMedia={refreshRecentMedia}
        recentDropProps={recentDropProps}
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
        handleEngineChange={modelReview.switchModel}
        modelReviewCommands={
          <>
            {draftControls?.selected ? (
              <div className="relative">
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-accent)]">Mode Draft</span>
                <WorkspaceModelReviewCommands review={modelReview} locale={uiLocale} />
              </div>
            ) : <WorkspaceModelReviewCommands review={modelReview} locale={uiLocale} />}
            <WorkspaceActiveDraftStatus draft={activeDraft} locale={uiLocale} openRecovery={() => modelReview.open('saved')} />
          </>
        }
        handleModeChange={handleModeChange}
        disabledEngineReasons={modelReview.selectorDisabledReasons}
        engineScores={engineScores}
        renderGroups={renderGroups}
        compositeOverrideSummary={compositeOverrideSummary}
        setViewerTarget={setViewerTarget}
        composerSurface={
          <WorkspaceComposerSurface
            localDraftPreview={draftControls}
            selectedEngine={selectedEngine}
            form={form}
            setForm={setForm}
            prompt={prompt}
            setPrompt={setPrompt}
            negativePrompt={negativePrompt}
            setNegativePrompt={setNegativePrompt}
            price={draftWorkflow.selected ? draftWorkflow.price : price}
            currency={draftWorkflow.selected ? draftWorkflow.currency : currency}
            isPricing={draftWorkflow.selected ? draftWorkflow.isPricing : isPricing}
            isSubmitting={generation.isSubmitting || draftWorkflow.pending}
            preflightError={draftWorkflow.selected ? draftWorkflow.error ?? undefined : preflightError}
            preflight={draftWorkflow.selected ? draftWorkflow.preflight : preflight}
            composerRef={composerRef}
            startRender={localSeedanceDraftPreview ? draftPreview.generate : draftWorkflow.selected ? draftWorkflow.generate : generation.startRender}
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
        previewSupplement={draftWorkflow.selected && draftWorkflow.draftId ? <div>
          {draftWorkflow.canResume ? <Button size="sm" variant="outline" onClick={() => void draftWorkflow.resume()}>Réessayer l’envoi du même Draft</Button> : null}
          <SeedanceDraftFinalAction jobId={draftWorkflow.draftId} locale={uiLocale} account={workflowAccount} />
          <Button size="sm" variant="outline" disabled={draftWorkflow.pending || !draftWorkflow.view || ['pending', 'finalizing', 'unavailable'].includes(draftWorkflow.view.eligibility)} onClick={draftWorkflow.restart}>Nouveau Draft</Button>
        </div> : <SeedanceDraftLocalPreviewResult preview={draftPreview} />}
      />}
      </WorkspaceRecentReferences>
      {modelReview.panel ? <WorkspaceModelReview review={modelReview} engines={engines} locale={uiLocale}
        currentPrice={price} currentCurrency={currency} currentPricing={isPricing} currentError={preflightError}
        comparisonSettings={<CoreSettingsBar
          density="comparison" engine={selectedEngine} mode={submissionMode} caps={capability}
          durationSec={multiPromptActive ? multiPromptTotalSec : form.durationSec}
          durationOption={form.durationOption ?? null} onDurationChange={handleDurationChange}
          numFrames={form.numFrames} onNumFramesChange={handleFramesChange}
          resolution={form.resolution} onResolutionChange={handleResolutionChange}
          aspectRatio={form.aspectRatio} onAspectRatioChange={handleAspectRatioChange}
          fps={form.fps} onFpsChange={handleFpsChange}
          showAudioControl={supportsAudioToggle} audioEnabled={form.audio}
          audioControlDisabled={voiceControlEnabled}
          audioControlNote={voiceControlEnabled ? 'Audio locked by voice control' : undefined}
          onAudioChange={audio => setForm(current => current ? { ...current, audio } : current)}
          durationManaged={multiPromptActive}
          durationManagedLabel={`Duration managed by multi-prompt · ${multiPromptTotalSec}s`}
          iterations={form.iterations} onIterationsChange={iterations => {
            setForm(current => current ? { ...current, iterations } : current);
            if (iterations <= 1) setViewMode('single');
          }}
        />} /> : null}
      <WorkspaceRuntimeModals
        viewerGroup={viewerGroup}
        onCloseViewer={() => setViewerTarget(null)}
        onRefreshJob={handleRefreshJob}
        topUpModal={topUpModal}
        topUpCopy={workspaceCopy.topUp}
        currency="USD"
        topUpAmount={topUpAmount}
        paymentAmountLabel={topUpPaymentAmountLabel}
        chargeCurrency={topUpChargeCurrency}
        quoteLoading={topUpQuoteLoading}
        quoteError={topUpQuoteError}
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
        isAssetLibraryLoadingMore={isAssetLibraryLoadingMore}
        assetLibraryHasMore={assetLibraryHasMore}
        assetLibraryError={assetLibraryError}
        assetDeletePendingId={assetDeletePendingId}
        fieldFallbackLabel={workspaceCopy.assetLibrary.fieldFallback}
        onAssetLibrarySourceChange={handleAssetLibrarySourceChange}
        onCloseAssetLibrary={closeAssetLibrary}
        onRefreshAssets={fetchAssetLibrary}
        onLoadMoreAssets={loadMoreAssetLibrary}
        onSelectFieldAsset={handleSelectLibraryAsset}
        onSelectKlingAsset={handleSelectKlingLibraryAsset}
        onDeleteAsset={handleDeleteLibraryAsset}
      />
    </>
  );
}
