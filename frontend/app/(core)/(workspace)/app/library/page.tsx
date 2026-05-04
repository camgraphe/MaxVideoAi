'use client';

export const dynamic = 'force-dynamic';

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import useSWR from 'swr';
import deepmerge from 'deepmerge';
import { CheckCircle2, Download, History, Plus, Trash2 } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AssetLibraryBrowser, type AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { translateError } from '@/lib/error-messages';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type LibraryView = 'saved' | 'review';
type LibraryKind = 'image' | 'video' | 'audio';
type SavedAssetSource = 'all' | 'upload' | 'generated' | 'character' | 'angle' | 'upscale';

type UserAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind?: 'image' | 'video' | 'audio';
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  jobId?: string | null;
  sourceOutputId?: string | null;
  createdAt?: string;
};

type RecentOutput = {
  id: string;
  jobId: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind: 'image' | 'video' | 'audio';
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  position?: number | null;
  status?: string | null;
  createdAt?: string;
  isSaved?: boolean;
  savedAssetId?: string | null;
};

type AssetsResponse = {
  ok: boolean;
  error?: string;
  assets: UserAsset[];
};

type RecentOutputsResponse = {
  ok: boolean;
  error?: string;
  outputs: RecentOutput[];
};

interface LibraryCopy {
  auth: {
    eyebrow: string;
    title: string;
    body: string;
    createAccount: string;
    signIn: string;
  };
  hero: {
    title: string;
    subtitle: string;
    ctas: {
      image: string;
      video: string;
    };
  };
  views: {
    saved: string;
    review: string;
  };
  media: {
    images: string;
    videos: string;
    audio: string;
  };
  browser: {
    searchPlaceholder: string;
    sourcesTitle: string;
    toolsTitle: string;
    toolsDescription: string;
    emptySearch: string;
    import: string;
    importing: string;
    importFailed: string;
    refresh: string;
    loadMore: string;
  };
  tabs: {
    all: string;
    upload: string;
    generated: string;
    recent: string;
    character: string;
    angle: string;
    upscale: string;
  };
  review: {
    subtitle: string;
    sourcesTitle: string;
    helper: string;
    empty: string;
    loadError: string;
    saveButton: string;
    saving: string;
    saved: string;
    saveError: string;
    openRender: string;
  };
  assets: {
    title: string;
    countLabel: string;
    loadError: string;
    empty: string;
    emptyUploads: string;
    emptyGenerated: string;
    emptyCharacter: string;
    emptyAngle: string;
    emptyUpscale: string;
    deleteError: string;
    deleteButton: string;
    downloadButton: string;
    openAssetButton: string;
    useSettingsButton: string;
    deleting: string;
    assetFallback: string;
  };
}

const DEFAULT_LIBRARY_COPY: LibraryCopy = {
  auth: {
    eyebrow: 'Workspace',
    title: 'Create your workspace account',
    body: 'Sign in to access your saved assets, downloads, and reusable references.',
    createAccount: 'Create account',
    signIn: 'Sign in',
  },
  hero: {
    title: 'Library',
    subtitle: 'Saved media you can reuse across generations.',
    ctas: {
      image: 'Generate image',
      video: 'Generate video',
    },
  },
  views: {
    saved: 'Saved assets',
    review: 'Review recent renders',
  },
  media: {
    images: 'Images',
    videos: 'Videos',
    audio: 'Audio',
  },
  browser: {
    searchPlaceholder: 'Search assets…',
    sourcesTitle: 'Saved Library',
    toolsTitle: 'Create or transform',
    toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
    emptySearch: 'No assets match this search.',
    import: 'Import',
    importing: 'Importing…',
    importFailed: 'Import failed. Please try again.',
    refresh: 'Refresh',
    loadMore: 'Load more',
  },
  tabs: {
    all: 'All images',
    upload: 'Uploaded images',
    generated: 'Saved renders',
    recent: 'Recent renders',
    character: 'Character assets',
    angle: 'Angle assets',
    upscale: 'Upscale assets',
  },
  review: {
    subtitle: 'Choose recent renders to save as reusable Library assets.',
    sourcesTitle: 'History',
    helper: 'Choose recent renders to save as reusable Library assets.',
    empty: 'No recent renders yet. Generate something first, then save the outputs you want to reuse.',
    loadError: 'Unable to load recent renders.',
    saveButton: 'Save to Library',
    saving: 'Saving…',
    saved: 'Saved',
    saveError: 'Unable to save this render to Library.',
    openRender: 'Open render',
  },
  assets: {
    title: 'Library assets',
    countLabel: '{count}',
    loadError: 'Unable to load saved assets.',
    empty: 'Your Library is empty. Import media or review recent renders to save reusable assets.',
    emptyUploads: 'No uploaded media yet. Import media from your device to see it here.',
    emptyGenerated: 'No saved renders yet. Review recent renders and save the outputs you want to reuse.',
    emptyCharacter: 'No character assets saved yet. Generate one in Character Builder to see it here.',
    emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool to see it here.',
    emptyUpscale: 'No upscale assets saved yet. Save an upscale result to see it here.',
    deleteError: 'Unable to delete this asset.',
    deleteButton: 'Delete',
    downloadButton: 'Download',
    openAssetButton: 'Open asset',
    useSettingsButton: 'Open source',
    deleting: 'Deleting…',
    assetFallback: 'Asset',
  },
};

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

const assetsFetcher = async (url: string): Promise<AssetsResponse> => {
  const res = await authFetch(url);
  const json = (await res.json().catch(() => null)) as AssetsResponse | null;
  if (!res.ok || !json) {
    throw new Error(json && typeof json.error === 'string' ? json.error : 'Failed to load assets');
  }
  return json;
};

const recentOutputsFetcher = async (url: string): Promise<RecentOutputsResponse> => {
  const res = await authFetch(url);
  const json = (await res.json().catch(() => null)) as RecentOutputsResponse | null;
  if (!res.ok || !json) {
    throw new Error(json && typeof json.error === 'string' ? json.error : 'Failed to load recent renders');
  }
  return json;
};

function resolveImageUploadErrorMessage(status: number, errorCode: unknown, fallback: string): string {
  return translateError({
    code: typeof errorCode === 'string' ? errorCode : null,
    status,
    message: fallback,
  }).message;
}

function inferKind(asset: Pick<UserAsset, 'kind' | 'mime'>): LibraryKind {
  if (asset.kind === 'audio' || asset.mime?.startsWith('audio/')) return 'audio';
  if (asset.kind === 'video' || asset.mime?.startsWith('video/')) return 'video';
  return 'image';
}

function normalizeSourceForHref(source?: string | null): string | null {
  if (source === 'saved_job_output') return 'generated';
  return source ?? null;
}

function isMaxVideoGeneratedAsset(asset: Pick<AssetBrowserAsset, 'jobId' | 'source'>): boolean {
  if (!asset.jobId) return false;
  const source = normalizeSourceForHref(asset.source);
  return source === 'generated' || source === 'recent' || source === 'character' || source === 'upscale';
}

function getAssetJobHref(asset: Pick<AssetBrowserAsset, 'jobId' | 'source' | 'kind'>): string | null {
  if (!isMaxVideoGeneratedAsset(asset)) return null;
  const jobId = asset.jobId;
  if (!jobId) return null;
  const source = normalizeSourceForHref(asset.source);
  if (source === 'angle') return null;
  if (source === 'character') {
    return `/app/tools/character-builder?job=${encodeURIComponent(jobId)}`;
  }
  if (source === 'upscale') {
    return `/app/tools/upscale?job=${encodeURIComponent(jobId)}`;
  }
  if (asset.kind === 'image' || jobId.startsWith('img_')) {
    return `/app/image?job=${encodeURIComponent(jobId)}`;
  }
  if (asset.kind === 'audio') {
    return `/app/audio?job=${encodeURIComponent(jobId)}`;
  }
  return `/app?job=${encodeURIComponent(jobId)}`;
}

const LIBRARY_PAGE_SIZE = 60;

export default function LibraryPage() {
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

  const savedAssetsKey = user
    ? activeSource === 'all'
      ? `/api/media-library/assets?limit=${savedAssetLimit}&kind=${encodeURIComponent(activeKind)}`
      : `/api/media-library/assets?limit=${savedAssetLimit}&kind=${encodeURIComponent(activeKind)}&source=${encodeURIComponent(activeSource)}`
    : null;
  const recentOutputsKey = user
    ? `/api/media-library/recent-outputs?limit=${recentOutputLimit}&kind=${encodeURIComponent(activeKind)}`
    : null;

  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
    isValidating: assetsValidating,
    mutate: mutateAssets,
  } = useSWR<AssetsResponse>(savedAssetsKey, assetsFetcher, {
    dedupingInterval: 60_000,
  });
  const {
    data: recentData,
    error: recentError,
    isLoading: recentLoading,
    isValidating: recentValidating,
    mutate: mutateRecentOutputs,
  } = useSWR<RecentOutputsResponse>(activeView === 'review' ? recentOutputsKey : null, recentOutputsFetcher, {
    dedupingInterval: 30_000,
  });

  const assets = useMemo(
    () =>
      (assetsData?.assets ?? []).filter((asset) =>
        toolsEnabled ? true : asset.source !== 'character' && asset.source !== 'angle'
      ),
    [assetsData?.assets, toolsEnabled]
  );
  const savedBrowserAssets = useMemo<AssetBrowserAsset[]>(
    () =>
      assets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        thumbUrl: asset.thumbUrl,
        previewUrl: asset.previewUrl,
        kind: inferKind(asset),
        width: asset.width,
        height: asset.height,
        size: asset.size,
        mime: asset.mime,
        source: asset.source,
        createdAt: asset.createdAt,
        canDelete: true,
        jobId: asset.jobId ?? null,
        sourceOutputId: asset.sourceOutputId ?? null,
      })),
    [assets]
  );
  const reviewBrowserAssets = useMemo<AssetBrowserAsset[]>(
    () =>
      (recentData?.outputs ?? [])
        .filter((output) => output.kind === activeKind)
        .map((output) => ({
          id: output.id,
          url: output.url,
          thumbUrl: output.thumbUrl,
          previewUrl: output.previewUrl,
          kind: activeKind,
          width: output.width,
          height: output.height,
          size: null,
          mime: output.mime,
          source: 'recent',
          createdAt: output.createdAt,
          canDelete: false,
          jobId: output.jobId,
          sourceOutputId: output.id,
          isSaved: Boolean(output.isSaved),
          savedAssetId: output.savedAssetId ?? null,
        })),
    [activeKind, recentData?.outputs]
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingOutputIds, setSavingOutputIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
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
  const currentAssets = activeView === 'saved' ? savedBrowserAssets : reviewBrowserAssets;
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

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      setImportError(null);
      setSaveError(null);
      setIsImporting(true);
      try {
        const preparedFile =
          activeKind === 'image'
            ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
            : file;
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const uploadEndpoint =
          activeKind === 'video'
            ? '/api/uploads/video'
            : activeKind === 'audio'
              ? '/api/uploads/audio'
              : '/api/uploads/image';
        const response = await authFetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          const message = resolveImageUploadErrorMessage(response.status, payload?.error, copy.browser.importFailed);
          throw new Error(message);
        }

        setActiveView('saved');
        if (activeSource !== 'all' && activeSource !== 'upload') {
          setActiveSource('upload');
        }
        await mutateAssets();
      } catch (error) {
        setImportError(error instanceof Error ? error.message : copy.browser.importFailed);
      } finally {
        setIsImporting(false);
      }
    },
    [activeKind, activeSource, copy.browser.importFailed, mutateAssets]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      setDeletingId(assetId);
      setDeleteError(null);
      setSaveError(null);
      try {
        const response = await authFetch(`/api/media-library/assets/${encodeURIComponent(assetId)}`, {
          method: 'DELETE',
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.assets.deleteError);
        }
        await Promise.all([mutateAssets(), mutateRecentOutputs()]);
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : copy.assets.deleteError);
      } finally {
        setDeletingId((current) => (current === assetId ? null : current));
      }
    },
    [copy.assets.deleteError, mutateAssets, mutateRecentOutputs]
  );

  const handleSaveRecentOutput = useCallback(
    async (asset: AssetBrowserAsset) => {
      if (!asset.jobId || !asset.sourceOutputId || asset.isSaved) return;
      const outputId = asset.sourceOutputId;
      setSaveError(null);
      setSavingOutputIds((previous) => {
        const next = new Set(previous);
        next.add(outputId);
        return next;
      });
      try {
        const response = await authFetch('/api/media-library/save-output', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: asset.jobId, outputId }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.review.saveError);
        }
        await Promise.all([mutateRecentOutputs(), mutateAssets()]);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : copy.review.saveError);
      } finally {
        setSavingOutputIds((previous) => {
          const next = new Set(previous);
          next.delete(outputId);
          return next;
        });
      }
    },
    [copy.review.saveError, mutateAssets, mutateRecentOutputs]
  );

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
                  setDeleteError(null);
                  setDeletingId(null);
                  setImportError(null);
                  setSaveError(null);
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
                        setDeleteError(null);
                        setImportError(null);
                        setSaveError(null);
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
