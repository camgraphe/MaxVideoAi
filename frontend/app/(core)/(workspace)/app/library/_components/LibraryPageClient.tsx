'use client';
import { LibraryImportDialog } from '@/components/library/LibraryImportQueue.client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import deepmerge from 'deepmerge';
import { CheckCircle2, Plus, Upload, X } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/Button';
import { MediaDestinationActions } from '@/components/library/MediaDestinationActions.client';
import { MediaVisitorIntro } from '@/components/library/MediaVisitorIntro.client';
import { MediaEmptyState } from '@/components/library/MediaEmptyState';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { buildAuthReturnTarget } from '@/lib/auth-entry-href';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useLibraryAssetMutations } from '../_hooks/useLibraryAssetMutations';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { LibraryMediaNavigation } from '@/components/library/LibraryMediaNavigation.client';
import { LibraryStorageUsage } from '@/components/library/LibraryStorageUsage.client';
import { useLibraryPageData } from '../_hooks/useLibraryPageData';
import {
  DEFAULT_LIBRARY_COPY,
  getAssetJobHref,
  resolveLibraryEntry,
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

const LibraryCharacters = dynamic(() => import('@/components/library/LibraryCharacters.client').then(module => module.LibraryCharacters));
export function LibraryPageClient() {
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  return <OwnedLibraryPageClient key={user?.id ?? 'guest'} user={user} authLoading={authLoading} />;
}

function OwnedLibraryPageClient({ user, authLoading }: { user: { id: string } | null; authLoading: boolean }) {
  const searchParams = useSearchParams();
  const libraryEntry = useMemo(() => resolveLibraryEntry(searchParams), [searchParams]);
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t, locale } = useI18n();
  const rawCopy = t('workspace.library', DEFAULT_LIBRARY_COPY);
  const copy = useMemo<LibraryCopy>(() => {
    return deepmerge<LibraryCopy>(DEFAULT_LIBRARY_COPY, (rawCopy ?? {}) as Partial<LibraryCopy>);
  }, [rawCopy]);
  const [activeView, setActiveView] = useState<LibraryView>(libraryEntry.view);
  const [activeKind, setActiveKind] = useState<LibraryKind | 'all'>(libraryEntry.kind);
  const [organizationScope, setOrganizationScope] = useState<Pick<LibraryBrowseScope, 'favorite' | 'trash' | 'collectionId' | 'sort'>>({ sort: 'recent' });
  const [charactersOpen, setCharactersOpen] = useState(() => toolsEnabled && searchParams?.get('section') === 'characters');
  const [activeSource, setActiveSource] = useState<SavedAssetSource>('all');

  const {
    assetsError,
    assetsLoading,
    mutateAssets,
    recentError,
    recentLoading,
    mutateRecentOutputs,
    currentAssets, scope, totalCount,
    searchQuery, setSearchQuery, hasMore, loadMore, isLoadingMore, activeJobId, clearJobFilter,
  } = useLibraryPageData({
    userId: user?.id,
    activeView,
    activeKind,
    activeSource,
    jobId: libraryEntry.jobId,
    toolsEnabled, organizationScope,
  });

  const {
    importInputRef,
    importQueue, importQueueOpen, setImportQueueOpen,
    savingOutputIds,
    deleteError,
    saveError,
    isImporting,
    importError,
    clearMutationErrors,
    resetSourceMutationState,
    setDeleteError,
    setImportError,
    setSaveError,
    handleImportChange,
    handleSaveRecentOutput,
  } = useLibraryAssetMutations({
    userId: user?.id,
    activeKind,
    activeSource,
    copy,
    mutateAssets,
    mutateRecentOutputs,
    setActiveSource,
    setActiveView,
  });
  const availableSources = useMemo(
    () =>
      activeKind === 'all' ? (toolsEnabled ? (['all', 'upload', 'generated', 'storyboard', 'character', 'angle', 'upscale', 'background-removal'] as const) : (['all', 'upload', 'generated'] as const)) : activeKind === 'video'
        ? (['all', 'upload', 'generated', 'upscale'] as const)
        : activeKind === 'audio'
          ? (['all', 'upload', 'generated'] as const)
        : toolsEnabled
          ? (['all', 'upload', 'generated', 'storyboard', 'character', 'angle', 'upscale', 'background-removal'] as const)
          : (['all', 'upload', 'generated'] as const),
    [activeKind, toolsEnabled]
  );
  const sourceLabels = useMemo(
    () =>
      activeKind === 'video'
        ? {
            all: t('workspace.library.sources.video.all', 'All videos'),
            upload: t('workspace.library.sources.video.upload', 'Uploaded videos'),
            generated: t('workspace.library.sources.video.generated', 'Saved renders'),
            recent: copy.tabs.recent,
            storyboard: copy.tabs.storyboard,
            character: copy.tabs.character,
            angle: copy.tabs.angle,
            upscale: t('workspace.library.sources.video.upscale', 'Upscale videos'),
          }
        : activeKind === 'audio'
          ? {
              all: t('workspace.library.sources.audio.all', 'All audio'),
              upload: t('workspace.library.sources.audio.upload', 'Uploaded audio'),
              generated: t('workspace.library.sources.audio.generated', 'Saved audio renders'),
              recent: copy.tabs.recent,
              storyboard: copy.tabs.storyboard,
              character: copy.tabs.character,
              angle: copy.tabs.angle,
              upscale: copy.tabs.upscale,
            }
        : copy.tabs,
    [activeKind, copy.tabs, t]
  );
  const emptyLabel =
    activeView === 'review'
      ? copy.review.empty
        : activeSource === 'generated'
          ? copy.assets.emptyGenerated
        : activeSource === 'upload'
          ? copy.assets.emptyUploads
        : activeSource === 'storyboard'
          ? copy.assets.emptyStoryboard
        : activeSource === 'character'
            ? copy.assets.emptyCharacter
            : activeSource === 'angle'
              ? copy.assets.emptyAngle
              : activeSource === 'upscale'
                ? copy.assets.emptyUpscale
                : copy.assets.empty;
  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource('all');
    }
  }, [activeSource, availableSources]);

  const mediaNavigation = <LibraryMediaNavigation locale={locale} value={charactersOpen ? 'characters' : activeKind} charactersEnabled={toolsEnabled} onChange={(value) => {
    setCharactersOpen(value === 'characters');
    if (value !== 'characters') setActiveKind(value);
    const url = new URL(window.location.href);
    if (value === 'characters') url.searchParams.set('section', 'characters');
    else url.searchParams.delete('section');
    window.history.replaceState(window.history.state, '', url);
  }} />;


  return (
    <div className="flex h-[calc(100dvh-var(--app-bottom-nav-height,0px))] min-h-0 flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-h-0 flex-1 min-w-0">
        <AppSidebar />
        <main className="library-page-main flex-1 min-h-0 min-w-0 overflow-auto p-3 lg:overflow-hidden lg:p-4">
          {authLoading ? (
            <div className="w-full animate-pulse rounded-card border border-border bg-surface p-8">
              <div className="h-4 w-24 rounded bg-surface-2" />
              <div className="mt-4 h-10 w-64 rounded bg-surface-2" />
              <div className="mt-3 h-4 w-full max-w-96 rounded bg-surface-2" />
            </div>
          ) : !user ? (
            <MediaVisitorIntro locale={locale} nextPath={buildAuthReturnTarget('/app/library', searchParams)} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <input
                ref={importInputRef}
                type="file"
                multiple
                accept={activeKind === 'all' ? 'image/*,video/*,audio/*' : activeKind === 'video' ? 'video/*' : activeKind === 'audio' ? 'audio/*' : 'image/*'}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleImportChange}
              />

              {importQueueOpen ? <LibraryImportDialog queue={importQueue} locale={locale} onClose={() => setImportQueueOpen(false)} /> : null}
              {activeJobId ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                  <span className="text-text-secondary">{t('workspace.library.review.linkedResult', 'Linked result')}</span>
                  <Button type="button" variant="outline" size="sm" className="!min-h-11 gap-2" onClick={clearJobFilter}>
                    <X className="h-4 w-4" aria-hidden />
                    {t('workspace.library.review.showAll', 'All renders')}
                  </Button>
                </div>
              ) : null}
              {charactersOpen ? <LibraryCharacters key={`characters:${user.id}`} userId={user.id} locale={locale} navigation={mediaNavigation} /> : <AssetLibraryBrowser
                layout="page"
                locale={locale}
                renderContinuation={(asset) => <MediaDestinationActions asset={asset} userId={user?.id} locale={locale} />}
                title={locale === 'fr' ? 'Médias' : locale === 'es' ? 'Medios' : 'Media'}
                hideTitle
                footerContent={<LibraryStorageUsage key={`storage:${user.id}`} userId={user.id} locale={locale} />}
                assetType={activeKind}
                management={{ userId: user.id, scope, totalCount, onScopeChange: ({ view, kind, source, q, ...patch }) => {
                  if (view) { setActiveView(view); if (view === 'all' && activeJobId) clearJobFilter(); }
                  if (kind) setActiveKind(kind);
                  if (source) setActiveSource(source as SavedAssetSource);
                  if (q !== undefined) setSearchQuery(q);
                  setOrganizationScope((previous) => ({ ...previous, ...patch }));
                } }}
                assets={currentAssets}
                isLoading={
                  activeView === 'review'
                    ? recentLoading && currentAssets.length === 0
                    : assetsLoading && currentAssets.length === 0
                }
                error={
                  importError ??
                  deleteError ??
                  saveError ??
                  (activeView === 'review'
                    ? recentError
                      ? copy.review.loadError
                      : null
                    : assetsError
                      ? copy.assets.loadError
                      : null)
                }
                source={activeSource}
                availableSources={availableSources}
                sourceLabels={sourceLabels}
                onSourceChange={(source) => {
                  clearMutationErrors();
                  if (source === 'recent') {
                    setActiveSource('all');
                    setActiveView('review');
                    setDeleteError(null);
                    setImportError(null);
                    return;
                  }
                  setSaveError(null);
                  setActiveSource(source as SavedAssetSource);
                  resetSourceMutationState();
                }}
                searchPlaceholder={activeView === 'review' ? t('workspace.library.browser.searchRenders', 'Search prompts or render IDs…') ?? 'Search prompts or render IDs…' : t('workspace.library.browser.searchSaved', 'Search names or render IDs…') ?? 'Search names or render IDs…'}
                sourcesTitle={copy.browser.sourcesTitle}
                emptyLabel={emptyLabel || copy.assets.empty}
                emptyContent={activeKind !== 'all' && activeSource === 'all' && !activeJobId && !hasMore ? <MediaEmptyState
                  kind={activeKind} locale={locale} saved={activeView === 'saved'}
                  onShowRenders={() => { clearMutationErrors(); setActiveView('review'); }}
                /> : undefined}
                emptySearchLabel={copy.browser.emptySearch}
                getAssetHref={(asset) => (asset.kind === 'audio' ? null : getAssetJobHref(asset))}
                getAssetHrefLabel={() =>
                  activeView === 'review' ? copy.review.openRender : copy.assets.openAssetButton
                }
                hasMore={hasMore}
                loadMoreLabel={copy.browser.loadMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onRetry={() => {
                  clearMutationErrors();
                  void (activeView === 'review' ? mutateRecentOutputs() : mutateAssets());
                }}
                retryLabel={copy.browser.refresh}
                headerLeadingActions={mediaNavigation}
                headerActions={<>
                  {importQueue.getSnapshot().files.length > 0 ? <button type="button" onClick={() => setImportQueueOpen(true)}>{locale.startsWith('fr') ? 'Imports' : locale.startsWith('es') ? 'Importaciones' : 'Imports'}</button> : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="compact-library-import !min-h-11 gap-2 rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        disabled={isImporting}
                        aria-label={isImporting ? copy.browser.importing : copy.browser.import}
                        title={isImporting ? copy.browser.importing : copy.browser.import}
                        onClick={() => importInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" aria-hidden />
                        <span className="compact-library-import-label">{isImporting ? copy.browser.importing : copy.browser.import}</span>
                      </Button>
                  </>}
                renderAssetMeta={(asset) =>
                  asset.createdAt ? <span className="text-text-muted">{new Date(asset.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span> : null
                }
                renderAssetActions={(asset) =>
                  asset.jobId && asset.sourceOutputId ? (
                    <>
                      {asset.isSaved ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          title={copy.review.saved}
                          aria-label={copy.review.saved}
                          className="!min-h-11 gap-1.5 rounded-xl border-state-success/40 bg-state-success/10 px-2 text-state-success disabled:opacity-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          <span className="text-xs">{copy.review.saved}</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={Boolean(asset.sourceOutputId && savingOutputIds.has(asset.sourceOutputId))}
                          onClick={() => void handleSaveRecentOutput(asset)}
                          title={
                            asset.sourceOutputId && savingOutputIds.has(asset.sourceOutputId)
                              ? copy.review.saving
                              : copy.review.saveButton
                          }
                          aria-label={
                            asset.sourceOutputId && savingOutputIds.has(asset.sourceOutputId)
                              ? copy.review.saving
                              : copy.review.saveButton
                          }
                          className="!min-h-11 gap-1.5 rounded-xl px-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {asset.sourceOutputId && savingOutputIds.has(asset.sourceOutputId) ? (
                            <span className="text-[10px] font-semibold">...</span>
                          ) : (
                            <Plus className="h-4 w-4" aria-hidden />
                          )}
                          <span className="text-xs">{copy.review.saveButton}</span>
                        </Button>
                      )}
                    </>
                  ) : null
                }
              />}
              {charactersOpen ? <LibraryStorageUsage key={`storage:${user.id}`} userId={user.id} locale={locale} /> : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
