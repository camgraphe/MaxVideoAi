import type { AspectRatio, Resolution } from '@/types/engines';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  workspaceProjectDimensions,
} from './workspace-project-settings';
import type {
  WorkspaceGraphNode,
  WorkspaceOutputMetadata,
  WorkspaceProjectSettings,
  WorkspaceTimelineClipTransform,
  WorkspaceTimelineItem,
} from './workspace-types';

const DEFAULT_CLIP_TRANSFORM: WorkspaceTimelineClipTransform = {
  scale: 1,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  opacity: 1,
};

const RESOLUTION_BASE_PIXELS: Partial<Record<Resolution, number>> = {
  '480p': 480,
  '540p': 540,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2k': 1080,
  '2K': 1080,
  '4k': 2160,
  '4K': 2160,
};

export type WorkspaceMediaDimensions = {
  width: number;
  height: number;
};

export type WorkspaceTimelineClipComposition = {
  sequenceWidth: number;
  sequenceHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  left: number;
  top: number;
  scale: number;
  rotation: number;
  opacity: number;
};

function positivePixel(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function dimensionsFromPixels(width: unknown, height: unknown): WorkspaceMediaDimensions | null {
  const safeWidth = positivePixel(width);
  const safeHeight = positivePixel(height);
  if (!safeWidth || !safeHeight) return null;
  return { width: safeWidth, height: safeHeight };
}

function evenPixel(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function roundCompositionPixel(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function aspectParts(value?: AspectRatio | null): [number, number] | null {
  if (!value || value === 'custom' || value === 'source' || value === 'auto') return null;
  const [width, height] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return [width, height];
}

export function parseWorkspaceMediaDimensions(value?: string | null): WorkspaceMediaDimensions | null {
  if (!value) return null;
  const match = value.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  if (!match) return null;
  return dimensionsFromPixels(Number(match[1]), Number(match[2]));
}

export function deriveWorkspaceMediaDimensions(params: {
  aspectRatio?: AspectRatio | null;
  resolution?: Resolution | null;
}): WorkspaceMediaDimensions | null {
  const explicitDimensions = parseWorkspaceMediaDimensions(params.resolution);
  if (explicitDimensions) return explicitDimensions;

  const basePixels = params.resolution ? RESOLUTION_BASE_PIXELS[params.resolution] : undefined;
  const aspect = aspectParts(params.aspectRatio);
  if (!basePixels || !aspect) return null;

  const [aspectWidth, aspectHeight] = aspect;
  if (aspectWidth >= aspectHeight) {
    return {
      width: evenPixel(basePixels * (aspectWidth / aspectHeight)),
      height: basePixels,
    };
  }
  return {
    width: basePixels,
    height: evenPixel(basePixels * (aspectHeight / aspectWidth)),
  };
}

function dimensionsFromOutput(output?: WorkspaceOutputMetadata | null): WorkspaceMediaDimensions | null {
  if (!output || output.kind === 'audio') return null;
  return deriveWorkspaceMediaDimensions({
    aspectRatio: output.aspectRatio,
    resolution: output.resolution,
  });
}

export function workspaceMediaDimensionsForTimelineSource(
  item: WorkspaceTimelineItem,
  sourceNode?: WorkspaceGraphNode | null
): WorkspaceMediaDimensions | null {
  const itemDimensions = dimensionsFromPixels(item.sourceWidth, item.sourceHeight);
  if (itemDimensions) return itemDimensions;

  const assetDimensions = parseWorkspaceMediaDimensions(sourceNode?.data.asset?.dimensions);
  if (assetDimensions) return assetDimensions;

  return dimensionsFromOutput(sourceNode?.data.output);
}

export function resolveWorkspaceClipComposition(params: {
  item: WorkspaceTimelineItem;
  projectSettings?: WorkspaceProjectSettings;
  sourceDimensions?: WorkspaceMediaDimensions | null;
  sourceNode?: WorkspaceGraphNode | null;
}): WorkspaceTimelineClipComposition | null {
  const sourceDimensions = params.sourceDimensions ?? workspaceMediaDimensionsForTimelineSource(params.item, params.sourceNode);
  if (!sourceDimensions) return null;

  const sequenceDimensions = workspaceProjectDimensions(params.projectSettings ?? DEFAULT_WORKSPACE_PROJECT_SETTINGS);
  const transform = params.item.transform ?? DEFAULT_CLIP_TRANSFORM;
  const left = sequenceDimensions.width / 2 + (transform.positionX / 100) * sequenceDimensions.width;
  const top = sequenceDimensions.height / 2 + (transform.positionY / 100) * sequenceDimensions.height;

  return {
    sequenceWidth: sequenceDimensions.width,
    sequenceHeight: sequenceDimensions.height,
    sourceWidth: sourceDimensions.width,
    sourceHeight: sourceDimensions.height,
    width: sourceDimensions.width,
    height: sourceDimensions.height,
    left: roundCompositionPixel(left),
    top: roundCompositionPixel(top),
    scale: transform.scale,
    rotation: transform.rotation,
    opacity: transform.opacity,
  };
}

export function resolveWorkspaceClipFitHeightScale(params: {
  item: WorkspaceTimelineItem;
  projectSettings?: WorkspaceProjectSettings;
  sourceDimensions?: WorkspaceMediaDimensions | null;
  sourceNode?: WorkspaceGraphNode | null;
}): number | null {
  const sourceDimensions = params.sourceDimensions ?? workspaceMediaDimensionsForTimelineSource(params.item, params.sourceNode);
  if (!sourceDimensions) return null;

  const sequenceDimensions = workspaceProjectDimensions(params.projectSettings ?? DEFAULT_WORKSPACE_PROJECT_SETTINGS);
  return roundScale(sequenceDimensions.height / sourceDimensions.height);
}
