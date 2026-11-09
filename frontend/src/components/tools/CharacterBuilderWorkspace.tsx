'use client';

/* eslint-disable @next/next/no-img-element */

import { createStudioDraftTransitions } from './character-builder/_lib/character-studio-transitions';
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { type MediaLightboxEntry } from '@/components/MediaLightbox';
import { useCharacterBuilderPrice } from './character-builder/_hooks/useCharacterBuilderPrice';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { createDefaultCharacterBuilderState, getCharacterFormatResolution } from '@/lib/character-builder';
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
import { startNewCharacter } from './character-builder/_lib/character-studio-state';
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
import {
  useCharacterBuilderAccountScope,
  useCharacterBuilderDraftScope,
} from './character-builder/_hooks/useCharacterBuilderAccountScope';
import { useCharacterBuilderPersistence } from './character-builder/_hooks/useCharacterBuilderPersistence';
import { useCharacterBuilderPendingRunsSync } from './character-builder/_hooks/useCharacterBuilderPendingRunsSync';
import { useCharacterBuilderReferenceAssets } from './character-builder/_hooks/useCharacterBuilderReferenceAssets';
import { useCharacterBuilderResultActions } from './character-builder/_hooks/useCharacterBuilderResultActions';
import { useCharacterBuilderResultsInfiniteScroll } from './character-builder/_hooks/useCharacterBuilderResultsInfiniteScroll';
import { useCharacterBuilderTraitActions } from './character-builder/_hooks/useCharacterBuilderTraitActions';
import { DEFAULT_CHARACTER_COPY, type CharacterCopy } from './character-builder/_lib/character-builder-copy';
import {
  getFlattenedResults,
  getRefByRole,
  INITIAL_LOADING_REQUEST_COUNTS,
} from './character-builder/_lib/character-builder-helpers';
import type {
  LoadingRequestCounts,
  LoadingRequestKey,
  PendingCharacterRun,
} from './character-builder/_lib/character-builder-types';

export default function CharacterBuilderPage({ recastExamples }: { recastExamples?: ReactNode }) {
  const { loading, user, session } = useRequireAuth({
    redirectIfLoggedOut: false,
  });
  if (loading) return <CharacterBuilderLoadingSkeleton />;
  return (
    <CharacterBuilderAccountWorkspace
      key={user?.id ?? 'guest'}
      user={user}
      accessToken={session?.access_token ?? null}
      recastExamples={recastExamples}
    />
  );
}

function CharacterBuilderAccountWorkspace({
  user,
  accessToken,
  recastExamples,
}: {
  user: User | null;
  accessToken: string | null;
  recastExamples?: ReactNode;
}) {
  const authLoading = false;
  const captureAccountRequest = useCharacterBuilderAccountScope(accessToken);
  const { beginDraftIntent, captureDraftRequest } = useCharacterBuilderDraftScope(captureAccountRequest);
  const { t, locale } = useI18n();
  const studioCopy = getCharacterStudioCopy(locale);
  const studioLocale: StudioLocale = locale === 'fr' || locale === 'es' ? locale : 'en';
  const searchParams = useSearchParams();
  const [studioMode, setStudioMode] = useState<CharacterStudioMode>(() =>
    searchParams?.get('mode') === 'recast' ? 'recast' : 'character',
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') === studioMode) return;
    url.searchParams.set('mode', studioMode);
    window.history.replaceState(window.history.state, '', url);
  }, [studioMode]);
  const [showMobileResults, setShowMobileResults] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>('explore');
  const [editorKey, setEditorKey] = useState(0);
  const [recastSelection, setRecastSelection] = useState<StudioRecastSelection | null>(null);
  const libraryCopy = getStudioLibraryCopy(locale);
  const library = useCharacterStudioLibrary({
    userId: user?.id ?? null,
    enabled: studioTab === 'characters',
    captureAccountRequest,
    captureDraftRequest,
  });
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const pathname = usePathname();
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
    captureDraftRequest,
    beginDraftIntent,
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
  const { restoredDraft, dismissRestoredDraft } = useCharacterBuilderPersistence({
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
  const resolution = getCharacterFormatResolution(state.formatMode, state.qualityMode);
  const referenceCount = new Set(state.referenceImages.map(image => image.url).filter(Boolean)).size;
  const { displayedPrice, status: priceStatus, refreshPrice } = useCharacterBuilderPrice(resolution, referenceCount);
  const estimatedImageCostUsd = displayedPrice?.usd ?? null;
  const handleRun = useCharacterBuilderGenerationRunner({
    tariffRevision: displayedPrice?.revision,
    refreshPrice,
    captureAccountRequest,
    captureDraftRequest,
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
  const { handleLibrarySelect, invalidateReferenceUpload, triggerUpload } = useCharacterBuilderReferenceAssets({
    captureAccountRequest: captureDraftRequest,
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
      invalidateReferenceUpload,
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
    captureAccountRequest: captureDraftRequest,
    hydrated,
    jobIdFromQuery,
    loadFromJobDoneMessage: copy.loadFromJobDone,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
  });
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

  const { newLook, handoffRecast, newCharacter, chooseInspiration, changeMode, changeTab } =
    createStudioDraftTransitions({
      library,
      currentMode: studioMode,
      inspirationApplied: (name) => studioCopy.inspirationApplied.replace('{name}', () => name),
      beginDraftIntent,
      setState,
      setMode: setStudioMode,
      setMobileResults: setShowMobileResults,
      setTab: setStudioTab,
      setEditorKey,
      setRecastSelection,
      setError,
      setStatusMessage,
      onReset: () => {
        dismissRestoredDraft();
        setShowStyleReferenceSlot(false);
        setMustRemainDraft('');
      },
    });

  const showExplore = () => {
    setStudioTab('explore');
    setShowMobileResults(true);
  };
  const studioNavigation = (
    <CharacterStudioNavigation
      mode={studioMode}
      onMode={changeMode}
      onNew={newCharacter}
      onExplore={showExplore}
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
          referenceRole={libraryModalRole}
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
        onTab={changeTab}
        mobileResults={showMobileResults}
        onEditor={() => setShowMobileResults(false)}
        copy={studioCopy}
        libraryCopy={libraryCopy}
        pendingCount={pendingRuns.length}
        error={error}
        status={statusMessage}
        restoredDraft={restoredDraft}
        onNew={newCharacter}
        onDismissRestoredDraft={dismissRestoredDraft}
        composer={
          <CharacterStudioComposer
            key={`${editorKey}:${state.characterId ?? 'create'}`}
            navigation={studioNavigation}
            onExplore={showExplore}
            state={state}
            setState={setState}
            locale={studioLocale}
            copy={copy}
            labels={studioCopy}
            price={estimatedImageCostUsd}
            priceStatus={priceStatus}
            onRetryPrice={() => { void refreshPrice(); }}
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
          <CharacterStudioExplore copy={studioCopy} onNew={newCharacter} onChoose={chooseInspiration} recastExamples={recastExamples} onRecast={() => changeMode('recast')} />
        }
        characters={
          <CharacterStudioLibrary
            builderCopy={copy}
            locale={studioLocale}
            library={library}
            copy={libraryCopy}
            userId={user?.id ?? null}
            onSignIn={openAuthGate}
            onNewLook={(id, sheet) => void newLook(id, sheet)}
            onRecast={handoffRecast}
          />
        }
        results={renderResultsGallery('grid')}
        recast={
          <CharacterStudioRecast
            accountId={user?.id ?? null}
            active={studioMode === 'recast'}
            copy={studioCopy}
            navigation={studioNavigation}
            selection={recastSelection}
            characterLibrary={{ userId: user?.id ?? null, captureAccountRequest, onSignIn: openAuthGate }}
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
