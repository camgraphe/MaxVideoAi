'use client';
import { usePaginatedMediaLibraryAssets } from '@/hooks/usePaginatedMediaLibraryAssets';
import { LibraryPickerDialog } from '@/components/library/LibraryPickerDialog.client';
import { mediaReadAccessFields } from '@/lib/library-media-access';
import { resolveMediaSourceRef } from '@/lib/media-identity';
import type { AudioCreationDraft } from '@/lib/audio-creation';
import type { AudioCreationCopy } from '../_lib/audio-creation-copy';
export default function AudioReferenceLibrary({
  open = true,
  userId,
  intent = 'voice',
  locale = 'en',
  copy,
  onClose,
  onSelect,
}: {
  open?: boolean;
  userId: string;
  intent?: string;
  locale?: string;
  copy: AudioCreationCopy;
  onClose: () => void;
  onSelect: (reference: NonNullable<AudioCreationDraft['reference']>) => void;
}) {
  const library = usePaginatedMediaLibraryAssets({ enabled: open, userId, kind: 'audio', source: null });
  return (
    <LibraryPickerDialog
      open={open}
      userId={userId}
      intent={`audio:${intent}`}
      locale={locale}
      title={copy.library}
      subtitle={copy.referenceHint}
      assetType="audio"
      assets={library.assets
        .filter((asset) => asset.kind === 'audio')
        .map((asset) => ({ ...asset, kind: 'audio' as const }))}
      source="all"
      availableSources={['all']}
      sourceLabels={{ all: copy.library }}
      onSourceChange={() => {}}
      isLoading={library.isLoading}
      isLoadingMore={library.isLoadingMore}
      hasMore={library.hasMore}
      onLoadMore={library.loadMore}
      error={library.error ? copy.uploadError : null}
      searchPlaceholder={copy.library}
      sourcesTitle={copy.library}
      emptyLabel={copy.emptyLibrary}
      emptySearchLabel={copy.emptyLibrary}
      onClose={onClose}
      closeLabel={copy.close}
      renderAssetActions={() => null}
      selection={{
        isDisabled: (asset) =>
          !(
            /^(audio\/(mpeg|mp3|wav|x-wav|wave))$/.test(asset.mime ?? '') &&
            typeof asset.durationSec === 'number' &&
            asset.durationSec > 0 &&
            asset.durationSec <= 30 &&
            typeof asset.size === 'number' &&
            asset.size <= 10 * 1024 * 1024 &&
            resolveMediaSourceRef(asset, 'audio')
          ),
        onConfirm: (asset) => {
          const ref = resolveMediaSourceRef(asset, 'audio');
          if (!ref) return false;
          onSelect({ ...mediaReadAccessFields(asset), url: asset.url, name: asset.name ?? copy.reference, ref, mediaFacts: asset.mediaFacts });
        },
      }}
    />
  );
}
