'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { WorkspaceProjectSettings, WorkspaceTimelineItem } from '../../_lib/workspace-types';
import { resolveProgramSnapshotFallbackSourceUrl } from '../../_lib/workspace-program-snapshot';
import { workspaceProjectDimensions } from '../../_lib/workspace-project-settings';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineVideoTrackIndex,
} from '../../_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from '../../_lib/workspace-timecode';

const PLAYBACK_SEEK_TOLERANCE_SEC = 0.22;
const PRELOAD_NEXT_CLIP_WINDOW_SEC = 1.5;
const PROGRAM_SNAPSHOT_PREVIEW_MAX_WIDTH = 960;
const DEFAULT_CLIP_TRANSFORM = {
  scale: 1,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  opacity: 1,
};

export type PlaybackLayer = {
  item: WorkspaceTimelineItem;
  url: string;
  mediaKind: 'video' | 'image';
  sourceTimeSec: number;
  opacity: number;
  isPreparing: boolean;
  isVisible: boolean;
  zIndex: number;
};

export type AudioPlaybackLayer = {
  item: WorkspaceTimelineItem;
  url: string;
  sourceTimeSec: number;
  isAudible: boolean;
};

export type WorkspaceProgramSnapshotPayload = {
  dataUrl?: string;
  filename: string;
  height: number;
  playheadSec: number;
  sourceUrl?: string;
  timecode: string;
  title: string;
  width: number;
};

type UseProgramPlaybackSyncParams = {
  isPlaying: boolean;
  items: WorkspaceTimelineItem[];
  playheadSec: number;
  projectSettings: WorkspaceProjectSettings;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onSendSnapshotToCanvas: (snapshot: WorkspaceProgramSnapshotPayload) => void;
};

function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function isPlayableAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function isPlayableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(url);
}

function playableVideoUrlForItem(item: WorkspaceTimelineItem | null): string | null {
  if (!item || !isPlayableVideoUrl(item.mediaUrl)) return null;
  return item.mediaUrl ?? null;
}

function playableImageUrlForItem(item: WorkspaceTimelineItem | null): string | null {
  if (!item || item.mediaKind !== 'image') return null;
  const imageUrl = isPlayableImageUrl(item.mediaUrl) ? item.mediaUrl : isPlayableImageUrl(item.thumbnailUrl) ? item.thumbnailUrl : null;
  return imageUrl ?? null;
}

function playableAudioUrlForItem(item: WorkspaceTimelineItem | null): string | null {
  if (!item || !isPlayableAudioUrl(item.mediaUrl)) return null;
  return item.mediaUrl ?? null;
}

function clampSeconds(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function frameStepSeconds(fps: number): number {
  return 1 / Math.max(1, fps || 24);
}

function itemEndSec(item: WorkspaceTimelineItem): number {
  return item.startSec + item.durationSec;
}

function timelineVideoSort(left: WorkspaceTimelineItem, right: WorkspaceTimelineItem): number {
  return left.startSec - right.startSec || workspaceTimelineVideoTrackIndex(left.track) - workspaceTimelineVideoTrackIndex(right.track);
}

function timelineLayerSort(left: WorkspaceTimelineItem, right: WorkspaceTimelineItem): number {
  return workspaceTimelineVideoTrackIndex(left.track) - workspaceTimelineVideoTrackIndex(right.track) || left.startSec - right.startSec;
}

function sourceTimeForItem(item: WorkspaceTimelineItem, timelineSec: number): number {
  return (item.sourceStartSec ?? 0) + clampSeconds(timelineSec - item.startSec, 0, item.durationSec);
}

function isAdjacentTimelineCut(left: WorkspaceTimelineItem, right: WorkspaceTimelineItem): boolean {
  return Math.abs(itemEndSec(left) - right.startSec) <= 0.25;
}

function crossfadeDurationFor(left: WorkspaceTimelineItem, right: WorkspaceTimelineItem): number {
  if (left.transitionOut?.type !== 'crossfade' || !isAdjacentTimelineCut(left, right)) return 0;
  return Math.max(0, Math.min(left.transitionOut.durationSec, left.durationSec / 2, right.durationSec / 2));
}

export function clipVisualStyleFor(layer: PlaybackLayer): CSSProperties {
  const transform = layer.item.transform ?? DEFAULT_CLIP_TRANSFORM;
  const opacity = clampSeconds(layer.opacity * transform.opacity, 0, 1);
  return {
    opacity,
    zIndex: layer.zIndex,
    transform: `translate(${transform.positionX}%, ${transform.positionY}%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
  };
}

function snapshotFilenameForTimecode(timecode: string): string {
  return `program-snapshot-${timecode.replace(/[^0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame'}.png`;
}

function snapshotPreviewDimensions(width: number, height: number): { height: number; width: number } {
  if (width <= PROGRAM_SNAPSHOT_PREVIEW_MAX_WIDTH) return { height, width };
  const scale = PROGRAM_SNAPSHOT_PREVIEW_MAX_WIDTH / width;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: PROGRAM_SNAPSHOT_PREVIEW_MAX_WIDTH,
  };
}

export function useProgramPlaybackSync({
  isPlaying,
  items,
  playheadSec,
  projectSettings,
  selectedItemId,
  onSelectItem,
  onSendSnapshotToCanvas,
}: UseProgramPlaybackSyncParams) {
  const playbackVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const playbackAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const playbackLayersRef = useRef<PlaybackLayer[]>([]);
  const audioPlaybackLayersRef = useRef<AudioPlaybackLayer[]>([]);
  const videoItems = useMemo(
    () => items.filter((item) => isWorkspaceTimelineVideoTrack(item.track)).sort(timelineVideoSort),
    [items]
  );
  const audioItems = useMemo(
    () => items
      .filter((item) => item.mediaKind === 'audio' || !isWorkspaceTimelineVideoTrack(item.track))
      .sort((left, right) => left.startSec - right.startSec),
    [items]
  );
  const linkedAudioGroupIds = useMemo(
    () => new Set(
      audioItems
        .filter((item) => isWorkspaceTimelineAudioTrack(item.track) && item.linkedGroupId && playableAudioUrlForItem(item))
        .map((item) => item.linkedGroupId as string)
    ),
    [audioItems]
  );
  const itemsAtPlayhead = videoItems
    .filter((item) => playheadSec >= item.startSec && playheadSec < itemEndSec(item))
    .sort(timelineLayerSort);
  const audioItemsAtPlayhead = audioItems.filter((item) => playheadSec >= item.startSec && playheadSec < itemEndSec(item));
  const itemAtPlayhead = itemsAtPlayhead.at(-1) ?? null;
  const activePlaybackItem = itemAtPlayhead;
  const nextVideoItem = activePlaybackItem
    ? videoItems.find((item) => item.startSec >= itemEndSec(activePlaybackItem) - 0.25 && item.id !== activePlaybackItem.id) ?? null
    : null;
  const playbackLayers = useMemo(() => {
    const layerByItemId = new Map<string, PlaybackLayer>();

    videoItems.forEach((item) => {
      const videoUrl = playableVideoUrlForItem(item);
      const imageUrl = playableImageUrlForItem(item);
      const url = videoUrl ?? imageUrl;
      if (!url) return;
      layerByItemId.set(item.id, {
        item,
        url,
        mediaKind: imageUrl ? 'image' : 'video',
        sourceTimeSec: item.sourceStartSec ?? 0,
        opacity: 0,
        isPreparing: false,
        isVisible: false,
        zIndex: 1,
      });
    });

    itemsAtPlayhead.forEach((visibleItem) => {
      const activeLayer = layerByItemId.get(visibleItem.id);
      if (activeLayer) {
        activeLayer.sourceTimeSec = sourceTimeForItem(visibleItem, playheadSec);
        activeLayer.opacity = 1;
        activeLayer.isPreparing = true;
        activeLayer.isVisible = true;
        activeLayer.zIndex = 2 + workspaceTimelineVideoTrackIndex(visibleItem.track);
      }
    });

    if (activePlaybackItem && nextVideoItem && itemEndSec(activePlaybackItem) - playheadSec <= PRELOAD_NEXT_CLIP_WINDOW_SEC) {
      const nextLayer = layerByItemId.get(nextVideoItem.id);
      if (nextLayer && nextLayer.opacity === 0) {
        nextLayer.sourceTimeSec = nextVideoItem.sourceStartSec ?? 0;
        nextLayer.isPreparing = true;
      }
    }

    videoItems.forEach((incomingItem) => {
      const sameTrackItems = videoItems
        .filter((candidate) => candidate.track === incomingItem.track)
        .sort((left, right) => left.startSec - right.startSec);
      const incomingIndex = sameTrackItems.findIndex((candidate) => candidate.id === incomingItem.id);
      const outgoingItem = incomingIndex > 0 ? sameTrackItems[incomingIndex - 1] : null;
      if (!outgoingItem) return;
      const transitionDurationSec = crossfadeDurationFor(outgoingItem, incomingItem);
      if (transitionDurationSec <= 0) return;
      const elapsedTransitionSec = playheadSec - incomingItem.startSec;
      if (elapsedTransitionSec < 0 || elapsedTransitionSec > transitionDurationSec) return;

      const progress = clampSeconds(elapsedTransitionSec / transitionDurationSec, 0, 1);
      const outgoingLayer = layerByItemId.get(outgoingItem.id);
      const incomingLayer = layerByItemId.get(incomingItem.id);
      if (outgoingLayer) {
        outgoingLayer.sourceTimeSec = (outgoingItem.sourceStartSec ?? 0) + clampSeconds(
          outgoingItem.durationSec - transitionDurationSec + elapsedTransitionSec,
          0,
          outgoingItem.durationSec
        );
        outgoingLayer.opacity = 1 - progress;
        outgoingLayer.isPreparing = true;
        outgoingLayer.isVisible = outgoingLayer.opacity > 0.001;
        outgoingLayer.zIndex = 3 + workspaceTimelineVideoTrackIndex(outgoingItem.track);
      }
      if (incomingLayer) {
        incomingLayer.sourceTimeSec = (incomingItem.sourceStartSec ?? 0) + clampSeconds(elapsedTransitionSec, 0, incomingItem.durationSec);
        incomingLayer.opacity = progress;
        incomingLayer.isPreparing = true;
        incomingLayer.isVisible = incomingLayer.opacity > 0.001;
        incomingLayer.zIndex = 4 + workspaceTimelineVideoTrackIndex(incomingItem.track);
      }
    });

    return Array.from(layerByItemId.values());
  }, [activePlaybackItem, itemsAtPlayhead, nextVideoItem, playheadSec, videoItems]);
  const audioPlaybackLayers = useMemo(() => {
    return audioItems.flatMap((item): AudioPlaybackLayer[] => {
      const url = playableAudioUrlForItem(item);
      if (!url) return [];
      return [{
        item,
        url,
        sourceTimeSec: sourceTimeForItem(item, playheadSec),
        isAudible: audioItemsAtPlayhead.some((activeItem) => activeItem.id === item.id),
      }];
    });
  }, [audioItems, audioItemsAtPlayhead, playheadSec]);
  const hasVisiblePlayableLayer = playbackLayers.some((layer) => layer.isVisible);
  const shouldShowEmptyState = items.length === 0 && !hasVisiblePlayableLayer;
  const timelineDurationSec = Math.max(0, ...items.map((item) => item.startSec + item.durationSec));

  useEffect(() => {
    if (selectedItemId || !itemAtPlayhead) return;
    onSelectItem(itemAtPlayhead.id);
  }, [itemAtPlayhead, onSelectItem, selectedItemId]);

  const seekToleranceSec = isPlaying
    ? PLAYBACK_SEEK_TOLERANCE_SEC
    : Math.max(0.001, frameStepSeconds(projectSettings.fps) / 4);

  const registerPlaybackVideo = useCallback((video: HTMLVideoElement | null) => {
    const itemId = video?.dataset.playbackItemId;
    if (video && itemId) {
      playbackVideoRefs.current.set(itemId, video);
    }
  }, []);

  const registerPlaybackAudio = useCallback((audio: HTMLAudioElement | null) => {
    const itemId = audio?.dataset.playbackAudioItemId;
    if (audio && itemId) {
      playbackAudioRefs.current.set(itemId, audio);
    }
  }, []);

  const syncPlaybackVideos = useCallback(() => {
    const layerById = new Map(playbackLayersRef.current.filter((layer) => layer.mediaKind === 'video').map((layer) => [layer.item.id, layer]));
    playbackVideoRefs.current.forEach((video, itemId) => {
      const layer = layerById.get(itemId);
      if (!layer) {
        video.pause();
        return;
      }

      if (video.readyState >= 1 && Math.abs(video.currentTime - layer.sourceTimeSec) > seekToleranceSec) {
        video.currentTime = layer.sourceTimeSec;
      }
      const usesLinkedAudioTrack = Boolean(layer.item.linkedGroupId && linkedAudioGroupIds.has(layer.item.linkedGroupId));
      video.volume = layer.item.audioMix?.muted || usesLinkedAudioTrack
        ? 0
        : clampSeconds((layer.item.audioMix?.volume ?? 100) / 100, 0, 1);

      if (isPlaying && layer.isVisible) {
        void video.play().catch(() => {
          // The timeline clock stays authoritative even if a browser delays media playback.
        });
        return;
      }

      video.pause();
    });
  }, [isPlaying, linkedAudioGroupIds, seekToleranceSec]);

  const syncPlaybackAudios = useCallback(() => {
    const layerById = new Map(audioPlaybackLayersRef.current.map((layer) => [layer.item.id, layer]));
    playbackAudioRefs.current.forEach((audio, itemId) => {
      const layer = layerById.get(itemId);
      if (!layer) {
        audio.pause();
        return;
      }

      if (audio.readyState >= 1 && Math.abs(audio.currentTime - layer.sourceTimeSec) > seekToleranceSec) {
        audio.currentTime = layer.sourceTimeSec;
      }
      audio.volume = layer.item.audioMix?.muted ? 0 : clampSeconds((layer.item.audioMix?.volume ?? 100) / 100, 0, 1);

      if (isPlaying && layer.isAudible) {
        void audio.play().catch(() => {
          // The sequence clock stays authoritative even if the browser delays audio playback.
        });
        return;
      }

      audio.pause();
    });
  }, [isPlaying, seekToleranceSec]);

  const handleSendSnapshotToCanvas = useCallback(() => {
    const visibleLayer = [...playbackLayersRef.current]
      .filter((layer) => layer.isVisible && layer.opacity > 0.001)
      .sort((left, right) => right.zIndex - left.zIndex)[0] ?? null;
    if (!visibleLayer) return;

    const dimensions = workspaceProjectDimensions(projectSettings);
    const timecode = formatWorkspaceTimecode(playheadSec, projectSettings.fps);
    const basePayload: WorkspaceProgramSnapshotPayload = {
      filename: snapshotFilenameForTimecode(timecode),
      height: dimensions.height,
      playheadSec,
      sourceUrl: resolveProgramSnapshotFallbackSourceUrl({
        mediaKind: visibleLayer.mediaKind,
        sourceUrl: visibleLayer.url,
        thumbnailUrl: visibleLayer.item.thumbnailUrl,
      }),
      timecode,
      title: `${visibleLayer.item.title} snapshot`,
      width: dimensions.width,
    };

    try {
      const previewDimensions = snapshotPreviewDimensions(dimensions.width, dimensions.height);
      const canvas = document.createElement('canvas');
      canvas.width = previewDimensions.width;
      canvas.height = previewDimensions.height;
      const context = canvas.getContext('2d');
      if (!context) {
        onSendSnapshotToCanvas(basePayload);
        return;
      }

      if (visibleLayer.mediaKind === 'video') {
        const video = playbackVideoRefs.current.get(visibleLayer.item.id);
        if (!video || video.readyState < 2) {
          onSendSnapshotToCanvas(basePayload);
          return;
        }
        context.drawImage(video, 0, 0, previewDimensions.width, previewDimensions.height);
        onSendSnapshotToCanvas({ ...basePayload, dataUrl: canvas.toDataURL('image/jpeg', 0.82) });
        return;
      }

      const image = Array.from(document.querySelectorAll<HTMLImageElement>('[data-playback-image-item-id]'))
        .find((element) => element.dataset.playbackImageItemId === visibleLayer.item.id);
      if (!image?.complete) {
        onSendSnapshotToCanvas(basePayload);
        return;
      }
      context.drawImage(image, 0, 0, previewDimensions.width, previewDimensions.height);
      onSendSnapshotToCanvas({ ...basePayload, dataUrl: canvas.toDataURL('image/jpeg', 0.82) });
    } catch {
      onSendSnapshotToCanvas(basePayload);
    }
  }, [onSendSnapshotToCanvas, playheadSec, projectSettings]);

  useEffect(() => {
    playbackLayersRef.current = playbackLayers;
    const currentLayerIds = new Set(playbackLayers.filter((layer) => layer.mediaKind === 'video').map((layer) => layer.item.id));
    playbackVideoRefs.current.forEach((_, itemId) => {
      if (!currentLayerIds.has(itemId)) playbackVideoRefs.current.delete(itemId);
    });
    syncPlaybackVideos();
  }, [playbackLayers, syncPlaybackVideos]);

  useEffect(() => {
    audioPlaybackLayersRef.current = audioPlaybackLayers;
    const currentLayerIds = new Set(audioPlaybackLayers.map((layer) => layer.item.id));
    playbackAudioRefs.current.forEach((_, itemId) => {
      if (!currentLayerIds.has(itemId)) playbackAudioRefs.current.delete(itemId);
    });
    syncPlaybackAudios();
  }, [audioPlaybackLayers, syncPlaybackAudios]);

  return {
    activePlaybackItem,
    audioPlaybackLayers,
    handleSendSnapshotToCanvas,
    hasVisiblePlayableLayer,
    linkedAudioGroupIds,
    playbackLayers,
    registerPlaybackAudio,
    registerPlaybackVideo,
    shouldShowEmptyState,
    syncPlaybackAudios,
    syncPlaybackVideos,
    timelineDurationSec,
  };
}
