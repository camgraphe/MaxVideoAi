'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
} from 'lucide-react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  createDefaultCharacterBuilderState,
  getCharacterFormatMultiplier,
} from '@/lib/character-builder';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  CharacterBuilderState,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import {
  CharacterBuilderResultsGallery,
  CharacterReferenceLibraryModal,
  SectionTitle,
  type BuildLookSectionKey,
} from './character-builder/_components/character-builder-workspace-components';
import { CharacterBuilderBuildLookSection } from './character-builder/_components/character-builder-build-look-section';
import { CharacterBuilderStartSection } from './character-builder/_components/character-builder-start-section';
import {
  CharacterBuilderAuthGateModal,
  CharacterBuilderDisabledState,
  CharacterBuilderLoadingSkeleton,
  CharacterBuilderPageFrame,
} from './character-builder/_components/character-builder-page-shell';
import { useCharacterBuilderHistoricalResults } from './character-builder/_hooks/useCharacterBuilderHistoricalResults';
import { useCharacterBuilderJobSnapshotLoader } from './character-builder/_hooks/useCharacterBuilderJobSnapshotLoader';
import { useCharacterBuilderLookSummaries } from './character-builder/_hooks/useCharacterBuilderLookSummaries';
import { useCharacterBuilderGenerationRunner } from './character-builder/_hooks/useCharacterBuilderGenerationRunner';
import { useCharacterBuilderOptions } from './character-builder/_hooks/useCharacterBuilderOptions';
import { useCharacterBuilderPersistence } from './character-builder/_hooks/useCharacterBuilderPersistence';
import { useCharacterBuilderPendingRunsSync } from './character-builder/_hooks/useCharacterBuilderPendingRunsSync';
import { useCharacterBuilderReferenceAssets } from './character-builder/_hooks/useCharacterBuilderReferenceAssets';
import { useCharacterBuilderResultActions } from './character-builder/_hooks/useCharacterBuilderResultActions';
import { useCharacterBuilderResultsInfiniteScroll } from './character-builder/_hooks/useCharacterBuilderResultsInfiniteScroll';
import { useCharacterBuilderTraitActions } from './character-builder/_hooks/useCharacterBuilderTraitActions';
import { DEFAULT_CHARACTER_COPY, type CharacterCopy } from './character-builder/_lib/character-builder-copy';
import {
  getCharacterBillingProductKey,
  getFlattenedResults,
  getRefByRole,
  INITIAL_LOADING_REQUEST_COUNTS,
} from './character-builder/_lib/character-builder-helpers';
import type {
  BillingProductResponse,
  LoadingRequestCounts,
  LoadingRequestKey,
  PendingCharacterRun,
} from './character-builder/_lib/character-builder-types';

export default function CharacterBuilderPage() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hairOpen, setHairOpen] = useState(false);
  const [activeBuildSection, setActiveBuildSection] = useState<BuildLookSectionKey>('identity');
  const [libraryModalRole, setLibraryModalRole] = useState<CharacterBuilderReferenceImage['role'] | null>(null);
  const [showStyleReferenceSlot, setShowStyleReferenceSlot] = useState(false);
  const [mustRemainDraft, setMustRemainDraft] = useState('');
  const [loadingActions, setLoadingActions] = useState<LoadingRequestCounts>(INITIAL_LOADING_REQUEST_COUNTS);
  const [pendingRuns, setPendingRuns] = useState<PendingCharacterRun[]>([]);
  const [lightboxEntry, setLightboxEntry] = useState<MediaLightboxEntry | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);
  const loginRedirectTarget = useMemo(() => {
    const base = pathname || '/app/tools/character-builder';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);
  const openAuthGate = useCallback(() => {
    setAuthModalOpen(true);
  }, []);
  const {
    applySettingsSnapshot,
    handleDuplicateHistoricalSettings,
    handleSaveHistoricalResult,
    handleSaveResult,
    savingResultId,
    setSavingResultId,
  } = useCharacterBuilderResultActions({
    copy,
    openAuthGate,
    setAdvancedOpen,
    setError,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    user,
  });

  const {
    genderOptions,
    ageOptions,
    skinToneOptions,
    faceCueOptions,
    hairColorOptions,
    hairLengthOptions,
    hairstyleOptions,
    eyeColorOptions,
    bodyBuildOptions,
    outfitOptions,
    realismOptions,
    accessoryOptions,
    distinctiveOptions,
    outputModeOptions,
    consistencyOptions,
    referenceStrengthOptions,
    qualityOptions,
    outputModeLabelOptions,
    qualityLabelOptions,
    formatLabelOptions,
  } = useCharacterBuilderOptions(copy, state.qualityMode);
  const flattenedResults = getFlattenedResults(state.runs);
  const {
    historicalResults,
    historicalHasMore,
    historicalIsFetchingMore,
    historicalJobsLoading,
    loadMoreHistoricalResults,
    mutateHistoricalJobs,
  } = useCharacterBuilderHistoricalResults(flattenedResults);
  const {
    resultsScrollContainerRef,
    resultsSentinelRef,
  } = useCharacterBuilderResultsInfiniteScroll({
    hasMore: historicalHasMore,
    loadMoreResults: loadMoreHistoricalResults,
    resultsLength: historicalResults.length,
  });
  const identityReference = getRefByRole(state.referenceImages, 'identity');
  const styleReference = getRefByRole(state.referenceImages, 'style');
  const hasIdentityReference = Boolean(identityReference);
  useCharacterBuilderPersistence({
    authLoading,
    hydrated,
    pendingRuns,
    setAdvancedOpen,
    setError,
    setHairOpen,
    setHydrated,
    setLightboxEntry,
    setLoadingActions,
    setMustRemainDraft,
    setPendingRuns,
    setSavingResultId,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    state,
    styleReference,
    user,
  });
  const handleRun = useCharacterBuilderGenerationRunner({
    copy,
    hasIdentityReference,
    mutateHistoricalJobs,
    openAuthGate,
    setError,
    setLoadingActions,
    setPendingRuns,
    setState,
    setStatusMessage,
    state,
    user,
  });
  const {
    handleLibrarySelect,
    triggerUpload,
  } = useCharacterBuilderReferenceAssets({
    copy,
    libraryModalRole,
    openAuthGate,
    setError,
    setLibraryModalRole,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    user,
  });
  const hasCompletedResults = flattenedResults.length > 0;
  const hasResults = hasCompletedResults || pendingRuns.length > 0 || historicalResults.length > 0;
  const {
    accessoriesFeaturesSummary,
    canResetBuilder,
    hairSummary,
    identitySummary,
    outfitSummary,
    realismSummary,
    resetState,
    secondaryControlsCount,
  } = useCharacterBuilderLookSummaries({
    accessoryOptions,
    ageOptions,
    copy,
    distinctiveOptions,
    genderOptions,
    hairColorOptions,
    hairLengthOptions,
    hairstyleOptions,
    hasIdentityReference,
    outfitOptions,
    realismOptions,
    state,
  });
  const {
    addMustRemainTag,
    handleResetBuilder,
    handleSelectResult,
    removeIdentityReference,
    removeMustRemainTag,
    removeStyleReference,
    toggleListValue,
    updateTrait,
  } = useCharacterBuilderTraitActions({
    copy,
    mustRemainDraft,
    resetState,
    setActiveBuildSection,
    setAdvancedOpen,
    setError,
    setHairOpen,
    setMustRemainDraft,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
  });
  const jobIdFromQuery = searchParams?.get('job')?.trim() ?? null;
  const billingProductKey = getCharacterBillingProductKey(state.qualityMode);
  useCharacterBuilderPendingRunsSync({
    authLoading,
    hydrated,
    mutateHistoricalJobs,
    pendingRuns,
    setPendingRuns,
    setState,
    user,
  });
  useCharacterBuilderJobSnapshotLoader({
    hydrated,
    jobIdFromQuery,
    loadFromJobDoneMessage: copy.loadFromJobDone,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
  });
  const { data: billingProductData } = useSWR(
    `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}`,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.pricingError);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );
  const estimatedImageCostUsd =
    billingProductData?.unitPriceCents != null
      ? Number(((billingProductData.unitPriceCents * getCharacterFormatMultiplier(state.formatMode, state.qualityMode)) / 100).toFixed(2))
      : null;
  const isActionLoading = (key: LoadingRequestKey): boolean => (loadingActions[key] ?? 0) > 0;

  function renderResultsGallery(variant: 'desktop' | 'mobile') {
    return (
      <CharacterBuilderResultsGallery
        copy={copy}
        flattenedResults={flattenedResults}
        historicalHasMore={historicalHasMore}
        historicalIsFetchingMore={historicalIsFetchingMore}
        historicalJobsLoading={historicalJobsLoading}
        historicalResults={historicalResults}
        outputModeLabelOptions={outputModeLabelOptions}
        pendingRuns={pendingRuns}
        qualityLabelOptions={qualityLabelOptions}
        qualityMode={state.qualityMode}
        resultsScrollContainerRef={resultsScrollContainerRef}
        resultsSentinelRef={resultsSentinelRef}
        runs={state.runs}
        savingResultId={savingResultId}
        selectedResultId={state.selectedResultId}
        variant={variant}
        onDuplicateHistoricalSettings={(item) => void handleDuplicateHistoricalSettings(item)}
        onDuplicateSettings={applySettingsSnapshot}
        onOpenLightbox={setLightboxEntry}
        onSaveHistoricalResult={(item) => void handleSaveHistoricalResult(item)}
        onSaveResult={(result) => void handleSaveResult(result)}
        onSelectResult={handleSelectResult}
      />
    );
  }

  if (authLoading || !hydrated) {
    return <CharacterBuilderLoadingSkeleton />;
  }

  if (!FEATURES.workflows.toolsSection) {
    return <CharacterBuilderDisabledState title={copy.disabledTitle} body={copy.disabledBody} />;
  }

  return (
    <CharacterBuilderPageFrame
      overlays={
        <>
          {lightboxEntry ? (
            <MediaLightbox
              title={copy.top.resultsTitle}
              subtitle={lightboxEntry.engineLabel ?? undefined}
              prompt={lightboxEntry.prompt ?? null}
              entries={[lightboxEntry]}
              onClose={() => setLightboxEntry(null)}
            />
          ) : null}
          <CharacterReferenceLibraryModal
            open={libraryModalRole !== null}
            onClose={() => setLibraryModalRole(null)}
            onSelect={handleLibrarySelect}
            copy={copy}
          />
          <CharacterBuilderAuthGateModal
            open={authModalOpen}
            copy={copy}
            loginRedirectTarget={loginRedirectTarget}
            onClose={() => setAuthModalOpen(false)}
          />
        </>
      }
    >
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            <div>
              <ButtonLink
                href="/app/tools"
                variant="ghost"
                size="sm"
                linkComponent={Link}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </ButtonLink>
            </div>

            {error ? (
              <Card role="alert" className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </Card>
            ) : null}
            {statusMessage ? (
              <Card role="status" aria-live="polite" className="border border-border bg-surface p-4 text-sm text-text-secondary">
                {statusMessage}
              </Card>
            ) : null}

            <div className="flex flex-col gap-6 xl:flex-row">
              <div className="min-w-0 flex-1 space-y-6">
                <Card className="overflow-visible border border-border p-6 lg:p-7">
                  <div className="space-y-6">
                    <CharacterBuilderStartSection
                      canUseReferences={Boolean(user)}
                      copy={copy}
                      identityFileRef={identityFileRef}
                      identityReference={identityReference}
                      onAuthRequired={openAuthGate}
                      onRemoveIdentityReference={removeIdentityReference}
                      onRemoveStyleReference={removeStyleReference}
                      outputMode={state.outputMode}
                      setLibraryModalRole={setLibraryModalRole}
                      setShowStyleReferenceSlot={setShowStyleReferenceSlot}
                      setState={setState}
                      showStyleReferenceSlot={showStyleReferenceSlot}
                      styleFileRef={styleFileRef}
                      styleReference={styleReference}
                    />

                    <CharacterBuilderBuildLookSection
                      accessoryOptions={accessoryOptions}
                      accessoriesFeaturesSummary={accessoriesFeaturesSummary}
                      activeBuildSection={activeBuildSection}
                      addMustRemainTag={addMustRemainTag}
                      advancedOpen={advancedOpen}
                      ageOptions={ageOptions}
                      bodyBuildOptions={bodyBuildOptions}
                      canResetBuilder={canResetBuilder}
                      consistencyOptions={consistencyOptions}
                      copy={copy}
                      distinctiveOptions={distinctiveOptions}
                      estimatedImageCostUsd={estimatedImageCostUsd}
                      eyeColorOptions={eyeColorOptions}
                      faceCueOptions={faceCueOptions}
                      formatLabelOptions={formatLabelOptions}
                      genderOptions={genderOptions}
                      hairColorOptions={hairColorOptions}
                      hairLengthOptions={hairLengthOptions}
                      hairOpen={hairOpen}
                      hairSummary={hairSummary}
                      hairstyleOptions={hairstyleOptions}
                      hasIdentityReference={hasIdentityReference}
                      identityReference={identityReference}
                      identitySummary={identitySummary}
                      loadingGenerateFour={isActionLoading('generate-4')}
                      loadingGenerateOne={isActionLoading('generate-1')}
                      mustRemainDraft={mustRemainDraft}
                      onGenerateFour={() => void handleRun('generate', 4)}
                      onGenerateOne={() => void handleRun('generate', 1)}
                      onResetBuilder={handleResetBuilder}
                      outfitOptions={outfitOptions}
                      outfitSummary={outfitSummary}
                      outputModeOptions={outputModeOptions}
                      qualityOptions={qualityOptions}
                      realismOptions={realismOptions}
                      realismSummary={realismSummary}
                      referenceStrengthOptions={referenceStrengthOptions}
                      removeMustRemainTag={removeMustRemainTag}
                      secondaryControlsCount={secondaryControlsCount}
                      setActiveBuildSection={setActiveBuildSection}
                      setAdvancedOpen={setAdvancedOpen}
                      setHairOpen={setHairOpen}
                      setMustRemainDraft={setMustRemainDraft}
                      setState={setState}
                      skinToneOptions={skinToneOptions}
                      state={state}
                      toggleListValue={toggleListValue}
                      updateTrait={updateTrait}
                    />

                  </div>

                  <input
                    ref={identityFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void triggerUpload('identity', event.target.files)}
                  />
                  <input
                    ref={styleFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void triggerUpload('style', event.target.files)}
                  />
                </Card>

                {hasResults ? (
                  <Card className="border border-border p-5 xl:hidden">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4">{renderResultsGallery('mobile')}</div>
                  </Card>
                ) : null}
              </div>

              <div className="hidden xl:flex xl:w-[340px] xl:min-h-0 xl:flex-col">
                <div className="sticky top-6 flex h-[calc(100vh-3rem)] min-h-0 w-full flex-col gap-4">
                  <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-border p-5">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4 flex min-h-0 flex-1 flex-col">
                      {renderResultsGallery('desktop')}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
    </CharacterBuilderPageFrame>
  );
}
