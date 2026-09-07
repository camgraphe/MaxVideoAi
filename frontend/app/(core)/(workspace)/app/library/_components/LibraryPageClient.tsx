'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import deepmerge from 'deepmerge';
import { AudioWaveform, Clapperboard, Images, CheckCircle2, Download, History, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useLibraryAssetMutations } from '../_hooks/useLibraryAssetMutations';
import { useLibraryPageData } from '../_hooks/useLibraryPageData';
import {
  DEFAULT_LIBRARY_COPY,
  formatTemplate,
  getAssetJobHref,
  resolveLibraryEntry,
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function LibraryPageClient() {
  const searchParams = useSearchParams();
  const libraryEntry = useMemo(() => resolveLibraryEntry(searchParams), [searchParams]);
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const rawCopy = t('workspace.library', DEFAULT_LIBRARY_COPY);
  const copy = useMemo<LibraryCopy>(() => {
    return deepmerge<LibraryCopy>(DEFAULT_LIBRARY_COPY, (rawCopy ?? {}) as Partial<LibraryCopy>);
  }, [rawCopy]);
  const [activeView, setActiveView] = useState<LibraryView>(libraryEntry.view);
  const [activeKind, setActiveKind] = useState<LibraryKind>(libraryEntry.kind);
  const [activeSource, setActiveSource] = useState<SavedAssetSource>('all');

  const {
    assetsError,
    assetsLoading,
    mutateAssets,
    recentError,
    recentLoading,
    mutateRecentOutputs,
    currentAssets,
    searchQuery, setSearchQuery, hasMore, loadMore, isLoadingMore, activeJobId, clearJobFilter,
  } = useLibraryPageData({
    userId: user?.id,
    activeView,
    activeKind,
    activeSource,
    jobId: libraryEntry.jobId,
    toolsEnabled,
  });

  const {
    importInputRef,
    deletingId,
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
    handleDeleteAsset,
    handleSaveRecentOutput,
  } = useLibraryAssetMutations({
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
      activeKind === 'video'
        ? (['all', 'upload', 'generated', 'upscale'] as const)
        : activeKind === 'audio'
          ? (['all', 'upload', 'generated'] as const)
        : toolsEnabled
          ? (['all', 'upload', 'generated', 'storyboard', 'character', 'angle', 'upscale'] as const)
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
  const assetCountLabel = formatTemplate(copy.assets.countLabel, { count: currentAssets.length });
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
  const toolLinks =
    activeKind === 'image' && toolsEnabled
      ? [
          { href: '/app/image', label: copy.hero.ctas.image },
          { href: '/app/tools/storyboard', label: copy.tabs.storyboard.replace(/ assets?$/i, '') || 'Storyboard' },
          { href: '/app/tools/angle', label: copy.tabs.angle.replace(/ assets?$/i, '') || 'Angle' },
          { href: '/app/tools/character-builder', label: copy.tabs.character.replace(/ assets?$/i, '') || 'Character' },
          { href: '/app/tools/upscale', label: copy.tabs.upscale.replace(/ assets?$/i, '') || 'Upscale' },
        ]
      : activeKind === 'image'
        ? [{ href: '/app/image', label: copy.hero.ctas.image }]
        : [];

  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource('all');
    }
  }, [activeSource, availableSources]);


  return (
    <div className="flex min-h-screen flex-col bg-bg lg:h-[100dvh]">
      <HeaderBar />
      <div className="flex min-h-0 flex-1 min-w-0">
        <AppSidebar />
        <main className="flex-1 min-w-0 p-5 lg:min-h-0 lg:overflow-hidden lg:p-7">
          {authLoading ? (
            <div className="w-full animate-pulse rounded-card border border-border bg-surface p-8">
              <div className="h-4 w-24 rounded bg-surface-2" />
              <div className="mt-4 h-10 w-64 rounded bg-surface-2" />
              <div className="mt-3 h-4 w-full max-w-96 rounded bg-surface-2" />
            </div>
          ) : !user ? (
            <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.auth.eyebrow}</p>
              <h1 className="mt-3 text-2xl font-semibold text-text-primary">{copy.auth.title}</h1>
              <p className="mt-3 text-sm text-text-secondary">{copy.auth.body}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href={buildLoginHref({ mode: 'signup', nextPath: '/app/library' })} size="sm">
                  {copy.auth.createAccount}
                </ButtonLink>
                <ButtonLink
                  href={buildLoginHref({ mode: 'signin', nextPath: '/app/library' })}
                  variant="outline"
                  size="sm"
                >
                  {copy.auth.signIn}
                </ButtonLink>
              </div>
            </section>
          ) : (
            <div className="pb-8 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:pb-0">
              <input
                ref={importInputRef}
                type="file"
                accept={activeKind === 'video' ? 'video/*' : activeKind === 'audio' ? 'audio/*' : 'image/*'}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleImportChange}
              />

              {activeJobId ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                  <span className="text-text-secondary">{t('workspace.library.review.linkedResult', 'Linked result')}</span>
                  <Button type="button" variant="outline" size="sm" className="!min-h-11 gap-2" onClick={clearJobFilter}>
                    <X className="h-4 w-4" aria-hidden />
                    {t('workspace.library.review.showAll', 'All renders')}
                  </Button>
                </div>
              ) : null}
              <AssetLibraryBrowser
                layout="page"
                title={copy.hero.title}
                subtitle={activeView === 'review' ? copy.review.subtitle : copy.hero.subtitle}
                countLabel={assetCountLabel}
                assetType={activeKind}
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
                source={activeView === 'review' ? 'recent' : activeSource}
                availableSources={activeView === 'review' ? ['recent'] : [...availableSources]}
                sourceLabels={activeView === 'review' ? { recent: copy.tabs.recent } : sourceLabels}
                onSourceChange={(source) => {
                  if (source === 'recent') return;
                  setActiveSource(source as SavedAssetSource);
                  resetSourceMutationState();
                }}
                searchPlaceholder={activeView === 'review' ? t('workspace.library.browser.searchRenders', 'Search prompts or render IDs…') ?? 'Search prompts or render IDs…' : t('workspace.library.browser.searchSaved', 'Search names or render IDs…') ?? 'Search names or render IDs…'}
                sourcesTitle={activeView === 'review' ? copy.review.sourcesTitle : copy.browser.sourcesTitle}
                emptyLabel={emptyLabel || copy.assets.empty}
                emptySearchLabel={copy.browser.emptySearch}
                toolsTitle={activeView === 'saved' ? copy.browser.toolsTitle : undefined}
                toolsDescription={activeView === 'saved' ? copy.browser.toolsDescription : undefined}
                toolLinks={activeView === 'saved' ? toolLinks : []}
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
                titleActions={
                  <>
                    <Button
                      type="button"
                      variant={activeView === 'saved' ? 'primary' : 'outline'}
                      aria-pressed={activeView === 'saved'}
                      size="sm"
                      className="!min-h-11 rounded-full px-3 text-sm"
                      onClick={() => {
                        setActiveView('saved');
                        setSaveError(null);
                      }}
                    >
                      {copy.views.saved}
                    </Button>
                    <Button
                      type="button"
                      variant={activeView === 'review' ? 'primary' : 'outline'}
                      aria-pressed={activeView === 'review'}
                      size="sm"
                      className="!min-h-11 gap-2 rounded-full px-3 text-sm"
                      onClick={() => {
                        setActiveView('review');
                        setDeleteError(null);
                        setImportError(null);
                      }}
                    >
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {copy.views.review}
                    </Button>
                  </>
                }
                headerLeadingActions={
                  <>
                    <Button
                      type="button"
                      variant={activeKind === 'image' ? 'primary' : 'outline'}
                      aria-pressed={activeKind === 'image'}
                      size="sm"
                      className="!min-h-11 rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('image')}
                    >
                      <Images className="h-[18px] w-[18px]" aria-hidden />
                      {copy.media.images}
                    </Button>
                    <Button
                      type="button"
                      variant={activeKind === 'video' ? 'primary' : 'outline'}
                      aria-pressed={activeKind === 'video'}
                      size="sm"
                      className="!min-h-11 rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('video')}
                    >
                      <Clapperboard className="h-[18px] w-[18px]" aria-hidden />
                      {copy.media.videos}
                    </Button>
                    <Button
                      type="button"
                      variant={activeKind === 'audio' ? 'primary' : 'outline'}
                      aria-pressed={activeKind === 'audio'}
                      size="sm"
                      className="!min-h-11 rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('audio')}
                    >
                      <AudioWaveform className="h-[18px] w-[18px]" aria-hidden />
                      {copy.media.audio}
                    </Button>
                  </>
                }
                headerActions={
                  <>
                    {activeView === 'saved' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="!min-h-11 gap-2 rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        disabled={isImporting}
                        onClick={() => importInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" aria-hidden />
                        {isImporting ? copy.browser.importing : copy.browser.import}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="!min-h-11 gap-2 rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                      onClick={() => {
                        clearMutationErrors();
                        if (activeView === 'review') {
                          void mutateRecentOutputs();
                        } else {
                          void mutateAssets();
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      {copy.browser.refresh}
                    </Button>
                    <ButtonLink href={activeKind === 'video' ? '/app' : activeKind === 'audio' ? '/app/audio' : '/app/image'} prefetch={false} variant="outline" size="sm" className="!min-h-11 gap-2 rounded-full px-3 text-sm">
                      <Plus className="h-4 w-4" aria-hidden />
                      {t('workspace.library.browser.create', 'Create')}
                    </ButtonLink>
                  </>
                }
                renderAssetMeta={(asset) =>
                  asset.createdAt ? <span className="text-text-muted">{new Date(asset.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span> : null
                }
                renderAssetActions={(asset) =>
                  activeView === 'review' ? (
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
                  ) : (
                    <>
                      <ButtonLink
                        linkComponent="a"
                        href={buildAppDownloadUrl(asset.url, suggestDownloadFilename(asset.url, asset.url.split('/').pop() ?? 'asset'))}
                        variant="outline"
                        size="sm"
                        className="!min-h-11 flex-1 gap-1.5 rounded-xl border-border/70 bg-surface px-2 text-text-secondary hover:border-text-muted hover:text-text-primary"
                        aria-label={`${copy.assets.downloadButton} ${asset.url.split('/').pop() ?? copy.assets.assetFallback}`}
                        title={`${copy.assets.downloadButton} ${asset.url.split('/').pop() ?? copy.assets.assetFallback}`}
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="text-xs">{copy.assets.downloadButton}</span>
                      </ButtonLink>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAsset(asset.id)}
                        disabled={deletingId === asset.id}
                        className="h-11 w-11 !min-h-11 rounded-xl border border-border bg-surface p-0 text-text-muted hover:border-state-warning hover:text-state-warning disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={copy.assets.deleteButton}
                        title={copy.assets.deleteButton}
                      >
                        {deletingId === asset.id ? (
                          <span className="text-[10px] font-semibold">{copy.assets.deleting}</span>
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </>
                  )
                }
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
