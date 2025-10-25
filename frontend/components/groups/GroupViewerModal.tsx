'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import type { VideoGroup, VideoItem } from '@/types/video-groups';

interface GroupViewerModalProps {
  group: VideoGroup | null;
  onClose: () => void;
  onRefreshJob?: (jobId: string) => Promise<void> | void;
  defaultAllowIndex?: boolean;
}

function isVideo(item: VideoItem): boolean {
  const mediaType = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function GroupViewerModal({ group, onClose, onRefreshJob, defaultAllowIndex }: GroupViewerModalProps) {
  const [indexingOverrides, setIndexingOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIndexingOverrides({});
  }, [group?.id]);

  const entries: MediaLightboxEntry[] = useMemo(() => {
    if (!group) return [];
    return group.items.map((item, index) => {
      const label = `Variant ${index + 1}`;
      const video = isVideo(item) ? item.url : undefined;
      const thumb = item.thumb ?? (video ? undefined : item.url);
      const rawStatus = typeof item.meta?.status === 'string' ? String(item.meta.status) : undefined;
      const jobIdMeta = typeof item.meta?.jobId === 'string' ? String(item.meta.jobId) : null;
      const jobId = item.jobId ?? jobIdMeta ?? item.id;
      const overrideIndex = jobId ? indexingOverrides[jobId] : undefined;
      const baseIndexable =
        typeof item.indexable === 'boolean'
          ? item.indexable
          : typeof item.meta?.indexable === 'boolean'
            ? (item.meta.indexable as boolean)
            : undefined;
      const indexable = typeof overrideIndex === 'boolean' ? overrideIndex : baseIndexable;
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
        jobId,
        videoUrl: video,
        thumbUrl: thumb,
        aspectRatio: item.aspect,
        status,
        progress,
        message,
        engineLabel,
        durationSec: item.durationSec,
        createdAt: group.createdAt,
        indexable,
        visibility: item.visibility ?? (typeof item.meta?.visibility === 'string' ? (item.meta.visibility as 'public' | 'private') : undefined),
        hasAudio:
          typeof item.hasAudio === 'boolean'
            ? item.hasAudio
            : item.meta && typeof item.meta === 'object' && 'hasAudio' in item.meta
              ? Boolean((item.meta as Record<string, unknown>).hasAudio)
              : false,
      };
    });
  }, [group, indexingOverrides]);

  const handleToggleIndexable = useCallback(
    async (entry: MediaLightboxEntry, nextIndexable: boolean) => {
      const jobId = entry.jobId ?? entry.id;
      if (!jobId) {
        throw new Error('Missing video identifier');
      }
      const res = await fetch(`/api/videos/${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ indexable: nextIndexable }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error((json && typeof json.error === 'string' && json.error) || 'Failed to update indexing');
      }
      setIndexingOverrides((current) => ({
        ...current,
        [jobId]: nextIndexable,
      }));
      if (onRefreshJob) {
        try {
          await onRefreshJob(jobId);
        } catch (error) {
          console.warn('[GroupViewerModal] refresh after indexing toggle failed', error);
        }
      }
    },
    [onRefreshJob]
  );

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
      onRefreshEntry={
        onRefreshJob
          ? (entry) => {
              const jobId = entry.jobId ?? entry.id;
              if (!jobId) return;
              return onRefreshJob(jobId);
            }
          : undefined
      }
      allowIndexingControls={Boolean(defaultAllowIndex)}
      onToggleIndexable={defaultAllowIndex ? handleToggleIndexable : undefined}
    />
  );
}
