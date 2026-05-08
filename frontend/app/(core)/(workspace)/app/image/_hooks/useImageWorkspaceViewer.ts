import { useCallback, useState } from 'react';

import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { saveImageToLibrary } from '@/lib/api';
import { buildVideoGroupFromImageRun } from '@/lib/image-groups';
import type { VideoGroup } from '@/types/video-groups';
import type { HistoryEntry } from '../_lib/image-workspace-types';

export function useImageWorkspaceViewer() {
  const [viewerGroup, setViewerGroup] = useState<VideoGroup | null>(null);

  const handleOpenHistoryEntry = useCallback((entry: HistoryEntry) => {
    if (!entry.images.length) return;
    const group = buildVideoGroupFromImageRun({
      id: entry.id,
      jobId: entry.jobId ?? entry.id,
      createdAt: entry.createdAt,
      prompt: entry.prompt,
      engineLabel: entry.engineLabel,
      engineId: entry.engineId,
      aspectRatio: entry.aspectRatio ?? null,
      images: entry.images.map((image) => ({
        url: image.url,
        thumbUrl: image.thumbUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
      })),
    });
    setViewerGroup(group);
  }, []);

  const closeViewer = useCallback(() => setViewerGroup(null), []);

  const handleSaveVariantToLibrary = useCallback(async (entry: MediaLightboxEntry) => {
    const mediaUrl = entry.videoUrl ?? entry.audioUrl ?? entry.imageUrl ?? entry.thumbUrl;
    if (!mediaUrl) {
      throw new Error('No image available to save');
    }
    await saveImageToLibrary({
      url: mediaUrl,
      jobId: entry.jobId ?? entry.id,
      label: entry.label ?? undefined,
    });
  }, []);

  return {
    closeViewer,
    handleOpenHistoryEntry,
    handleSaveVariantToLibrary,
    viewerGroup,
  };
}
