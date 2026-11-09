'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LibraryPickerDialog } from '@/components/library/LibraryPickerDialog.client';
import { usePaginatedMediaLibraryAssets } from '@/hooks/usePaginatedMediaLibraryAssets';
import { isLibraryImageAsset } from '@/lib/library-image';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { LibraryAsset } from '../_lib/angle-workspace-types';

export function AngleImageLibraryModal({
  open,
  userId,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  userId: string | null;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
  copy: AngleCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated'>('all');
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
      intent="angle:source"
      locale={locale}
      assetType="image"
      assets={assets}
      title={copy.libraryChoose}
      subtitle={copy.libraryBody}
      source={activeSource}
      availableSources={['all', 'upload', 'generated']}
      sourceLabels={copy.tabs}
      onSourceChange={(next) => setActiveSource(next as typeof activeSource)}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      onLoadMore={loadMore}
      loadMoreLabel={copy.libraryLoadMore}
      error={error ? copy.libraryError : null}
      searchPlaceholder={copy.library}
      sourcesTitle={copy.library}
      emptyLabel={copy.libraryEmpty}
      emptySearchLabel={copy.libraryEmpty}
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
