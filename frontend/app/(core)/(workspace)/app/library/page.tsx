'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';

type UserAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  createdAt?: string;
};

type AssetsResponse = {
  ok: boolean;
  assets: UserAsset[];
};

const fetcher = async (url: string): Promise<AssetsResponse> => {
  const res = await fetch(url, { credentials: 'include' });
  const json = (await res.json().catch(() => null)) as AssetsResponse | null;
  if (!res.ok || !json) {
    throw new Error(json?.['error'] ?? 'Failed to load assets');
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
  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
    mutate: mutateAssets,
  } = useSWR<AssetsResponse>('/api/user-assets', fetcher);
  const assets = assetsData?.assets ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      setDeletingId(assetId);
      setDeleteError(null);
      try {
        const response = await fetch('/api/user-assets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: assetId }),
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Failed to delete image');
        }
        await mutateAssets();
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : 'Unable to delete this image.');
      } finally {
        setDeletingId((current) => (current === assetId ? null : current));
      }
    },
    [mutateAssets]
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Library</h1>
              <p className="text-sm text-text-secondary">Import, organize, and reuse reference assets.</p>
            </div>
            <div className="flex gap-2 text-sm text-text-secondary">
              <Link href="/app/image" className="rounded-input border border-border px-3 py-1 hover:bg-white/70">
                Generate image
              </Link>
              <Link href="/app" className="rounded-input border border-border px-3 py-1 hover:bg-white/70">
                Generate video
              </Link>
            </div>
          </div>

          <section className="rounded-card border border-border bg-white/80 p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Library assets</h2>
              <span className="text-xs text-text-secondary">{assets.length}</span>
            </div>

            {deleteError ? (
              <div className="mb-4 rounded-input border border-state-warning/50 bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                {deleteError}
              </div>
            ) : null}

            {assetsLoading && assets.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`asset-skeleton-${index}`} className="rounded-card border border-hairline bg-white/60">
                    <div className="relative aspect-square rounded-t-card bg-neutral-100">
                      <div className="skeleton absolute inset-0" />
                    </div>
                    <div className="border-t border-border px-4 py-3">
                      <div className="h-3 w-28 rounded bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assetsError ? (
              <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
                Unable to load imported assets.
              </div>
            ) : assets.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                No imported assets yet. Upload references from the composer or drop files here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {assets.map((asset) => (
                  <article key={asset.id} className="rounded-card border border-border bg-white shadow-card">
                    <div className="relative aspect-square overflow-hidden rounded-t-card bg-[#f2f4f8]">
                      <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    </div>
                    <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-text-secondary">
                      <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? 'Asset'}</p>
                      <p className="text-text-secondary">{formatFileSize(asset.size)}</p>
                      {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id)}
                        disabled={deletingId === asset.id}
                        className="w-full rounded-input border border-state-warning/40 bg-state-warning/10 py-1 text-[11px] font-semibold text-state-warning transition hover:bg-state-warning/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === asset.id ? 'Deleting…' : 'Delete'}
                      </button>
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
