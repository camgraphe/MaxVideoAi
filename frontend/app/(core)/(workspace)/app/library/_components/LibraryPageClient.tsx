'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo } from 'react';
import deepmerge from 'deepmerge';
import { CheckCircle2, Download, History, Plus, Trash2 } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useLibraryAssetMutations } from '../_hooks/useLibraryAssetMutations';
import { useLibraryPageData } from '../_hooks/useLibraryPageData';
import {
  DEFAULT_LIBRARY_COPY,
  formatTemplate,
  getAssetJobHref,
  LIBRARY_PAGE_SIZE,
  type LibraryCopy,
  type LibraryKind,
  type LibraryView,
  type SavedAssetSource,
} from '../_lib/library-page-helpers';

export function LibraryPageClient() {
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const rawCopy = t('workspace.library', DEFAULT_LIBRARY_COPY);
  const copy = useMemo<LibraryCopy>(() => {
    return deepmerge<LibraryCopy>(DEFAULT_LIBRARY_COPY, (rawCopy ?? {}) as Partial<LibraryCopy>);
  }, [rawCopy]);
  const [activeView, setActiveView] = useState<LibraryView>('saved');
  const [activeKind, setActiveKind] = useState<LibraryKind>('image');
  const [activeSource, setActiveSource] = useState<SavedAssetSource>('all');
  const [savedAssetLimit, setSavedAssetLimit] = useState(LIBRARY_PAGE_SIZE);
  const [recentOutputLimit, setRecentOutputLimit] = useState(LIBRARY_PAGE_SIZE);

  const {
    assetsData,
    assetsError,
    assetsLoading,
    assetsValidating,
    mutateAssets,
    recentData,
    recentError,
    recentLoading,
    recentValidating,
    mutateRecentOutputs,
    currentAssets,
  } = useLibraryPageData({
    userId: user?.id,
    activeView,
    activeKind,
    activeSource,
    savedAssetLimit,
    recentOutputLimit,
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
          ? (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const)
          : (['all', 'upload', 'generated'] as const),
    [activeKind, toolsEnabled]
  );
  const sourceLabels = useMemo(
    () =>
      activeKind === 'video'
        ? {
            all: 'All videos',
            upload: 'Uploaded videos',
            generated: 'Saved renders',
            recent: copy.tabs.recent,
            character: copy.tabs.character,
            angle: copy.tabs.angle,
            upscale: 'Upscale videos',
          }
        : activeKind === 'audio'
          ? {
              all: 'All audio',
              upload: 'Uploaded audio',
              generated: 'Saved audio renders',
              recent: copy.tabs.recent,
              character: copy.tabs.character,
              angle: copy.tabs.angle,
              upscale: copy.tabs.upscale,
            }
        : copy.tabs,
    [activeKind, copy.tabs]
  );
  const assetCountLabel = formatTemplate(copy.assets.countLabel, { count: currentAssets.length });
  const emptyLabel =
    activeView === 'review'
      ? copy.review.empty
      : activeSource === 'generated'
        ? copy.assets.emptyGenerated
        : activeSource === 'upload'
          ? copy.assets.emptyUploads
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

  useEffect(() => {
    setSavedAssetLimit(LIBRARY_PAGE_SIZE);
  }, [activeKind, activeSource]);

  useEffect(() => {
    setRecentOutputLimit(LIBRARY_PAGE_SIZE);
  }, [activeKind]);

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
              <div className="mt-3 h-4 w-96 rounded bg-surface-2" />
            </div>
          ) : !user ? (
            <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.auth.eyebrow}</p>
              <h1 className="mt-3 text-2xl font-semibold text-text-primary">{copy.auth.title}</h1>
              <p className="mt-3 text-sm text-text-secondary">{copy.auth.body}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/login" size="sm">
                  {copy.auth.createAccount}
                </ButtonLink>
                <ButtonLink href="/login?mode=signin" variant="outline" size="sm">
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
                onChange={handleImportChange}
              />

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
                searchPlaceholder={copy.browser.searchPlaceholder}
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
                hasMore={
                  activeView === 'review'
                    ? (recentData?.outputs?.length ?? 0) >= recentOutputLimit
                    : (assetsData?.assets?.length ?? 0) >= savedAssetLimit
                }
                loadMoreLabel={copy.browser.loadMore}
                isLoadingMore={activeView === 'review' ? recentValidating : assetsValidating}
                onLoadMore={() => {
                  if (activeView === 'review') {
                    setRecentOutputLimit((limit) => limit + LIBRARY_PAGE_SIZE);
                  } else {
                    setSavedAssetLimit((limit) => limit + LIBRARY_PAGE_SIZE);
                  }
                }}
                titleActions={
                  <>
                    <Button
                      type="button"
                      variant={activeView === 'saved' ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-full px-3 text-sm"
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
                      size="sm"
                      className="gap-1 rounded-full px-3 text-sm"
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
                      size="sm"
                      className="rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('image')}
                    >
                      {copy.media.images}
                    </Button>
                    <Button
                      type="button"
                      variant={activeKind === 'video' ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('video')}
                    >
                      {copy.media.videos}
                    </Button>
                    <Button
                      type="button"
                      variant={activeKind === 'audio' ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-full px-3 text-sm"
                      onClick={() => setActiveKind('audio')}
                    >
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
                        className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        disabled={isImporting}
                        onClick={() => importInputRef.current?.click()}
                      >
                        {isImporting ? copy.browser.importing : copy.browser.import}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                      onClick={() => {
                        clearMutationErrors();
                        if (activeView === 'review') {
                          void mutateRecentOutputs();
                        } else {
                          void mutateAssets();
                        }
                      }}
                    >
                      {copy.browser.refresh}
                    </Button>
                    <ButtonLink href="/app/image" prefetch={false} variant="outline" size="sm" className="rounded-full px-3 text-sm">
                      <span className="lg:hidden">Image</span>
                      <span className="hidden lg:inline">{copy.hero.ctas.image}</span>
                    </ButtonLink>
                    <ButtonLink href="/app" prefetch={false} variant="outline" size="sm" className="rounded-full px-3 text-sm">
                      <span className="lg:hidden">Video</span>
                      <span className="hidden lg:inline">{copy.hero.ctas.video}</span>
                    </ButtonLink>
                  </>
                }
                renderAssetMeta={(asset) =>
                  asset.createdAt ? <span className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</span> : null
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
                          className="h-9 w-9 min-h-0 rounded-full border-state-success/40 bg-state-success/10 p-0 text-state-success disabled:opacity-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
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
                          className="h-9 w-9 min-h-0 rounded-full p-0 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {asset.sourceOutputId && savingOutputIds.has(asset.sourceOutputId) ? (
                            <span className="text-[10px] font-semibold">...</span>
                          ) : (
                            <Plus className="h-4 w-4" aria-hidden />
                          )}
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
                        className="h-9 w-9 min-h-0 rounded-full border-border/70 bg-surface p-0 text-text-secondary hover:border-text-muted hover:text-text-primary"
                        aria-label={`${copy.assets.downloadButton} ${asset.url.split('/').pop() ?? copy.assets.assetFallback}`}
                        title={`${copy.assets.downloadButton} ${asset.url.split('/').pop() ?? copy.assets.assetFallback}`}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                      </ButtonLink>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAsset(asset.id)}
                        disabled={deletingId === asset.id}
                        className="h-9 w-9 min-h-0 rounded-full border border-state-warning/40 bg-state-warning/10 p-0 text-state-warning hover:bg-state-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
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
