'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Images, Compass, SlidersHorizontal } from 'lucide-react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { Card } from '@/components/ui/Card';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { createDefaultCharacterBuilderState, getCharacterFormatMultiplier } from '@/lib/character-builder';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type { CharacterBuilderState, CharacterBuilderReferenceImage } from '@/types/character-builder';
import {
  CharacterBuilderResultsGallery,
  CharacterReferenceLibraryModal,
  type BuildLookSectionKey,
} from './character-builder/_components/character-builder-workspace-components';
import {
  CharacterStudioNavigation,
  type CharacterStudioMode,
} from './character-builder/_components/CharacterStudioNavigation.client';
import { CharacterStudioRecast } from './character-builder/_components/CharacterStudioRecast.client';
import { CharacterStudioComposer } from './character-builder/_components/CharacterStudioComposer.client';
import { CharacterStudioExplore } from './character-builder/_components/CharacterStudioExplore.client';
import { CharacterStudioReference } from './character-builder/_components/CharacterStudioReference.client';
import { getCharacterStudioCopy } from './character-builder/_lib/character-studio-copy';
import {
  startNewCharacter,
  applyCharacterInspiration,
} from './character-builder/_lib/character-studio-state';
import type { StudioLocale } from '@/lib/character-studio-catalog';
import {
  CharacterBuilderAuthGateModal,
  CharacterBuilderDisabledState,
  CharacterBuilderLoadingSkeleton,
  CharacterBuilderPageFrame,
} from './character-builder/_components/character-builder-page-shell';
import { useCharacterBuilderHistoricalResults } from './character-builder/_hooks/useCharacterBuilderHistoricalResults';
import { useCharacterBuilderJobSnapshotLoader } from './character-builder/_hooks/useCharacterBuilderJobSnapshotLoader';
import { useCharacterBuilderGenerationRunner } from './character-builder/_hooks/useCharacterBuilderGenerationRunner';
import { useCharacterBuilderOptions } from './character-builder/_hooks/useCharacterBuilderOptions';
import { useCharacterBuilderAccountScope } from './character-builder/_hooks/useCharacterBuilderAccountScope';
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
  const { loading, user, session } = useRequireAuth({
    redirectIfLoggedOut: false,
  });
  if (loading) return <CharacterBuilderLoadingSkeleton />;
  return (
    <CharacterBuilderAccountWorkspace
      key={user?.id ?? 'guest'}
      user={user}
      accessToken={session?.access_token ?? null}
    />
  );
}

function CharacterBuilderAccountWorkspace({
  user,
  accessToken,
}: {
  user: User | null;
  accessToken: string | null;
}) {
  const authLoading = false;
  const captureAccountRequest = useCharacterBuilderAccountScope(accessToken);
  const { t, locale } = useI18n();
  const studioCopy = getCharacterStudioCopy(locale);
  const studioLocale: StudioLocale = locale === 'fr' || locale === 'es' ? locale : 'en';
  const [studioMode, setStudioMode] = useState<CharacterStudioMode>('character');
  const [showMobileResults, setShowMobileResults] = useState(false);
  const [studioTab, setStudioTab] = useState<'explore' | 'history'>('explore');
  const [editorKey, setEditorKey] = useState(0);
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [, setAdvancedOpen] = useState(false);
  const [, setHairOpen] = useState(false);
  const [, setActiveBuildSection] = useState<BuildLookSectionKey>('identity');
  const [libraryModalRole, setLibraryModalRole] = useState<CharacterBuilderReferenceImage['role'] | null>(
    null,
  );
  const [, setShowStyleReferenceSlot] = useState(false);
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
    captureAccountRequest,
    copy,
    openAuthGate,
    setAdvancedOpen,
    setError,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
    user,
  });

  const { outputModeLabelOptions, qualityLabelOptions } = useCharacterBuilderOptions(copy, state.qualityMode);
  const flattenedResults = getFlattenedResults(state.runs);
  const {
    historicalResults,
    historicalHasMore,
    historicalIsFetchingMore,
    historicalJobsLoading,
    historicalJobsError,
    loadMoreHistoricalResults,
    mutateHistoricalJobs,
  } = useCharacterBuilderHistoricalResults(flattenedResults);
  const { resultsScrollContainerRef, resultsSentinelRef } = useCharacterBuilderResultsInfiniteScroll({
    hasMore: historicalHasMore,
    enabled: studioMode === 'character' && studioTab === 'history',
    pageScroll: true,
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
    captureAccountRequest,
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
  const { handleLibrarySelect, triggerUpload } = useCharacterBuilderReferenceAssets({
    captureAccountRequest,
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
  const resetState = useMemo(() => startNewCharacter(state), [state]);
  const { handleSelectResult, removeIdentityReference, removeStyleReference } =
    useCharacterBuilderTraitActions({
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
    captureAccountRequest,
    authLoading,
    hydrated,
    mutateHistoricalJobs,
    pendingRuns,
    setPendingRuns,
    setState,
    user,
  });
  useCharacterBuilderJobSnapshotLoader({
    captureAccountRequest,
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
    { keepPreviousData: false },
  );
  const estimatedImageCostUsd =
    billingProductData?.unitPriceCents != null
      ? Number(
          (
            (billingProductData.unitPriceCents *
              getCharacterFormatMultiplier(state.formatMode, state.qualityMode)) /
            100
          ).toFixed(2),
        )
      : null;
  const isActionLoading = (key: LoadingRequestKey): boolean => (loadingActions[key] ?? 0) > 0;

  function renderResultsGallery(variant: 'grid') {
    return (
      <CharacterBuilderResultsGallery
        copy={copy}
        flattenedResults={flattenedResults}
        historicalHasMore={historicalHasMore}
        historicalIsFetchingMore={historicalIsFetchingMore}
        historicalJobsLoading={historicalJobsLoading}
        historicalJobsError={historicalJobsError}
        onRetryHistory={() => void mutateHistoricalJobs(undefined, { throwOnError: false })}
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
        onDuplicateSettings={(snapshot, selectedId) => {
          applySettingsSnapshot(snapshot, selectedId);
          setEditorKey((key) => key + 1);
        }}
        onOpenLightbox={setLightboxEntry}
        onSaveHistoricalResult={(item) => void handleSaveHistoricalResult(item)}
        onSaveResult={(result) => void handleSaveResult(result)}
        onSelectResult={handleSelectResult}
      />
    );
  }

  function newCharacter() {
    setStudioMode('character');
    setShowMobileResults(false);
    setState(startNewCharacter);
    setStudioTab('explore');
    setEditorKey((key) => key + 1);
    setShowStyleReferenceSlot(false);
    setMustRemainDraft('');
    setError(null);
    setStatusMessage(null);
  }

  const studioNavigation = (
    <CharacterStudioNavigation
      mode={studioMode}
      onMode={setStudioMode}
      onNew={newCharacter}
      onExplore={() => { setStudioTab('explore'); setShowMobileResults(true); }}
      copy={studioCopy}
    />
  );

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
            userId={user?.id ?? null}
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
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1700px] flex-col gap-2">
        {error ? (
          <Card role="alert" className="border border-border p-4 text-sm text-text-primary">
            {error}
          </Card>
        ) : null}
        {statusMessage ? (
          <p role="status" aria-live="polite" className="text-sm text-text-secondary">
            {statusMessage}
          </p>
        ) : null}
        <div
          className={
            studioMode === 'character'
              ? 'grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]'
              : 'hidden'
          }
        >
          <div className={`min-h-0 ${showMobileResults ? 'hidden lg:block' : ''}`}>
            <CharacterStudioComposer
              key={editorKey}
              navigation={studioNavigation}
              state={state}
              setState={setState}
              locale={studioLocale}
              copy={copy}
              labels={studioCopy}
              price={estimatedImageCostUsd}
              canGenerate={!user || estimatedImageCostUsd !== null}
              busy={isActionLoading('generate-1') || isActionLoading('generate-4')}
              onGenerate={(count = 1) => {
                if (user) {
                  setStudioTab('history');
                  setShowMobileResults(true);
                }
                void handleRun('generate', count);
              }}
              identitySlot={
                <CharacterStudioReference
                  prominent
                  image={identityReference}
                  label={studioCopy.reference}
                  copy={studioCopy}
                  onUpload={() => (user ? identityFileRef.current?.click() : openAuthGate())}
                  onLibrary={() => (user ? setLibraryModalRole('identity') : openAuthGate())}
                  onRemove={removeIdentityReference}
                />
              }
              styleSlot={
                <CharacterStudioReference
                  image={styleReference}
                  label={studioCopy.styleReference}
                  copy={studioCopy}
                  onUpload={() => (user ? styleFileRef.current?.click() : openAuthGate())}
                  onLibrary={() => (user ? setLibraryModalRole('style') : openAuthGate())}
                  onRemove={removeStyleReference}
                />
              }
            />
          </div>
          <section
            className={`min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface ${showMobileResults ? 'flex' : 'hidden lg:flex'}`}
            aria-label={copy.top.resultsTitle}
          >
            <nav
              className="flex shrink-0 items-center gap-4 border-b border-border px-3 sm:px-5"
              aria-label={copy.top.resultsTitle}
            >
              <button
                type="button"
                onClick={() => setShowMobileResults(false)}
                aria-label={studioCopy.character}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border lg:hidden"
              >
                <SlidersHorizontal size={15} />
              </button>
              <button
                type="button"
                aria-pressed={studioTab === 'explore'}
                onClick={() => setStudioTab('explore')}
                className={`flex min-h-12 items-center gap-2 border-b-2 text-sm ${studioTab === 'explore' ? 'border-brand text-text-primary' : 'border-transparent text-text-secondary'}`}
              >
                <Compass size={16} />
                {studioCopy.explore}
              </button>
              <button
                type="button"
                aria-pressed={studioTab === 'history'}
                onClick={() => setStudioTab('history')}
                className={`flex min-h-12 items-center gap-2 border-b-2 text-sm ${studioTab === 'history' ? 'border-brand text-text-primary' : 'border-transparent text-text-secondary'}`}
              >
                <Images size={16} />
                {studioCopy.history}
                {pendingRuns.length ? <span className="text-xs">({pendingRuns.length})</span> : null}
              </button>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-studio-scroll="results">
              {studioTab === 'explore' ? (
                <CharacterStudioExplore
                  copy={studioCopy}
                  onNew={newCharacter}
                  onChoose={(name) => {
                    setShowMobileResults(false);
                    setState((previous) => applyCharacterInspiration(previous, name));
                    setEditorKey((key) => key + 1);
                    setError(null);
                    setStatusMessage(null);
                  }}
                />
              ) : (
                <div className="p-4 sm:p-6">{renderResultsGallery('grid')}</div>
              )}
            </div>
          </section>
        </div>
        <div className={studioMode === 'recast' ? 'min-h-0 flex-1' : 'hidden'}>
          <CharacterStudioRecast
            active={studioMode === 'recast'}
            copy={studioCopy}
            navigation={studioNavigation}
          />
        </div>
        <input
          ref={identityFileRef}
          data-character-reference="identity"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void triggerUpload('identity', event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={styleFileRef}
          data-character-reference="style"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void triggerUpload('style', event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </CharacterBuilderPageFrame>
  );
}
