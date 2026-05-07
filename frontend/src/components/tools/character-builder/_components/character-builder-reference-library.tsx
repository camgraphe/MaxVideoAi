'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import useSWR from 'swr';
import { Images, Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import type { CharacterBuilderReferenceImage } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { CharacterLibraryAsset, CharacterLibraryAssetsResponse } from '../_lib/character-builder-types';

export function ReferenceSlot({
  title,
  subtitle,
  image,
  onUpload,
  onOpenLibrary,
  onRemove,
  disabled = false,
  removeLabel,
  libraryLabel,
  optionalLabel,
}: {
  title: string;
  subtitle: string;
  image: CharacterBuilderReferenceImage | null;
  onUpload: () => void;
  onOpenLibrary: () => void;
  onRemove: () => void;
  disabled?: boolean;
  removeLabel: string;
  libraryLabel: string;
  optionalLabel?: string;
}) {
  return (
    <div
      className={clsx(
        'w-full rounded-card border border-dashed p-4 text-left transition',
        image
          ? 'border-border bg-surface'
          : 'border-border bg-bg/50 hover:border-border-hover hover:bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {image ? (
        <div className="space-y-3">
          <button type="button" onClick={onUpload} disabled={disabled} className="block w-full text-left">
            <img src={image.url} alt={title} className="h-40 w-full rounded-input object-cover" />
            <div className="mt-3">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-1 text-xs text-text-secondary">{image.name ?? subtitle}</p>
            </div>
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onUpload}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              {removeLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              {optionalLabel ? (
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                  {optionalLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={onUpload} disabled={disabled}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary} disabled={disabled}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function isImageLibraryAsset(asset: CharacterLibraryAsset): boolean {
  if (typeof asset.mime === 'string' && asset.mime.toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(asset.url);
}

export function CharacterReferenceLibraryModal({
  open,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: CharacterLibraryAsset) => void;
  copy: CharacterCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR<CharacterLibraryAssetsResponse>(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as CharacterLibraryAssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(copy.library.error);
    }
    return payload ?? { ok: true, assets: [] };
  });

  const assets = (data?.assets ?? []).filter(isImageLibraryAsset);

  if (!open) return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
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
            <h2 className="text-lg font-semibold text-text-primary">{copy.library.choose}</h2>
            <p className="text-xs text-text-secondary">{copy.library.body}</p>
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
            aria-label={copy.library.open}
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {([
              ['all', copy.library.tabs.all],
              ['upload', copy.library.tabs.upload],
              ['generated', copy.library.tabs.generated],
              ['character', copy.library.tabs.character],
              ['angle', copy.library.tabs.angle],
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
              {error instanceof Error ? error.message : copy.library.error}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`character-library-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
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
              {copy.library.empty}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-border-hover hover:shadow-card"
                >
                  <div className="relative aspect-square overflow-hidden bg-bg/50">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {asset.source ?? copy.library.tabs.all}
                    </p>
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
