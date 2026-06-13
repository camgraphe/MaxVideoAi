import {
  rememberTimelineNodeDragPayload,
  TIMELINE_NODE_DRAG_TYPE,
  type TimelineNodeDragPayload,
} from './timeline/timeline-external-drop';
import {
  workspaceAssetHasTimelineAudio,
  workspaceAssetTimelineDuration,
  workspaceOutputHasTimelineAudio,
  workspaceOutputTimelineDuration,
} from './workspace-timeline-editing';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
} from './workspace-types';
import { DEFAULT_STUDIO_COPY, type StudioCopy } from '../../_lib/studio-copy';

export type ProjectMediaTimelineDragPayload = TimelineNodeDragPayload & {
  durationSec: number;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  title: string;
};

export const PROJECT_MEDIA_ITEM_DRAG_TYPE = 'application/x-maxvideoai-project-media-item';

export type ProjectMediaItemDragPayload = {
  itemId: string;
  itemType: 'asset' | 'generated';
  sourceFolderId?: string | null;
  title: string;
};

type ProjectMediaTimelineDragDataTransfer = Pick<DataTransfer, 'setData'> & {
  effectAllowed?: DataTransfer['effectAllowed'];
  setDragImage?: DataTransfer['setDragImage'];
};

type ProjectMediaItemDataTransfer = Pick<DataTransfer, 'getData' | 'setData'> & {
  types: ArrayLike<string> | Iterable<string>;
};

let activeProjectMediaItemDragPayload: ProjectMediaItemDragPayload | null = null;

export function projectMediaTimelineKindForAsset(asset: WorkspaceAssetRecord): ProjectMediaTimelineDragPayload['mediaKind'] | null {
  if (asset.kind === 'audio') return 'audio';
  if (asset.kind === 'video') return 'video';
  if (asset.kind === 'image' || asset.kind === 'logo') return 'image';
  return null;
}

export function projectMediaTimelineKindForGeneratedNode(node: WorkspaceGraphNode): ProjectMediaTimelineDragPayload['mediaKind'] | null {
  const output = node.data.output;
  if (!output || output.status === 'placeholder' || output.status === 'processing' || output.status === 'failed') return null;
  if (output.kind === 'audio') return output.url ? 'audio' : null;
  if (output.kind === 'image') return output.url || output.thumbUrl ? 'image' : null;
  return output.url ? 'video' : null;
}

export function projectMediaAssetThumbnailUrl(asset: WorkspaceAssetRecord): string | null {
  if (asset.kind === 'audio') return null;
  if (asset.kind === 'video') return asset.thumbUrl ?? null;
  return asset.thumbUrl ?? asset.url ?? null;
}

export function projectMediaGeneratedThumbnailUrl(node: WorkspaceGraphNode): string | null {
  const output = node.data.output;
  return output?.thumbUrl ?? output?.url ?? null;
}

export function projectMediaTimelineDragPayloadForAsset(asset: WorkspaceAssetRecord): ProjectMediaTimelineDragPayload | null {
  const mediaKind = projectMediaTimelineKindForAsset(asset);
  if (!mediaKind) return null;
  return {
    assetId: asset.id,
    durationSec: workspaceAssetTimelineDuration(asset),
    hasTimelineAudio: workspaceAssetHasTimelineAudio(asset),
    mediaKind,
    previewUrl: projectMediaAssetThumbnailUrl(asset),
    title: asset.filename,
  };
}

export function projectMediaTimelineDragPayloadForGeneratedNode(node: WorkspaceGraphNode): ProjectMediaTimelineDragPayload | null {
  const mediaKind = projectMediaTimelineKindForGeneratedNode(node);
  const output = node.data.output;
  if (!mediaKind || !output) return null;
  return {
    durationSec: workspaceOutputTimelineDuration(output),
    hasTimelineAudio: workspaceOutputHasTimelineAudio(output),
    mediaKind,
    nodeId: node.id,
    previewUrl: projectMediaGeneratedThumbnailUrl(node),
    title: node.data.title,
  };
}

export function projectMediaItemDragPayloadForAsset(asset: WorkspaceAssetRecord): ProjectMediaItemDragPayload {
  return {
    itemId: asset.id,
    itemType: 'asset',
    sourceFolderId: asset.folderId ?? null,
    title: asset.filename,
  };
}

export function projectMediaItemDragPayloadForGeneratedNode(node: WorkspaceGraphNode): ProjectMediaItemDragPayload | null {
  if (!node.data.output) return null;
  return {
    itemId: node.id,
    itemType: 'generated',
    sourceFolderId: node.data.output.projectMediaFolderId ?? null,
    title: node.data.title,
  };
}

function isValidProjectMediaItemDragPayload(payload: ProjectMediaItemDragPayload | null | undefined): payload is ProjectMediaItemDragPayload {
  return Boolean(
    payload?.itemId &&
    payload.title &&
    (payload.itemType === 'asset' || payload.itemType === 'generated')
  );
}

export function applyProjectMediaItemDragPayload(
  dataTransfer: Pick<DataTransfer, 'setData'>,
  payload: ProjectMediaItemDragPayload
): void {
  activeProjectMediaItemDragPayload = isValidProjectMediaItemDragPayload(payload) ? payload : null;
  dataTransfer.setData(PROJECT_MEDIA_ITEM_DRAG_TYPE, JSON.stringify(payload));
}

export function clearProjectMediaItemDragPayload(): void {
  activeProjectMediaItemDragPayload = null;
}

export function parseProjectMediaItemDragPayload(dataTransfer: Pick<ProjectMediaItemDataTransfer, 'getData' | 'types'>): ProjectMediaItemDragPayload | null {
  const types = Array.from(dataTransfer.types);
  const fallbackPayload = activeProjectMediaItemDragPayload;
  if (!types.includes(PROJECT_MEDIA_ITEM_DRAG_TYPE)) return fallbackPayload;
  try {
    const payload = JSON.parse(dataTransfer.getData(PROJECT_MEDIA_ITEM_DRAG_TYPE)) as ProjectMediaItemDragPayload;
    return isValidProjectMediaItemDragPayload(payload) ? payload : fallbackPayload;
  } catch {
    return fallbackPayload;
  }
}

function formatProjectMediaDragDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.ceil(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function projectMediaDragKindLabel(
  kind: ProjectMediaTimelineDragPayload['mediaKind'],
  copy: StudioCopy['canvas']['nodes'] = DEFAULT_STUDIO_COPY.canvas.nodes
): string {
  if (kind === 'audio') return copy.audio ?? 'Audio';
  if (kind === 'image') return copy.image ?? 'Image';
  return copy.video ?? 'Video';
}

function projectMediaDragPosterBackground(payload: ProjectMediaTimelineDragPayload): string {
  if (payload.previewUrl && payload.mediaKind !== 'audio') {
    return `center / cover no-repeat url("${payload.previewUrl}")`;
  }
  if (payload.mediaKind === 'audio') {
    return 'linear-gradient(135deg, rgba(16, 185, 129, 0.76), rgba(5, 46, 22, 0.94))';
  }
  return 'linear-gradient(135deg, rgba(37, 99, 235, 0.72), rgba(124, 58, 237, 0.78))';
}

function createProjectMediaDragImage(
  payload: ProjectMediaTimelineDragPayload,
  canvasNodeCopy: StudioCopy['canvas']['nodes']
): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;

  const dragImage = document.createElement('div');
  dragImage.setAttribute('data-project-media-drag-preview', 'true');
  dragImage.style.position = 'fixed';
  dragImage.style.top = '-1000px';
  dragImage.style.left = '-1000px';
  dragImage.style.display = 'grid';
  dragImage.style.width = '210px';
  dragImage.style.gridTemplateColumns = '54px minmax(0, 1fr)';
  dragImage.style.gap = '10px';
  dragImage.style.alignItems = 'center';
  dragImage.style.padding = '9px';
  dragImage.style.border = '1px solid rgba(129, 140, 248, 0.62)';
  dragImage.style.borderRadius = '10px';
  dragImage.style.background = 'rgba(8, 13, 24, 0.96)';
  dragImage.style.boxShadow = '0 18px 44px rgba(0, 0, 0, 0.42)';
  dragImage.style.color = '#f8fafc';
  dragImage.style.font = '12px Inter, system-ui, sans-serif';
  dragImage.style.pointerEvents = 'none';
  dragImage.style.zIndex = '2147483647';

  const poster = document.createElement('span');
  poster.style.display = 'block';
  poster.style.width = '54px';
  poster.style.aspectRatio = '16 / 9';
  poster.style.borderRadius = '7px';
  poster.style.background = projectMediaDragPosterBackground(payload);

  const copy = document.createElement('span');
  copy.style.display = 'grid';
  copy.style.minWidth = '0';
  copy.style.gap = '3px';

  const title = document.createElement('strong');
  title.textContent = payload.title;
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';
  title.style.fontSize = '12px';

  const meta = document.createElement('span');
  meta.textContent = `${projectMediaDragKindLabel(payload.mediaKind, canvasNodeCopy)} - ${formatProjectMediaDragDuration(payload.durationSec)}`;
  meta.style.color = '#a3adc2';
  meta.style.fontSize = '10px';
  meta.style.fontWeight = '700';

  copy.append(title, meta);
  dragImage.append(poster, copy);
  document.body.appendChild(dragImage);
  return dragImage;
}

export function applyProjectMediaTimelineDragPayload(
  dataTransfer: ProjectMediaTimelineDragDataTransfer,
  payload: ProjectMediaTimelineDragPayload,
  canvasNodeCopy: StudioCopy['canvas']['nodes'] = DEFAULT_STUDIO_COPY.canvas.nodes
): void {
  rememberTimelineNodeDragPayload(payload);
  dataTransfer.effectAllowed = 'copyMove';
  dataTransfer.setData(TIMELINE_NODE_DRAG_TYPE, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.title);

  if (typeof dataTransfer.setDragImage !== 'function') return;

  const dragImage = createProjectMediaDragImage(payload, canvasNodeCopy);
  if (!dragImage) return;

  dataTransfer.setDragImage(dragImage, 18, 18);
  const removeDragImage = () => dragImage.remove();
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(removeDragImage);
  } else {
    setTimeout(removeDragImage, 0);
  }
}
