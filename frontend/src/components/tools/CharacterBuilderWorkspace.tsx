'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
} from 'lucide-react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  AUTO_TRAIT_KEYS,
  createDefaultCharacterBuilderState,
  getCharacterFormatMultiplier,
  normalizeCharacterFormatMode,
} from '@/lib/character-builder';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  CharacterBuilderState,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import {
  BuildLookCarouselCard,
  CharacterBuilderStickyDock,
  CharacterBuilderResultsGallery,
  CharacterReferenceLibraryModal,
  CompactSelectField,
  GENDER_CARD_META,
  HairEditorPanel,
  IconChoiceCard,
  MultiToggleGroup,
  OutputPreviewCard,
  REALISM_CARD_META,
  ReferenceSlot,
  SectionTitle,
  SegmentedControl,
  StyleChoiceCard,
  type BuildLookSectionKey,
} from './character-builder/_components/character-builder-workspace-components';
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
  hasCustomOutfitSettings,
  hasCustomHairSettings,
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
                    <section className="space-y-4">
                      <SectionTitle title={copy.top.start} />
                      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
                        <OutputPreviewCard
                          selected={state.outputMode === 'character-sheet'}
                          title={copy.generatePanel.sheetTitle}
                          subtitle={copy.generatePanel.sheetBody}
                          mode="character-sheet"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'character-sheet',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: true,
                              },
                            }))
                          }
                        />
                        <OutputPreviewCard
                          selected={state.outputMode === 'portrait-reference'}
                          title={copy.generatePanel.portraitTitle}
                          subtitle={copy.generatePanel.portraitBody}
                          mode="portrait-reference"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'portrait-reference',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: false,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ReferenceSlot
                          title={copy.references.identityTitle}
                          subtitle={copy.references.identityBody}
                          image={identityReference}
                          onUpload={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            identityFileRef.current?.click();
                          }}
                          onOpenLibrary={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            setLibraryModalRole('identity');
                          }}
                          removeLabel={copy.references.remove}
                          libraryLabel={copy.library.open}
                          optionalLabel={copy.sections.optional}
                          onRemove={removeIdentityReference}
                        />
                        {showStyleReferenceSlot || styleReference ? (
                          <ReferenceSlot
                            title={copy.references.styleTitle}
                            subtitle={copy.references.styleBody}
                            image={styleReference}
                            onUpload={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              styleFileRef.current?.click();
                            }}
                            onOpenLibrary={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              setShowStyleReferenceSlot(true);
                              setLibraryModalRole('style');
                            }}
                            removeLabel={copy.references.remove}
                            libraryLabel={copy.library.open}
                            optionalLabel={copy.sections.optional}
                            onRemove={removeStyleReference}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowStyleReferenceSlot(true)}
                            className="flex min-h-[180px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-bg/40 px-4 py-6 text-center transition hover:border-border-hover hover:bg-surface-hover"
                          >
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                              <Upload className="h-5 w-5" />
                            </span>
                            <div className="mt-3 flex items-center justify-center gap-2">
                              <p className="text-sm font-semibold text-text-primary">{copy.references.addInspiration}</p>
                              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                                {copy.sections.optional}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">{copy.references.addInspirationBody}</p>
                          </button>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle title={copy.top.buildLook}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetBuilder}
                          disabled={!canResetBuilder}
                          className="shrink-0"
                        >
                          {copy.reset}
                        </Button>
                      </SectionTitle>
                      <div className="space-y-4">
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max overflow-hidden rounded-[24px] border border-border bg-surface shadow-card md:min-w-0 md:w-full">
                            <BuildLookCarouselCard
                              title={copy.sections.gender}
                              summary={identitySummary}
                              active={activeBuildSection === 'identity'}
                              onClick={() => setActiveBuildSection('identity')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.hair}
                              summary={hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                              active={activeBuildSection === 'hair'}
                              onClick={() => setActiveBuildSection('hair')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.outfit}
                              summary={outfitSummary === copy.notSet ? copy.open : outfitSummary}
                              active={activeBuildSection === 'outfit'}
                              onClick={() => setActiveBuildSection('outfit')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.accessoriesFeatures}
                              summary={accessoriesFeaturesSummary || copy.open}
                              active={activeBuildSection === 'details'}
                              onClick={() => setActiveBuildSection('details')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.realism}
                              summary={realismSummary}
                              active={activeBuildSection === 'style'}
                              onClick={() => setActiveBuildSection('style')}
                            />
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-border bg-surface shadow-card p-4 sm:p-5">
                          {activeBuildSection === 'identity' ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
                                {genderOptions.map((option) => {
                                  const meta = GENDER_CARD_META[option.id] ?? GENDER_CARD_META.custom;
                                  return (
                                    <IconChoiceCard
                                      key={option.id}
                                      selected={state.traits.genderPresentation.value === option.id}
                                      title={option.label}
                                      glyph={meta.glyph}
                                      background={meta.background}
                                      accent={meta.accent}
                                      onClick={() => updateTrait('genderPresentation', option.id)}
                                    />
                                  );
                                })}
                              </div>

                              <div className="max-w-xl">
                                <SegmentedControl
                                  label={copy.sections.age}
                                  options={ageOptions}
                                  value={state.traits.ageRange.value}
                                  onChange={(value) => updateTrait('ageRange', value)}
                                />
                              </div>

                              {state.traits.genderPresentation.value === 'custom' ? (
                                <Input
                                  value={state.traits.customGenderDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => ({
                                      ...previous,
                                      traits: {
                                        ...previous.traits,
                                        customGenderDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={copy.sections.customGenderPlaceholder}
                                />
                              ) : null}
                            </div>
                          ) : null}

                          {activeBuildSection === 'hair' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setHairOpen((previous) => !previous)}
                                className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-border bg-surface px-4 py-4 text-left transition hover:border-border-hover hover:bg-surface-hover hover:shadow-card"
                              >
                                <div className="flex min-w-0 items-center gap-4">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-surface-2/80">
                                    <div className="space-y-1">
                                      <div className="h-2 w-7 rounded-full bg-slate-500" />
                                      <div className="h-2 w-5 rounded-full bg-slate-400" />
                                      <div className="h-2 w-6 rounded-full bg-slate-300" />
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                    <p className="truncate text-xs text-text-secondary">
                                      {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                    </p>
                                  </div>
                                </div>
                                <span className="rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs font-semibold text-text-secondary">
                                  {hairOpen ? copy.sections.hairClose : copy.sections.hairEdit}
                                </span>
                              </button>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customHair}</label>
                                <Textarea
                                  value={state.traits.customHairDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => {
                                      const nextTraits = {
                                        ...previous.traits,
                                        customHairDescription: event.target.value,
                                      };
                                      return {
                                        ...previous,
                                        traits: {
                                          ...nextTraits,
                                          hairEnabled: hasCustomHairSettings(nextTraits),
                                        },
                                      };
                                    })
                                  }
                                  placeholder={copy.sections.customHairPlaceholder}
                                />
                              </div>
                              <HairEditorPanel
                                open={hairOpen}
                                onClose={() => setHairOpen(false)}
                                sourceMode={state.sourceMode}
                                traits={state.traits}
                                onChange={(key, value) => updateTrait(key, value)}
                                hairColorOptions={hairColorOptions}
                                hairLengthOptions={hairLengthOptions}
                                hairstyleOptions={hairstyleOptions}
                                copy={copy}
                              />
                            </div>
                          ) : null}

                          {activeBuildSection === 'outfit' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.outfit}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {outfitSummary === copy.notSet ? copy.open : outfitSummary}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {outfitOptions.map((option) => {
                                  const selected = state.traits.outfitStyle.value === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => updateTrait('outfitStyle', selected ? 'auto' : option.id)}
                                      className={clsx(
                                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                        selected
                                          ? 'border-brand bg-brand text-on-brand'
                                          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customOutfit}</label>
                                <Textarea
                                  value={state.traits.customOutfitDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => {
                                      const nextTraits = {
                                        ...previous.traits,
                                        customOutfitDescription: event.target.value,
                                      };
                                      return {
                                        ...previous,
                                        traits: {
                                          ...nextTraits,
                                          outfitEnabled: hasCustomOutfitSettings(nextTraits),
                                        },
                                      };
                                    })
                                  }
                                  placeholder={copy.sections.customOutfitPlaceholder}
                                />
                              </div>
                            </div>
                          ) : null}

                          {activeBuildSection === 'style' ? (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
                              {realismOptions.map((option) => {
                                const meta = REALISM_CARD_META[option.id];
                                return (
                                  <StyleChoiceCard
                                    key={option.id}
                                    selected={state.traits.realismStyle === option.id}
                                    title={option.label}
                                    background={meta.background}
                                    accent={meta.accent}
                                    onClick={() =>
                                      setState((previous) => ({
                                        ...previous,
                                        traits: {
                                          ...previous.traits,
                                          realismStyle: option.id,
                                        },
                                      }))
                                    }
                                  />
                                );
                              })}
                            </div>
                          ) : null}

                          {activeBuildSection === 'details' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.accessoriesFeatures}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {accessoriesFeaturesSummary || copy.open}
                                </p>
                              </div>
                              <MultiToggleGroup
                                label={copy.sections.accessories}
                                items={accessoryOptions}
                                values={state.traits.accessories}
                                onToggle={(value) => toggleListValue('accessories', value)}
                              />
                              <MultiToggleGroup
                                label={copy.sections.distinctiveFeatures}
                                items={distinctiveOptions}
                                values={state.traits.distinctiveFeatures}
                                onToggle={(value) => toggleListValue('distinctiveFeatures', value)}
                              />
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customDetails}</label>
                                <Textarea
                                  value={state.traits.customDetailsDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => ({
                                      ...previous,
                                      traits: {
                                        ...previous.traits,
                                        customDetailsDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={copy.sections.customDetailsPlaceholder}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((previous) => !previous)}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-bg/40 px-4 py-3 text-left transition hover:border-border-hover"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{copy.sections.moreControls}</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {secondaryControlsCount
                            ? copy.sections.setCount.replace('{count}', String(secondaryControlsCount))
                            : copy.sections.optional}
                        </span>
                      </button>

                      {advancedOpen ? (
                        <div className="space-y-5 rounded-card border border-border bg-bg/40 p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <CompactSelectField
                              label={copy.sections.skinTone}
                              value={state.traits.skinTone.value}
                              options={skinToneOptions}
                              onChange={(value) => updateTrait('skinTone', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('skinTone')}
                            />
                            <CompactSelectField
                              label={copy.sections.faceCues}
                              value={state.traits.faceCues.value}
                              options={faceCueOptions}
                              onChange={(value) => updateTrait('faceCues', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('faceCues')}
                            />
                            <CompactSelectField
                              label={copy.sections.eyeColor}
                              value={state.traits.eyeColor.value}
                              options={eyeColorOptions}
                              onChange={(value) => updateTrait('eyeColor', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('eyeColor')}
                            />
                            <CompactSelectField
                              label={copy.sections.bodyBuild}
                              value={state.traits.bodyBuild.value}
                              options={bodyBuildOptions}
                              onChange={(value) => updateTrait('bodyBuild', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('bodyBuild')}
                            />
                            <CompactSelectField
                              label={copy.sections.consistency}
                              value={state.consistencyMode}
                              options={consistencyOptions}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  consistencyMode: value as CharacterBuilderState['consistencyMode'],
                                }))
                              }
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                            />
                            {hasIdentityReference ? (
                              <CompactSelectField
                                label={copy.sections.referenceStrength}
                                value={state.referenceStrength}
                                options={referenceStrengthOptions}
                                onChange={(value) =>
                                  setState((previous) => ({
                                    ...previous,
                                    referenceStrength: value as CharacterBuilderState['referenceStrength'],
                                  }))
                                }
                                placeholder={copy.choose}
                                autoLabel={copy.auto}
                              />
                            ) : null}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['includeCloseUps', copy.outputOptions.includeCloseUps],
                              ['neutralStudioBackground', copy.outputOptions.neutralStudioBackground],
                              ['preserveFacialDetails', copy.outputOptions.preserveFacialDetails],
                              ['avoid3dRenderLook', copy.outputOptions.avoid3dRenderLook],
                            ].map(([key, label]) => {
                              const typedKey = key as keyof CharacterBuilderState['outputOptions'];
                              const active = state.outputOptions[typedKey];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setState((previous) => ({
                                      ...previous,
                                      outputOptions: {
                                        ...previous.outputOptions,
                                        [typedKey]: !previous.outputOptions[typedKey],
                                      },
                                    }))
                                  }
                                  className={clsx(
                                    'flex items-center justify-between rounded-card border px-4 py-3 text-left transition',
                                    active
                                      ? 'border-brand bg-brand/10'
                                      : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                                  )}
                                >
                                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                                  <span className="text-xs font-semibold uppercase tracking-micro">
                                    {active ? copy.on : copy.off}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.advancedNotes}</label>
                            <Textarea
                              rows={3}
                              value={state.advancedNotes}
                              onChange={(event) =>
                                setState((previous) => ({
                                  ...previous,
                                  advancedNotes: event.target.value,
                                }))
                              }
                              placeholder={copy.sections.advancedNotesPlaceholder}
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.mustRemainVisible}</label>
                            <div className="flex gap-2">
                              <Input
                                value={mustRemainDraft}
                                onChange={(event) => setMustRemainDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addMustRemainTag();
                                  }
                                }}
                                placeholder={copy.sections.mustRemainPlaceholder}
                              />
                              <Button onClick={addMustRemainTag}>{copy.add}</Button>
                            </div>
                            {state.mustRemainVisible.length ? (
                              <div className="flex flex-wrap gap-2">
                                {state.mustRemainVisible.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => removeMustRemainTag(tag)}
                                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-border-hover"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[24px] border border-border bg-surface/95 p-4 shadow-card">
                        <CharacterBuilderStickyDock
                          identityReference={identityReference}
                          hairSummary={hairSummary}
                          outfitSummary={outfitSummary}
                          traits={state.traits}
                          outputMode={state.outputMode}
                          qualityMode={state.qualityMode}
                          formatMode={state.formatMode}
                          genderOptions={genderOptions}
                          ageOptions={ageOptions}
                          realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
                          outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
                          qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
                          formatOptions={formatLabelOptions}
                          estimatedImageCostUsd={estimatedImageCostUsd}
                          onQualityChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityMode: value,
                              formatMode: normalizeCharacterFormatMode(previous.formatMode, value),
                            }))
                          }
                          onFormatChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              formatMode: normalizeCharacterFormatMode(value, previous.qualityMode),
                            }))
                          }
                          onGenerateOne={() => void handleRun('generate', 1)}
                          onGenerateFour={() => void handleRun('generate', 4)}
                          loadingGenerateOne={isActionLoading('generate-1')}
                          loadingGenerateFour={isActionLoading('generate-4')}
                          copy={copy}
                        />
                      </div>
                    </section>

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
