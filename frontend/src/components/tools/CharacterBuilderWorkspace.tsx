'use client';

/* eslint-disable @next/next/no-img-element */

import { buildStudioLookDraft } from '@/lib/character-studio-look';
import type { StudioRecastSelection } from '@/types/character-studio';
import { useCharacterStudioLibrary } from './character-builder/_hooks/useCharacterStudioLibrary';
import { getStudioLibraryCopy } from './character-builder/_lib/character-studio-library-copy';
import {
  CharacterStudioWorkspaceView,
  type StudioTab,
} from './character-builder/_components/CharacterStudioWorkspaceView.client';
import { CharacterStudioLibrary } from './character-builder/_components/CharacterStudioLibrary.client';
import { CharacterStudioOverlays } from './character-builder/_components/CharacterStudioOverlays.client';
import { CharacterStudioIdentity } from './character-builder/_components/CharacterStudioIdentity.client';
import deepmerge from 'deepmerge';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { type MediaLightboxEntry } from '@/components/MediaLightbox';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { createDefaultCharacterBuilderState, getCharacterFormatMultiplier } from '@/lib/character-builder';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type { CharacterBuilderState, CharacterBuilderReferenceImage } from '@/types/character-builder';
import {
  CharacterBuilderResultsGallery,
  type BuildLookSectionKey,
} from './character-builder/_components/character-builder-workspace-components';
import {
  CharacterStudioNavigation,
  type CharacterStudioMode,
} from './character-builder/_components/CharacterStudioNavigation.client';
import { CharacterStudioRecast } from './character-builder/_components/CharacterStudioRecast.client';
import { CharacterStudioComposer } from './character-builder/_components/CharacterStudioComposer.client';
import { CharacterStudioExplore } from './character-builder/_components/CharacterStudioExplore.client';
import {
  CharacterStudioReference,
  CharacterStudioReferenceInputs,
} from './character-builder/_components/CharacterStudioReference.client';
import { getCharacterStudioCopy } from './character-builder/_lib/character-studio-copy';
import {
  startNewCharacter,
  applyCharacterInspiration,
} from './character-builder/_lib/character-studio-state';
import type { StudioLocale } from '@/lib/character-studio-catalog';
import {
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
  const [studioTab, setStudioTab] = useState<StudioTab>('explore');
  const [editorKey, setEditorKey] = useState(0);
  const [recastSelection, setRecastSelection] = useState<StudioRecastSelection | null>(null);
  const libraryCopy = getStudioLibraryCopy(locale);
  const library = useCharacterStudioLibrary({
    userId: user?.id ?? null,
    enabled: studioTab === 'characters',
    captureAccountRequest,
  });
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
        onKeepCharacter={(source) => {
          if (user) void library.openSave(source);
          else openAuthGate();
        }}
        onRecastResult={handoffRecast}
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
          setShowMobileResults(false);
          setEditorKey((key) => key + 1);
        }}
        onOpenLightbox={setLightboxEntry}
        onSaveHistoricalResult={(item) => void handleSaveHistoricalResult(item)}
        onSaveResult={(result) => void handleSaveResult(result)}
        onSelectResult={handleSelectResult}
      />
    );
  }

  async function newLook(id: string) {
    const character = await library.openCharacter(id);
    if (!character) return;
    setState((previous) => buildStudioLookDraft(previous, character));
    setStudioMode('character');
    setShowMobileResults(false);
    setEditorKey((key) => key + 1);
    setError(null);
    setStatusMessage(null);
  }
  function handoffRecast(source: { jobId: string; imageUrl: string }, name: string, characterId?: string) {
    library.cancelDetails();
    setRecastSelection({ ...source, name, characterId, transferId: crypto.randomUUID() });
    setStudioMode('recast');
    setError(null);
    setStatusMessage(null);
  }
  function newCharacter() {
    library.closeCharacter();
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
      onMode={(mode) => {
        library.cancelDetails();
        setStudioMode(mode);
      }}
      onNew={newCharacter}
      onExplore={() => {
        setStudioTab('explore');
        setShowMobileResults(true);
      }}
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
        <CharacterStudioOverlays
          library={library}
          libraryCopy={libraryCopy}
          copy={copy}
          lightboxEntry={lightboxEntry}
          onCloseLightbox={() => setLightboxEntry(null)}
          referenceOpen={libraryModalRole !== null}
          userId={user?.id ?? null}
          onCloseReference={() => setLibraryModalRole(null)}
          onSelectReference={handleLibrarySelect}
          authOpen={authModalOpen}
          onCloseAuth={() => setAuthModalOpen(false)}
          loginRedirectTarget={loginRedirectTarget}
          onSaved={() => {
            setStudioTab('characters');
            setShowMobileResults(true);
            setStatusMessage(libraryCopy.saved);
          }}
        />
      }
    >
      <CharacterStudioWorkspaceView
        mode={studioMode}
        tab={studioTab}
        onTab={setStudioTab}
        mobileResults={showMobileResults}
        onEditor={() => setShowMobileResults(false)}
        copy={studioCopy}
        libraryCopy={libraryCopy}
        pendingCount={pendingRuns.length}
        error={error}
        status={statusMessage}
        composer={
          <CharacterStudioComposer
            key={`${editorKey}:${state.characterId ?? 'create'}`}
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
              state.characterId ? (
                <CharacterStudioIdentity
                  image={identityReference}
                  copy={libraryCopy}
                  onLibrary={() => {
                    setStudioTab('characters');
                    setShowMobileResults(true);
                  }}
                />
              ) : (
                <CharacterStudioReference
                  prominent
                  image={identityReference}
                  label={studioCopy.reference}
                  copy={studioCopy}
                  onUpload={() => (user ? identityFileRef.current?.click() : openAuthGate())}
                  onLibrary={() => (user ? setLibraryModalRole('identity') : openAuthGate())}
                  onRemove={removeIdentityReference}
                />
              )
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
        }
        explore={
          <CharacterStudioExplore
            copy={studioCopy}
            onNew={newCharacter}
            onChoose={(name) => {
              library.closeCharacter();
              setShowMobileResults(false);
              setState((previous) => applyCharacterInspiration(previous, name));
              setEditorKey((key) => key + 1);
              setError(null);
              setStatusMessage(null);
            }}
          />
        }
        characters={
          <CharacterStudioLibrary
            library={library}
            copy={libraryCopy}
            userId={user?.id ?? null}
            onSignIn={openAuthGate}
            onNewLook={(id) => void newLook(id)}
            onRecast={handoffRecast}
          />
        }
        results={renderResultsGallery('grid')}
        recast={
          <CharacterStudioRecast
            active={studioMode === 'recast'}
            copy={studioCopy}
            navigation={studioNavigation}
            selection={recastSelection}
          />
        }
      />
      <CharacterStudioReferenceInputs
        identityRef={identityFileRef}
        styleRef={styleFileRef}
        onUpload={(role, files) => {
          void triggerUpload(role, files);
        }}
      />
    </CharacterBuilderPageFrame>
  );
}
