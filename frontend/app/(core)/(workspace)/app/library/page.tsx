'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useInfiniteJobs } from '@/lib/api';
import type { Job } from '@/types/jobs';
import { listFalEngines } from '@/config/falEngines';

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

const IMAGE_ENGINE_IDS = new Set(
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .map((engine) => engine.id)
);

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
  const { data: assetsData, error: assetsError, isLoading: assetsLoading } = useSWR<AssetsResponse>('/api/user-assets', fetcher);
  const { data, isLoading, isValidating, size, setSize, error } = useInfiniteJobs(24);

  const pages = data ?? [];
  const jobs = pages.flatMap((page) => page.jobs);
  const imageJobs = useMemo(() => jobs.filter(isImageJob), [jobs]);
  const hasMore = pages.length === 0 ? false : pages[pages.length - 1].nextCursor !== null;

  const assets = assetsData?.assets ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Library</h1>
              <p className="text-sm text-text-secondary">Generate, import, and reuse assets across your workspace.</p>
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

          <section className="mb-8 rounded-card border border-border bg-white/80 p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Generated images</h2>
              <span className="text-xs text-text-secondary">{imageJobs.length}</span>
            </div>
            {isLoading && imageJobs.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`library-image-skeleton-${index}`} className="rounded-card border border-hairline bg-white/60">
                    <div className="relative aspect-square rounded-t-card bg-neutral-100">
                      <div className="skeleton absolute inset-0" />
                    </div>
                    <div className="border-t border-border px-4 py-3">
                      <div className="h-3 w-24 rounded bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : imageJobs.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                No generated images yet. Run a text-to-image or edit generation to populate this section.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {imageJobs.map((job) => (
                  <article key={job.jobId} className="rounded-card border border-border bg-white shadow-card">
                    <div className="rounded-t-card bg-[#f2f4f8] p-1">
                      {job.renderIds && job.renderIds.length ? (
                        <div className="grid grid-cols-2 gap-1">
                          {job.renderIds.slice(0, 4).map((url, index) => (
                            <div key={`${job.jobId}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
                              <img src={url} alt={job.prompt} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                            </div>
                          ))}
                        </div>
                      ) : job.thumbUrl ? (
                        <img src={job.thumbUrl} alt={job.prompt} className="h-full w-full rounded-xl object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-xs text-text-secondary">No preview</div>
                      )}
                    </div>
                    <div className="space-y-2 border-t border-border px-4 py-3 text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">{job.engineLabel}</p>
                      <p className="line-clamp-2 text-xs text-text-secondary">{job.prompt}</p>
                      <div className="text-[11px] text-text-muted">{formatTimestamp(job.createdAt)}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setSize(size + 1)}
                  disabled={isValidating}
                  className="rounded-input border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/80 disabled:opacity-60"
                >
                  {isValidating ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
            {error && !isLoading && (
              <p className="mt-2 text-sm text-state-warning">Failed to load generated jobs. Please retry.</p>
            )}
          </section>

          <section className="rounded-card border border-border bg-white/80 p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Imported assets</h2>
              <span className="text-xs text-text-secondary">{assets.length}</span>
            </div>
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
                    <div className="space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                      <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? 'Asset'}</p>
                      <p className="text-text-secondary">{formatFileSize(asset.size)}</p>
                      {asset.createdAt ? <p className="text-text-muted">{formatTimestamp(asset.createdAt)}</p> : null}
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

function isImageJob(job: Job): boolean {
  const engineId = job.engineId ?? '';
  if (engineId && IMAGE_ENGINE_IDS.has(engineId)) return true;
  return false;
}

function formatTimestamp(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}
