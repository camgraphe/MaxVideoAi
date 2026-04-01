'use client';

export const dynamic = 'force-dynamic';

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import useSWR from 'swr';
import deepmerge from 'deepmerge';
import { Download, Trash2 } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { translateError } from '@/lib/error-messages';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type UserAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  jobId?: string | null;
  createdAt?: string;
};

type AssetsResponse = {
  ok: boolean;
  assets: UserAsset[];
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
  };
  tabs: {
    all: string;
    upload: string;
    generated: string;
    character: string;
    angle: string;
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
    deleteError: string;
    deleteButton: string;
    downloadButton: string;
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
    subtitle: 'Import, organize, and reuse reference assets.',
    ctas: {
      image: 'Generate image',
      video: 'Generate video',
    },
  },
  browser: {
    searchPlaceholder: 'Search assets…',
    sourcesTitle: 'Library',
    toolsTitle: 'Create or transform',
    toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
    emptySearch: 'No assets match this search.',
    import: 'Import',
    importing: 'Importing…',
    importFailed: 'Import failed. Please try again.',
    refresh: 'Refresh',
  },
  tabs: {
    all: 'All images',
    upload: 'Uploaded images',
    generated: 'Generated images',
    character: 'Character assets',
    angle: 'Angle assets',
  },
  assets: {
    title: 'Library assets',
    countLabel: '{count}',
    loadError: 'Unable to load imported assets.',
    empty: 'No imported assets yet. Upload references from the composer or drop files here.',
    emptyUploads: 'No uploaded images yet. Upload references from the composer or drop files here.',
    emptyGenerated: 'No generated images saved yet. Generate an image and save it to your library.',
    emptyCharacter: 'No character assets saved yet. Generate one in Character Builder to see it here.',
    emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool to see it here.',
    deleteError: 'Unable to delete this image.',
    deleteButton: 'Delete',
    downloadButton: 'Download',
    useSettingsButton: 'Use settings',
    deleting: 'Deleting…',
    assetFallback: 'Asset',
  },
};

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

const fetcher = async (url: string): Promise<AssetsResponse> => {
  const res = await authFetch(url);
  const json = (await res.json().catch(() => null)) as AssetsResponse | null;
  if (!res.ok || !json) {
    let message: string | undefined;
    if (json && typeof json === 'object' && 'error' in json) {
      const maybeError = (json as { error?: unknown }).error;
      if (typeof maybeError === 'string') {
        message = maybeError;
      }
    }
    throw new Error(message ?? 'Failed to load assets');
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

function getAssetJobHref(asset: UserAsset): string | null {
  if (!asset.jobId) return null;
  if (asset.source === 'angle') return null;
  if (asset.source === 'character') {
    return `/app/tools/character-builder?job=${encodeURIComponent(asset.jobId)}`;
  }
  if (asset.source === 'generated') {
    return `/app/image?job=${encodeURIComponent(asset.jobId)}`;
  }
  return asset.jobId.startsWith('img_')
    ? `/app/image?job=${encodeURIComponent(asset.jobId)}`
    : `/app?job=${encodeURIComponent(asset.jobId)}`;
}

export default function LibraryPage() {
  const toolsEnabled = FEATURES.workflows.toolsSection;
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const rawCopy = t('workspace.library', DEFAULT_LIBRARY_COPY);
  const copy = useMemo<LibraryCopy>(() => {
    return deepmerge<LibraryCopy>(DEFAULT_LIBRARY_COPY, (rawCopy ?? {}) as Partial<LibraryCopy>);
  }, [rawCopy]);
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const assetsKey = user
    ? activeSource === 'all'
      ? '/api/user-assets?limit=200'
      : `/api/user-assets?limit=200&source=${encodeURIComponent(activeSource)}`
    : null;
  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
    mutate: mutateAssets,
  } = useSWR<AssetsResponse>(assetsKey, fetcher, {
    dedupingInterval: 60_000,
  });
  const assets = useMemo(
    () =>
      (assetsData?.assets ?? []).filter((asset) =>
        toolsEnabled ? true : asset.source !== 'character' && asset.source !== 'angle'
      ),
    [assetsData?.assets, toolsEnabled]
  );
  const browserAssets = useMemo(
    () =>
      assets.map((asset) => ({
        ...asset,
        kind: 'image' as const,
      })),
    [assets]
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const availableSources = useMemo(
    () =>
      toolsEnabled
        ? (['all', 'upload', 'generated', 'character', 'angle'] as const)
        : (['all', 'upload', 'generated'] as const),
    [toolsEnabled]
  );
  const assetCountLabel = formatTemplate(copy.assets.countLabel, { count: assets.length });
  const emptyLabel =
    activeSource === 'generated'
      ? copy.assets.emptyGenerated
      : activeSource === 'upload'
        ? copy.assets.emptyUploads
        : activeSource === 'character'
          ? copy.assets.emptyCharacter
        : activeSource === 'angle'
            ? copy.assets.emptyAngle
        : copy.assets.empty;
  const toolLinks = toolsEnabled
    ? [
        { href: '/app/image', label: copy.hero.ctas.image },
        { href: '/app/tools/angle', label: copy.tabs.angle.replace(/ assets?$/i, '') || 'Angle' },
        { href: '/app/tools/character-builder', label: copy.tabs.character.replace(/ assets?$/i, '') || 'Character' },
      ]
    : [{ href: '/app/image', label: copy.hero.ctas.image }];

  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource('all');
    }
  }, [activeSource, availableSources]);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      setImportError(null);
      setIsImporting(true);
      try {
        const preparedFile = await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          const message = resolveImageUploadErrorMessage(response.status, payload?.error, copy.browser.importFailed);
          throw new Error(message);
        }

        if (activeSource !== 'all' && activeSource !== 'upload') {
          setActiveSource('upload');
        } else {
          await mutateAssets();
        }
      } catch (error) {
        setImportError(error instanceof Error ? error.message : copy.browser.importFailed);
      } finally {
        setIsImporting(false);
      }
    },
    [activeSource, copy.browser.importFailed, mutateAssets]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      setDeletingId(assetId);
      setDeleteError(null);
      try {
        const response = await authFetch('/api/user-assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: assetId }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? copy.assets.deleteError);
        }
        await mutateAssets();
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : copy.assets.deleteError);
      } finally {
        setDeletingId((current) => (current === assetId ? null : current));
      }
    },
    [copy.assets.deleteError, mutateAssets]
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:overflow-hidden lg:p-7">
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
            <>
              <div className="pb-8 lg:h-full lg:min-h-0 lg:pb-0">
                <input
                  ref={importInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImportChange}
                />
                <AssetLibraryBrowser
                  layout="page"
                  title={copy.hero.title}
                  subtitle={copy.hero.subtitle}
                  countLabel={assetCountLabel}
                  assetType="image"
                  assets={browserAssets}
                  isLoading={assetsLoading && browserAssets.length === 0}
                  error={importError ?? deleteError ?? (assetsError ? copy.assets.loadError : null)}
                  source={activeSource}
                  availableSources={[...availableSources]}
                  sourceLabels={copy.tabs}
                  onSourceChange={(source) => {
                    setActiveSource(source);
                    setDeleteError(null);
                    setDeletingId(null);
                    setImportError(null);
                  }}
                  searchPlaceholder={copy.browser.searchPlaceholder}
                  sourcesTitle={copy.browser.sourcesTitle}
                  emptyLabel={emptyLabel || copy.assets.empty}
                  emptySearchLabel={copy.browser.emptySearch}
                  toolsTitle={copy.browser.toolsTitle}
                  toolsDescription={copy.browser.toolsDescription}
                  toolLinks={toolLinks}
                  headerActions={
                    <>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        onClick={() => {
                          setDeleteError(null);
                          setImportError(null);
                          void mutateAssets();
                        }}
                      >
                        {copy.browser.refresh}
                      </Button>
                      <ButtonLink href="/app/image" prefetch={false} variant="outline" size="sm" className="rounded-full px-3 text-sm">
                        {copy.hero.ctas.image}
                      </ButtonLink>
                      <ButtonLink href="/app" prefetch={false} variant="outline" size="sm" className="rounded-full px-3 text-sm">
                        {copy.hero.ctas.video}
                      </ButtonLink>
                    </>
                  }
                  renderAssetMeta={(asset) =>
                    asset.createdAt ? <span className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</span> : null
                  }
                  renderAssetActions={(asset) => (
                    <>
                      {getAssetJobHref(asset) ? (
                        <ButtonLink
                          href={getAssetJobHref(asset) ?? '#'}
                          variant="outline"
                          size="sm"
                          className="min-h-[34px] flex-1 gap-1 rounded-full border-border/70 bg-surface px-2.5 py-1 text-[11px] text-text-secondary hover:border-text-muted hover:text-text-primary sm:min-h-[36px] sm:flex-none sm:px-3"
                          aria-label={copy.assets.useSettingsButton}
                        >
                          <span>{copy.assets.useSettingsButton}</span>
                        </ButtonLink>
                      ) : null}
                      <ButtonLink
                        linkComponent="a"
                        href={buildAppDownloadUrl(asset.url, suggestDownloadFilename(asset.url, asset.url.split('/').pop() ?? 'asset'))}
                        variant="outline"
                        size="sm"
                        className="min-h-[34px] flex-1 gap-1 rounded-full border-border/70 bg-surface px-2.5 py-1 text-[11px] text-text-secondary hover:border-text-muted hover:text-text-primary sm:min-h-[36px] sm:flex-none sm:px-3"
                        aria-label={`${copy.assets.downloadButton} ${asset.url.split('/').pop() ?? copy.assets.assetFallback}`}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        <span>{copy.assets.downloadButton}</span>
                      </ButtonLink>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAsset(asset.id)}
                        disabled={deletingId === asset.id}
                        className="h-9 w-9 min-h-0 rounded-full border border-state-warning/40 bg-state-warning/10 p-0 text-state-warning hover:bg-state-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={copy.assets.deleteButton}
                      >
                        {deletingId === asset.id ? (
                          <span className="text-[10px] font-semibold">{copy.assets.deleting}</span>
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </>
                  )}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
