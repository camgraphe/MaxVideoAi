'use client';

import { useMemo } from 'react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import type { VideoGroup, VideoItem } from '@/types/video-groups';

interface GroupViewerModalProps {
  group: VideoGroup | null;
  onClose: () => void;
}

function isVideo(item: VideoItem): boolean {
  const mediaType = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function GroupViewerModal({ group, onClose }: GroupViewerModalProps) {
  const entries: MediaLightboxEntry[] = useMemo(() => {
    if (!group) return [];
    return group.items.map((item, index) => {
      const label = `Variant ${index + 1}`;
      const video = isVideo(item) ? item.url : undefined;
      const thumb = item.thumb ?? (video ? undefined : item.url);
      const rawStatus = typeof item.meta?.status === 'string' ? String(item.meta.status) : undefined;
      const status: MediaLightboxEntry['status'] = (() => {
        if (!rawStatus) return undefined;
        const normalized = rawStatus.toLowerCase();
        if (normalized === 'completed' || normalized === 'ready') return 'completed';
        if (normalized === 'failed' || normalized === 'error') return 'failed';
        if (normalized === 'pending' || normalized === 'loading') return 'pending';
        return undefined;
      })();
      const progress =
        typeof item.meta?.progress === 'number'
          ? Math.max(0, Math.min(100, Math.round(item.meta.progress as number)))
          : undefined;
      const message = typeof item.meta?.message === 'string' ? (item.meta.message as string) : undefined;
      const engineLabel = typeof group.paramsSnapshot?.engineLabel === 'string' ? String(group.paramsSnapshot.engineLabel) : undefined;

      return {
        id: item.id,
        label,
        videoUrl: video,
        thumbUrl: thumb,
        aspectRatio: item.aspect,
        status,
        progress,
        message,
        engineLabel,
        durationSec: item.durationSec,
        createdAt: group.createdAt,
      };
    });
  }, [group]);

  const metadata = useMemo(() => {
    if (!group) return [];
    const details: Array<{ label: string; value: string }> = [];
    const providerLabel = group.provider === 'fal' ? 'Live (fal)' : 'Test';
    details.push({ label: 'Provider', value: providerLabel });
    if (group.paramsSnapshot?.engineLabel) {
      details.push({ label: 'Engine', value: String(group.paramsSnapshot.engineLabel) });
    }
    if (typeof group.paramsSnapshot?.durationSec === 'number') {
      details.push({ label: 'Duration', value: `${group.paramsSnapshot.durationSec}s` });
    }
    if (group.currency && typeof group.totalCostCents === 'number') {
      const total = (group.totalCostCents / 100).toFixed(2);
      details.push({ label: 'Cost', value: `${group.currency} ${total}` });
    }
    if (group.meta?.batchId) {
      details.push({ label: 'Batch', value: String(group.meta.batchId) });
    }
    return details;
  }, [group]);

  if (!group) {
    return null;
  }

  return (
    <MediaLightbox
      title={`Group ${group.id}`}
      subtitle={new Date(group.createdAt).toLocaleString()}
      prompt={typeof group.paramsSnapshot?.prompt === 'string' ? String(group.paramsSnapshot.prompt) : undefined}
      metadata={metadata}
      entries={entries}
      onClose={onClose}
    />
  );
}
