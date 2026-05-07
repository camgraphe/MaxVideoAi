'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { LibraryAsset, LibraryAssetsResponse } from '../_lib/angle-workspace-types';

export function AngleImageLibraryModal({
  open,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
  copy: AngleCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR<LibraryAssetsResponse>(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as LibraryAssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(copy.libraryError);
    }
    return payload;
  });

  const assets = data?.assets ?? [];

  if (!open) return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.libraryChoose}</h2>
            <p className="text-xs text-text-secondary">{copy.libraryBody}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.close}
          </Button>
        </div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label={copy.library}
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {([
              ['all', copy.tabs.all],
              ['upload', copy.tabs.upload],
              ['generated', copy.tabs.generated],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={activeSource === value}
                onClick={() => setActiveSource(value)}
                className={clsx(
                  'flex-1 rounded-none px-4 py-2',
                  activeSource === value ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {error instanceof Error ? error.message : copy.libraryError}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`angle-library-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              {copy.libraryEmpty}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="group block w-full overflow-hidden rounded-card border border-border bg-surface text-left shadow-card transition hover:border-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-surface-on-media-dark-40 text-sm font-semibold text-on-inverse group-hover:flex">
                      {copy.useImage}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                    <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? copy.assetFallback}</p>
                    {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
