'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LibraryPickerDialog } from '@/components/library/LibraryPickerDialog.client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { type AssetBrowserAsset, type AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import type { UpscaleMediaType } from '@/types/tools-upscale';

type UpscaleLibraryModalCopy = {
  libraryBody: string;
  libraryCount: string;
  libraryEmptyImages: string;
  libraryEmptySearch: string;
  libraryEmptyVideos: string;
  libraryLoadMore: string;
  libraryRefresh: string;
  librarySearch: string;
  librarySourcesTitle: string;
  libraryTabs: Partial<Record<AssetLibrarySource, string>>;
  libraryTitle: string;
  libraryUse: string;
};

interface UpscaleLibraryModalProps {
  intent?: string;
  userId?: string | null;
  assets: AssetBrowserAsset[];
  copy: UpscaleLibraryModalCopy;
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  mediaType: UpscaleMediaType;
  onClose: () => void;
  onLoadMore: () => void;
  onRefresh: (options: { kind: UpscaleMediaType; source: AssetLibrarySource }) => void;
  onSelectAsset: import('@/components/library/ReferenceLibraryPicker.client').ReferencePickerSelection['onConfirm'];
  onSourceChange: (source: AssetLibrarySource) => void;
  open: boolean;
  source: AssetLibrarySource;
  sourceOptions: readonly AssetLibrarySource[];
}

export function UpscaleLibraryModal({
  userId,
  intent,
  open,
  assets,
  copy,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  mediaType,
  onClose,
  onLoadMore,
  onRefresh,
  onSelectAsset,
  onSourceChange,
  source,
  sourceOptions,
}: UpscaleLibraryModalProps) {
  const { locale } = useI18n();
  const close = locale === 'fr' ? 'Fermer' : locale === 'es' ? 'Cerrar' : 'Close';

  return (
    <LibraryPickerDialog
      open={open}
      userId={userId}
      intent={intent ?? `upscale:${mediaType}`}
      locale={locale}
      selection={{ onConfirm: onSelectAsset, sourceProof: mediaType === 'video' ? 'generated-video' : undefined }}
      className="relative z-10 h-[88svh] max-w-[1180px]"
      title={copy.libraryTitle}
      countLabel={copy.libraryCount.replace('{count}', String(assets.length))}
      onClose={onClose}
      closeLabel={close}
      assetType={mediaType}
      assets={assets}
      isLoading={isLoading}
      error={error}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      loadMoreLabel={copy.libraryLoadMore}
      onLoadMore={onLoadMore}
      source={source}
      availableSources={[...sourceOptions]}
      sourceLabels={copy.libraryTabs}
      onSourceChange={(nextSource) => {
        if (nextSource === source) return;
        onSourceChange(nextSource);
      }}
      searchPlaceholder={copy.librarySearch}
      sourcesTitle={copy.librarySourcesTitle}
      emptyLabel={mediaType === 'video' ? copy.libraryEmptyVideos : copy.libraryEmptyImages}
      emptySearchLabel={copy.libraryEmptySearch}
      headerActions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!min-h-11 rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
          onClick={() => onRefresh({ kind: mediaType, source })}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {copy.libraryRefresh}
        </Button>
      }
      renderAssetActions={() => null}
    />
  );
}
