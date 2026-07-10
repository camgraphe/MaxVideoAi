import type {
  WorkspaceAssetRecord,
  WorkspaceOutputMetadata,
  WorkspaceTimelineItem,
} from '../workspace-types';
import {
  deriveWorkspaceMediaDimensions,
  parseWorkspaceMediaDimensions,
} from '../workspace-clip-composition';
import { generatedTextReference } from '../workspace-generated-copy';
import { MIN_CLIP_DURATION_SEC } from './timeline-frames';

export function workspaceOutputHasTimelineAudio(output: WorkspaceOutputMetadata): boolean {
  return output.kind === 'video' && Boolean(output.hasAudio || output.audioUrl);
}

export function workspaceAssetTimelineDuration(asset: WorkspaceAssetRecord): number {
  const sourceDurationSec = workspaceAssetSourceDuration(asset);
  if (sourceDurationSec !== undefined) return Math.max(MIN_CLIP_DURATION_SEC, sourceDurationSec);
  if (asset.kind === 'audio') return 12;
  if (asset.kind === 'video') return 6;
  return 5;
}

function workspaceAssetSourceDuration(asset: WorkspaceAssetRecord): number | undefined {
  if (typeof asset.durationSec !== 'number' || !Number.isFinite(asset.durationSec) || asset.durationSec <= 0) {
    return undefined;
  }
  return asset.durationSec;
}

export function workspaceOutputTimelineDuration(output: WorkspaceOutputMetadata): number {
  return Math.max(MIN_CLIP_DURATION_SEC, output.durationSec ?? 5);
}

export function workspaceAssetHasTimelineAudio(asset: WorkspaceAssetRecord): boolean {
  return asset.kind === 'video' && (asset.hasAudio ?? true);
}

export function buildWorkspaceTimelineItemsForAsset(params: {
  assetNodeId: string;
  title: string;
  generatedCopy?: WorkspaceTimelineItem['generatedCopy'];
  asset: WorkspaceAssetRecord;
  startSec: number;
  idSeed?: string;
}): WorkspaceTimelineItem[] {
  if (params.asset.kind === 'text') return [];

  const idSuffix = params.idSeed ?? Date.now().toString(36);
  const baseId = `timeline-${params.assetNodeId}-${idSuffix}`;
  const durationSec = workspaceAssetTimelineDuration(params.asset);
  const sourceDurationSec = workspaceAssetSourceDuration(params.asset);
  const mediaUrl = params.asset.url ?? params.asset.thumbUrl ?? null;
  const common = {
    outputNodeId: params.assetNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    ...(sourceDurationSec !== undefined ? { sourceDurationSec } : {}),
    status: 'completed' as const,
  };

  if (params.asset.kind === 'audio') {
    return [
      {
        ...common,
        id: baseId,
        track: 'audio',
        mediaKind: 'audio',
        generatedCopy: params.generatedCopy,
        mediaUrl,
      },
    ];
  }

  const videoItem: WorkspaceTimelineItem = {
    ...common,
    id: baseId,
    track: 'video',
    linkedGroupId: workspaceAssetHasTimelineAudio(params.asset) ? baseId : null,
    linkedGroupKind: workspaceAssetHasTimelineAudio(params.asset) ? 'video-audio' : null,
    mediaKind: params.asset.kind === 'video' ? 'video' : 'image',
    hasEmbeddedAudio: workspaceAssetHasTimelineAudio(params.asset),
    generatedCopy: params.generatedCopy,
    mediaUrl,
    thumbnailUrl: params.asset.thumbUrl ?? mediaUrl,
  };
  const sourceDimensions = parseWorkspaceMediaDimensions(params.asset.dimensions);
  if (sourceDimensions) {
    videoItem.sourceWidth = sourceDimensions.width;
    videoItem.sourceHeight = sourceDimensions.height;
  }

  if (!workspaceAssetHasTimelineAudio(params.asset)) return [videoItem];

  return [
    videoItem,
    {
      ...common,
      id: `${baseId}-audio`,
      title: `${params.title} Audio`,
      generatedCopy: params.generatedCopy?.title
        ? { title: generatedTextReference(`${params.title} Audio`) }
        : undefined,
      track: 'audio',
      linkedGroupId: baseId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      mediaUrl: params.asset.audioUrl ?? mediaUrl,
      thumbnailUrl: null,
    },
  ];
}

export function buildWorkspaceTimelineItemsForOutput(params: {
  outputNodeId: string;
  title: string;
  generatedCopy?: WorkspaceTimelineItem['generatedCopy'];
  output: WorkspaceOutputMetadata;
  startSec: number;
  idSeed?: string;
}): WorkspaceTimelineItem[] {
  if (params.output.kind === 'text') return [];

  const idSuffix = params.idSeed ?? Date.now().toString(36);
  const baseId = `timeline-${params.outputNodeId}-${idSuffix}`;
  const durationSec = workspaceOutputTimelineDuration(params.output);
  const sourceDurationSec = durationSec;
  const common = {
    outputNodeId: params.outputNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    sourceDurationSec,
    modelId: params.output.modelId,
    status: 'completed' as const,
  };

  if (params.output.kind === 'audio') {
    return [
      {
        ...common,
        id: baseId,
        track: 'audio',
        mediaKind: 'audio',
        generatedCopy: params.generatedCopy,
        mediaUrl: params.output.url ?? null,
      },
    ];
  }

  const videoItem: WorkspaceTimelineItem = {
    ...common,
    id: baseId,
    track: 'video',
    linkedGroupId: workspaceOutputHasTimelineAudio(params.output) ? baseId : null,
    linkedGroupKind: workspaceOutputHasTimelineAudio(params.output) ? 'video-audio' : null,
    mediaKind: params.output.kind === 'image' ? 'image' : 'video',
    hasEmbeddedAudio: workspaceOutputHasTimelineAudio(params.output),
    generatedCopy: params.generatedCopy,
    mediaUrl: params.output.url ?? null,
    thumbnailUrl: params.output.thumbUrl ?? params.output.url ?? null,
  };
  const sourceDimensions = deriveWorkspaceMediaDimensions({
    aspectRatio: params.output.aspectRatio,
    resolution: params.output.resolution,
  });
  if (sourceDimensions) {
    videoItem.sourceWidth = sourceDimensions.width;
    videoItem.sourceHeight = sourceDimensions.height;
  }

  if (!workspaceOutputHasTimelineAudio(params.output)) return [videoItem];

  return [
    videoItem,
    {
      ...common,
      id: `${baseId}-audio`,
      title: `${params.title} Audio`,
      generatedCopy: params.generatedCopy?.title
        ? { title: generatedTextReference(`${params.title} Audio`) }
        : undefined,
      track: 'audio',
      linkedGroupId: baseId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      mediaUrl: params.output.audioUrl ?? params.output.url ?? null,
      thumbnailUrl: null,
    },
  ];
}
