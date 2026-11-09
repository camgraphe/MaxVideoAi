'use client';

import { LibraryPickerDialog } from '@/components/library/LibraryPickerDialog.client';
import type { GeneratedSourceVideo } from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

type PickerProps = {
  open: boolean;
  userId?: string | null;
  videos: GeneratedSourceVideo[];
  isLoading: boolean;
  error: string | null;
  locale: string;
  copy: AudioWorkspaceCopy;
  onClose: () => void;
  onSelect: (video: GeneratedSourceVideo) => void | Promise<void>;
};

export function AudioGeneratedVideoPickerModal({
  open,
  userId,
  videos,
  isLoading,
  error,
  locale,
  copy,
  onClose,
  onSelect,
}: PickerProps) {
  const assets = videos.map((video) => ({
    ...video,
    id: video.sourceOutputId ? `output:${video.sourceOutputId}` : video.jobId,
    kind: 'video' as const,
    name: video.label,
    sourceVideo: video,
  }));
  return (
    <LibraryPickerDialog
      open={open}
      userId={userId}
      intent="audio:source-video"
      allowImport={false}
      locale={locale}
      title={copy.picker.title}
      subtitle={copy.picker.description}
      assetType="video"
      assets={assets}
      isLoading={isLoading}
      error={error}
      source="recent"
      availableSources={['recent']}
      sourceLabels={{ recent: copy.picker.title }}
      onSourceChange={() => {}}
      searchPlaceholder={copy.picker.title}
      sourcesTitle={copy.picker.title}
      emptyLabel={copy.picker.empty}
      emptySearchLabel={copy.picker.empty}
      onClose={onClose}
      closeLabel={copy.picker.close}
      renderAssetActions={() => null}
      selection={{
        allowOrganizationBrowse: false,
        sourceProof: 'audio-generated-video',
        onConfirm: (asset) => onSelect((asset as (typeof assets)[number]).sourceVideo),
      }}
    />
  );
}
