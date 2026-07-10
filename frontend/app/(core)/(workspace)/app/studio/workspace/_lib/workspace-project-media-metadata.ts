import {
  parseWorkspaceMediaDimensions,
  type WorkspaceMediaDimensions,
} from './workspace-clip-composition';
import { projectAssetTimelineNodeId } from './workspace-timeline-drops';
import type { WorkspaceAssetRecord, WorkspaceTimelineItem } from './workspace-types';

export type WorkspaceMeasuredMediaMetadata = Partial<WorkspaceMediaDimensions> & {
  durationSec?: number | null;
};

export type WorkspaceProjectAssetMetadataSource = {
  kind: 'image-preview' | 'video';
  url: string;
};

function positivePixel(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function positiveDuration(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1000) / 1000;
}

function measuredDimensions(metadata: WorkspaceMeasuredMediaMetadata): WorkspaceMediaDimensions | null {
  const width = positivePixel(metadata.width);
  const height = positivePixel(metadata.height);
  if (!width || !height) return null;
  return { width, height };
}

function assetKindLabel(asset: WorkspaceAssetRecord): string {
  if (asset.kind === 'video') return 'Video';
  if (asset.kind === 'audio') return 'Audio';
  return 'Image';
}

function assetHasMeasuredDuration(asset: WorkspaceAssetRecord): boolean {
  return positiveDuration(asset.durationSec) !== null;
}

function assetHasMeasuredDimensions(asset: WorkspaceAssetRecord): boolean {
  return Boolean(parseWorkspaceMediaDimensions(asset.dimensions));
}

export function workspaceAssetNeedsMetadataHydration(asset: WorkspaceAssetRecord): boolean {
  if (asset.kind === 'video') {
    return !assetHasMeasuredDimensions(asset) || !assetHasMeasuredDuration(asset);
  }
  if (asset.kind === 'image' || asset.kind === 'logo') {
    return !assetHasMeasuredDimensions(asset);
  }
  return false;
}

export function workspaceProjectMediaNeedsMetadata(asset: WorkspaceAssetRecord): boolean {
  return workspaceAssetNeedsMetadataHydration(asset);
}

export function workspaceProjectMediaResolutionLabel(asset: WorkspaceAssetRecord): string | null {
  const dimensions = parseWorkspaceMediaDimensions(asset.dimensions);
  if (dimensions) return `${dimensions.width}x${dimensions.height}`;
  return asset.dimensions?.trim() || null;
}

export function workspaceAssetNeedsMeasuredDimensions(asset: WorkspaceAssetRecord): boolean {
  return workspaceAssetNeedsMetadataHydration(asset);
}

export function workspaceProjectAssetMetadataSourceUrl(
  asset: WorkspaceAssetRecord,
  items: WorkspaceTimelineItem[]
): string | null {
  return workspaceProjectAssetMetadataSource(asset, items)?.url ?? null;
}

export function workspaceProjectAssetMetadataSource(
  asset: WorkspaceAssetRecord,
  items: WorkspaceTimelineItem[]
): WorkspaceProjectAssetMetadataSource | null {
  if (asset.kind === 'image' || asset.kind === 'logo') {
    const imageUrl = asset.url ?? asset.thumbUrl ?? null;
    return imageUrl ? { kind: 'image-preview', url: imageUrl } : null;
  }

  if (asset.kind !== 'video') return null;

  if (asset.url) return { kind: 'video', url: asset.url };

  const sourceNodeId = projectAssetTimelineNodeId(asset);
  const timelineSource = items.find(
    (item) => item.outputNodeId === sourceNodeId && item.mediaKind === 'video' && Boolean(item.mediaUrl)
  );
  if (timelineSource?.mediaUrl) return { kind: 'video', url: timelineSource.mediaUrl };

  if (asset.thumbUrl?.includes('/renders/')) return { kind: 'image-preview', url: asset.thumbUrl };
  return null;
}

export function workspaceAssetWithMeasuredMetadata(
  asset: WorkspaceAssetRecord,
  metadata: WorkspaceMeasuredMediaMetadata
): WorkspaceAssetRecord {
  const dimensions = measuredDimensions(metadata);
  const durationSec = positiveDuration(metadata.durationSec);
  const dimensionsLabel = dimensions ? `${dimensions.width}x${dimensions.height}` : asset.dimensions;
  const nextDurationSec = positiveDuration(asset.durationSec) ?? durationSec ?? undefined;
  const nextSubtitle = dimensionsLabel ? `${assetKindLabel(asset)} · ${dimensionsLabel}` : asset.subtitle;

  if (
    asset.dimensions === dimensionsLabel &&
    asset.durationSec === nextDurationSec &&
    asset.subtitle === nextSubtitle
  ) return asset;

  return {
    ...asset,
    dimensions: dimensionsLabel,
    durationSec: nextDurationSec,
    subtitle: nextSubtitle,
  };
}

export function applyWorkspaceProjectAssetMetadataToTimelineItems(
  items: WorkspaceTimelineItem[],
  asset: WorkspaceAssetRecord
): WorkspaceTimelineItem[] {
  const dimensions = parseWorkspaceMediaDimensions(asset.dimensions);
  const durationSec = positiveDuration(asset.durationSec);
  if (!dimensions && !durationSec) return items;

  const sourceNodeId = projectAssetTimelineNodeId(asset);
  let didChange = false;
  const nextItems = items.map((item) => {
    if (item.outputNodeId !== sourceNodeId) return item;
    const nextSourceWidth = item.mediaKind === 'audio' ? item.sourceWidth : dimensions?.width ?? item.sourceWidth;
    const nextSourceHeight = item.mediaKind === 'audio' ? item.sourceHeight : dimensions?.height ?? item.sourceHeight;
    const nextSourceDurationSec = durationSec ?? item.sourceDurationSec;
    if (
      item.sourceWidth === nextSourceWidth &&
      item.sourceHeight === nextSourceHeight &&
      item.sourceDurationSec === nextSourceDurationSec
    ) return item;
    didChange = true;
    return {
      ...item,
      sourceWidth: nextSourceWidth,
      sourceHeight: nextSourceHeight,
      sourceDurationSec: nextSourceDurationSec,
    };
  });

  return didChange ? nextItems : items;
}
