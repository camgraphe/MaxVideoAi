'use client';

export const dynamic = 'force-dynamic';

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import deepmerge from 'deepmerge';
import { Download, Trash2 } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';

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
  hero: {
    title: string;
    subtitle: string;
    ctas: {
      image: string;
      video: string;
    };
  };
  tabs: {
    all: string;
    upload: string;
    generated: string;
  };
  assets: {
    title: string;
    countLabel: string;
    loadError: string;
    empty: string;
    emptyUploads: string;
    emptyGenerated: string;
    deleteError: string;
    deleteButton: string;
    downloadButton: string;
    useSettingsButton: string;
    deleting: string;
    assetFallback: string;
  };
}

const DEFAULT_LIBRARY_COPY: LibraryCopy = {
  hero: {
    title: 'Library',
    subtitle: 'Import, organize, and reuse reference assets.',
    ctas: {
      image: 'Generate image',
      video: 'Generate video',
    },
  },
  tabs: {
    all: 'All images',
    upload: 'Uploaded images',
    generated: 'Generated images',
  },
  assets: {
    title: 'Library assets',
    countLabel: '{count}',
    loadError: 'Unable to load imported assets.',
    empty: 'No imported assets yet. Upload references from the composer or drop files here.',
    emptyUploads: 'No uploaded images yet. Upload references from the composer or drop files here.',
    emptyGenerated: 'No generated images saved yet. Generate an image and save it to your library.',
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

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryPage() {
  const { t } = useI18n();
  const rawCopy = t('workspace.library', DEFAULT_LIBRARY_COPY);
  const copy = useMemo<LibraryCopy>(() => {
    return deepmerge<LibraryCopy>(DEFAULT_LIBRARY_COPY, (rawCopy ?? {}) as Partial<LibraryCopy>);
  }, [rawCopy]);
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated'>('all');
  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
    mutate: mutateAssets,
  } = useSWR<AssetsResponse>(
    activeSource === 'all'
      ? '/api/user-assets?limit=200'
      : `/api/user-assets?limit=200&source=${encodeURIComponent(activeSource)}`,
    fetcher,
    {
      dedupingInterval: 60_000,
    }
  );
  const assets = assetsData?.assets ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const assetCountLabel = formatTemplate(copy.assets.countLabel, { count: assets.length });
  const emptyLabel =
    activeSource === 'generated'
      ? copy.assets.emptyGenerated
      : activeSource === 'upload'
        ? copy.assets.emptyUploads
        : copy.assets.empty;

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
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{copy.hero.title}</h1>
              <p className="text-sm text-text-secondary">{copy.hero.subtitle}</p>
            </div>
            <div className="flex gap-2 text-sm text-text-secondary">
              <ButtonLink href="/app/image" prefetch={false} variant="outline" size="md" className="px-3">
                {copy.hero.ctas.image}
              </ButtonLink>
              <ButtonLink href="/app" prefetch={false} variant="outline" size="md" className="px-3">
                {copy.hero.ctas.video}
              </ButtonLink>
            </div>
          </div>

          <section className="rounded-card border border-border bg-surface-glass-80 p-5 shadow-card">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-4 sm:justify-start">
                <h2 className="text-lg font-semibold text-text-primary">{copy.assets.title}</h2>
                <span className="text-xs text-text-secondary">{assetCountLabel}</span>
              </div>

              <div
                role="tablist"
                aria-label="Library image filters"
                className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary sm:w-auto"
              >
                <Button
                  type="button"
                  role="tab"
                  variant={activeSource === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  aria-selected={activeSource === 'all'}
                  onClick={() => {
                    setActiveSource('all');
                    setDeleteError(null);
                    setDeletingId(null);
                  }}
                  className={`flex-1 rounded-none px-4 py-2 sm:flex-none ${
                    activeSource === 'all' ? 'hover:bg-brandHover' : 'text-text-secondary hover:bg-surface'
                  }`}
                >
                  {copy.tabs.all}
                </Button>
                <Button
                  type="button"
                  role="tab"
                  variant={activeSource === 'upload' ? 'primary' : 'ghost'}
                  size="sm"
                  aria-selected={activeSource === 'upload'}
                  onClick={() => {
                    setActiveSource('upload');
                    setDeleteError(null);
                    setDeletingId(null);
                  }}
                  className={`flex-1 rounded-none px-4 py-2 sm:flex-none ${
                    activeSource === 'upload' ? 'hover:bg-brandHover' : 'text-text-secondary hover:bg-surface'
                  }`}
                >
                  {copy.tabs.upload}
                </Button>
                <Button
                  type="button"
                  role="tab"
                  variant={activeSource === 'generated' ? 'primary' : 'ghost'}
                  size="sm"
                  aria-selected={activeSource === 'generated'}
                  onClick={() => {
                    setActiveSource('generated');
                    setDeleteError(null);
                    setDeletingId(null);
                  }}
                  className={`flex-1 rounded-none px-4 py-2 sm:flex-none ${
                    activeSource === 'generated'
                      ? 'hover:bg-brandHover'
                      : 'text-text-secondary hover:bg-surface'
                  }`}
                >
                  {copy.tabs.generated}
                </Button>
              </div>
            </div>

            {deleteError ? (
              <div className="mb-4 rounded-input border border-state-warning/50 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                {deleteError}
              </div>
            ) : null}

            {assetsLoading && assets.length === 0 ? (
              <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`asset-skeleton-${index}`} className="rounded-card border border-hairline bg-surface-glass-60">
                    <div className="relative aspect-square rounded-t-card bg-placeholder">
                      <div className="skeleton absolute inset-0" />
                    </div>
                    <div className="border-t border-border px-4 py-3">
                      <div className="h-3 w-28 rounded bg-skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assetsError ? (
              <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
                {copy.assets.loadError}
              </div>
            ) : assets.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                {emptyLabel || copy.assets.empty}
              </div>
            ) : (
              <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-4">
                {assets.map((asset) => (
                  <article key={asset.id} className="rounded-card border border-border bg-surface shadow-card">
                    <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                      <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    </div>
                    <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-text-secondary">
                      <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? copy.assets.assetFallback}</p>
                      <p className="text-text-secondary">{formatFileSize(asset.size)}</p>
                      {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                      <div className="flex items-center gap-2">
                        {asset.jobId ? (
                          <ButtonLink
                            href={
                              asset.jobId.startsWith('img_')
                                ? `/app/image?job=${encodeURIComponent(asset.jobId)}`
                                : `/app?job=${encodeURIComponent(asset.jobId)}`
                            }
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 border-border/70 bg-surface py-1 text-[11px] text-text-secondary hover:border-text-muted hover:text-text-primary"
                            aria-label={copy.assets.useSettingsButton}
                          >
                            <span>{copy.assets.useSettingsButton}</span>
                          </ButtonLink>
                        ) : null}
                        <ButtonLink
                          linkComponent="a"
                          href={asset.url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 border-border/70 bg-surface py-1 text-[11px] text-text-secondary hover:border-text-muted hover:text-text-primary"
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
                          className="h-8 w-8 min-h-0 rounded-full border border-state-warning/40 bg-state-warning/10 p-0 text-state-warning hover:bg-state-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={copy.assets.deleteButton}
                        >
                          {deletingId === asset.id ? (
                            <span className="text-[10px] font-semibold">{copy.assets.deleting}</span>
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
