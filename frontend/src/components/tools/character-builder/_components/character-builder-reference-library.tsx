'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LibraryPickerDialog } from '@/components/library/LibraryPickerDialog.client';
import { Images, Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { usePaginatedMediaLibraryAssets } from '@/hooks/usePaginatedMediaLibraryAssets';
import { isLibraryImageAsset } from '@/lib/library-image';
import type { CharacterBuilderReferenceImage } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { CharacterLibraryAsset } from '../_lib/character-builder-types';

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
        image ? 'border-border bg-surface' : 'border-border bg-bg/50 hover:border-border-hover hover:bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-60',
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

export function CharacterReferenceLibraryModal({
  open,
  role,
  userId,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  role?: string | null;
  userId: string | null;
  onClose: () => void;
  onSelect: (asset: CharacterLibraryAsset) => void;
  copy: CharacterCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const source = activeSource === 'all' ? null : activeSource;
  const {
    assets: paginatedAssets,
    error,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
  } = usePaginatedMediaLibraryAssets({
    enabled: open,
    userId,
    kind: 'image',
    source,
  });

  const assets = paginatedAssets.filter(isLibraryImageAsset).map((asset) => ({
    ...asset,
    kind: 'image' as const,
    source: asset.source === 'saved_job_output' ? 'generated' : asset.source,
  }));

  const { locale } = useI18n();
  return (
    <LibraryPickerDialog
      open={open}
      userId={userId}
      intent={`character:${role ?? 'identity'}`}
      locale={locale}
      assetType="image"
      assets={assets}
      title={copy.library.choose}
      subtitle={copy.library.body}
      source={activeSource}
      availableSources={['all', 'upload', 'generated', 'character', 'angle']}
      sourceLabels={copy.library.tabs}
      onSourceChange={(next) => setActiveSource(next as typeof activeSource)}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      onLoadMore={loadMore}
      error={error ? copy.library.error : null}
      searchPlaceholder={copy.library.open}
      sourcesTitle={copy.library.open}
      emptyLabel={copy.library.empty}
      emptySearchLabel={copy.library.empty}
      onClose={onClose}
      closeLabel={copy.close}
      renderAssetActions={() => null}
      selection={{
        onConfirm: (asset) =>
          onSelect({ ...asset, width: asset.width ?? undefined, height: asset.height ?? undefined }),
      }}
    />
  );
}
