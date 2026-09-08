'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { useI18n } from '@/lib/i18n/I18nProvider';
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

export function UpscaleLibraryModal(props: UpscaleLibraryModalProps) {
  return props.open ? <UpscaleLibraryDialog {...props} /> : null;
}

function UpscaleLibraryDialog({
  assets,
  copy,
  error,
  isLoading,
  mediaType,
  onClose,
  onRefresh,
  onSelectAsset,
  onSourceChange,
  source,
  sourceOptions,
}: UpscaleLibraryModalProps) {
  const { locale } = useI18n();
  const close = locale === 'fr' ? 'Fermer' : locale === 'es' ? 'Cerrar' : 'Close';
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay-bg px-3 py-4 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.libraryTitle} tabIndex={-1} onKeyDown={onDialogKeyDown} className="relative z-10 w-full max-w-[1180px] outline-none">
      <AssetLibraryBrowser
        className="relative z-10 h-[88svh] max-w-[1180px]"
        title={copy.libraryTitle}
        countLabel={copy.libraryCount.replace('{count}', String(assets.length))}
        onClose={onClose}
        closeLabel={close}
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
            className="!min-h-11 rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
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
            className="!min-h-11 flex-1 rounded-xl border-brand px-3 text-sm sm:flex-none"
            onClick={() => onSelectAsset(asset)}
          >
            {copy.libraryUse}
          </Button>
        )}
      />
      </div>
    </div>
  );
}
