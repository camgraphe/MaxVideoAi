'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  AssetLibraryBrowser,
  type AssetBrowserAsset,
  type AssetLibrarySource,
} from '@/components/library/AssetLibraryBrowser';
import type { UpscaleMediaType } from '@/types/tools-upscale';

type UpscaleLibraryModalCopy = {
  libraryBody: string;
  libraryCount: string;
  libraryEmptyImages: string;
  libraryEmptySearch: string;
  libraryEmptyVideos: string;
  libraryRefresh: string;
  librarySearch: string;
  librarySourcesTitle: string;
  libraryTabs: Partial<Record<AssetLibrarySource, string>>;
  libraryTitle: string;
  libraryUse: string;
};

interface UpscaleLibraryModalProps {
  assets: AssetBrowserAsset[];
  copy: UpscaleLibraryModalCopy;
  error: string | null;
  isLoading: boolean;
  mediaType: UpscaleMediaType;
  onClose: () => void;
  onRefresh: (options: { kind: UpscaleMediaType; source: AssetLibrarySource }) => void;
  onSelectAsset: (asset: AssetBrowserAsset) => void;
  onSourceChange: (source: AssetLibrarySource) => void;
  open: boolean;
  source: AssetLibrarySource;
  sourceOptions: readonly AssetLibrarySource[];
}

export function UpscaleLibraryModal({
  assets,
  copy,
  error,
  isLoading,
  mediaType,
  onClose,
  onRefresh,
  onSelectAsset,
  onSourceChange,
  open,
  source,
  sourceOptions,
}: UpscaleLibraryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay-bg px-3 py-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close library" onClick={onClose} />
      <AssetLibraryBrowser
        className="relative z-10 h-[88svh] max-w-[1180px]"
        title={copy.libraryTitle}
        subtitle={copy.libraryBody}
        countLabel={copy.libraryCount.replace('{count}', String(assets.length))}
        onClose={onClose}
        closeLabel="Close"
        assetType={mediaType}
        assets={assets}
        isLoading={isLoading}
        error={error}
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
            className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            onClick={() => onRefresh({ kind: mediaType, source })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {copy.libraryRefresh}
          </Button>
        }
        renderAssetActions={(asset) => (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="min-h-[34px] flex-1 rounded-full border-brand px-2.5 py-1 text-[11px] uppercase tracking-micro sm:min-h-[36px] sm:flex-none sm:px-3 sm:text-[12px]"
            onClick={() => onSelectAsset(asset)}
          >
            {copy.libraryUse}
          </Button>
        )}
        renderAssetMeta={(asset) => (asset.source ? <span className="capitalize">{asset.source}</span> : null)}
      />
    </div>
  );
}
