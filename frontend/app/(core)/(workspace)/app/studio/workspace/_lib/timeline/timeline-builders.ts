import type {
  WorkspaceAssetRecord,
  WorkspaceOutputMetadata,
  WorkspaceTimelineItem,
} from '../workspace-types';
import { generatedTextReference } from '../workspace-generated-copy';
import { MIN_CLIP_DURATION_SEC } from './timeline-frames';

export function workspaceOutputHasTimelineAudio(output: WorkspaceOutputMetadata): boolean {
  return output.kind === 'video' && Boolean(output.hasAudio || output.audioUrl);
}

export function workspaceAssetTimelineDuration(asset: WorkspaceAssetRecord): number {
  if (asset.durationSec) return Math.max(MIN_CLIP_DURATION_SEC, asset.durationSec);
  if (asset.kind === 'audio') return 12;
  if (asset.kind === 'video') return 6;
  return 5;
}

export function workspaceOutputTimelineDuration(output: WorkspaceOutputMetadata): number {
  return Math.max(MIN_CLIP_DURATION_SEC, output.durationSec ?? 5);
}

export function workspaceAssetHasTimelineAudio(asset: WorkspaceAssetRecord): boolean {
  return asset.kind === 'video';
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
  const sourceDurationSec = durationSec;
  const mediaUrl = params.asset.url ?? params.asset.thumbUrl ?? null;
  const common = {
    outputNodeId: params.assetNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    sourceDurationSec,
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
      mediaUrl,
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
