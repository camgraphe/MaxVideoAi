import type {
  WorkspaceAssetRecord,
  WorkspaceOutputMetadata,
  WorkspaceTimelineItem,
} from '../workspace-types';
import {
  parseWorkspaceMediaDimensions,
} from '../workspace-clip-composition';
import { generatedTextReference } from '../workspace-generated-copy';
import { MIN_CLIP_DURATION_SEC } from './timeline-frames';
import {
  resolveWorkspaceAudioProvenance,
  workspaceVideoHasExternalAudio,
} from '../workspace-audio-provenance';

export function workspaceOutputHasTimelineAudio(output: WorkspaceOutputMetadata): boolean {
  return workspaceVideoHasExternalAudio(output);
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
  return Math.max(
    MIN_CLIP_DURATION_SEC,
    workspaceOutputSourceDuration(output) ?? output.requestedSettings?.durationSec ?? 5
  );
}

function workspaceOutputSourceDuration(output: WorkspaceOutputMetadata): number | undefined {
  return output.sourceMetadata?.measurementStatus === 'measured' &&
    typeof output.sourceMetadata.durationSec === 'number' &&
    Number.isFinite(output.sourceMetadata.durationSec) &&
    output.sourceMetadata.durationSec > 0
    ? output.sourceMetadata.durationSec
    : undefined;
}

export function workspaceAssetHasTimelineAudio(asset: WorkspaceAssetRecord): boolean {
  return workspaceVideoHasExternalAudio(asset);
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
  const mediaUrl = params.asset.url ?? null;
  const audioProvenance = resolveWorkspaceAudioProvenance(params.asset);
  const common = {
    assetId: params.asset.id,
    ref: params.asset.ref,
    mediaFacts: params.asset.mediaFacts,
    outputNodeId: params.assetNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    ...(sourceDurationSec !== undefined ? { sourceDurationSec } : {}),
    sourceMetadata: {
      measurementStatus: sourceDurationSec !== undefined || Boolean(parseWorkspaceMediaDimensions(params.asset.dimensions))
        ? 'measured' as const
        : 'unknown' as const,
    },
    status: 'completed' as const,
  };

  if (params.asset.kind === 'audio') {
    return [
      {
        ...common,
        id: baseId,
        track: 'audio',
        mediaKind: 'audio',
        audioProvenance: 'external',
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
    audioProvenance,
    hasEmbeddedAudio: audioProvenance === 'embedded'
      ? true
      : audioProvenance === 'unknown'
        ? undefined
        : false,
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
      audioProvenance: 'external',
      mediaUrl: params.asset.audioUrl ?? null,
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
  const sourceDurationSec = workspaceOutputSourceDuration(params.output);
  const audioProvenance = resolveWorkspaceAudioProvenance(params.output);
  const common = {
    assetId: `asset-${params.outputNodeId}`,
    outputNodeId: params.outputNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    ...(sourceDurationSec !== undefined ? { sourceDurationSec } : {}),
    requestedSettings: params.output.requestedSettings
      ? { sourceDurationSec: params.output.requestedSettings.durationSec }
      : undefined,
    sourceMetadata: {
      measurementStatus: params.output.sourceMetadata?.measurementStatus === 'measured'
        ? 'measured' as const
        : 'unknown' as const,
    },
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
        audioProvenance: 'external',
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
    audioProvenance,
    hasEmbeddedAudio: audioProvenance === 'embedded'
      ? true
      : audioProvenance === 'unknown'
        ? undefined
        : false,
    generatedCopy: params.generatedCopy,
    mediaUrl: params.output.url ?? null,
    thumbnailUrl: params.output.thumbUrl ?? params.output.url ?? null,
  };
  const sourceDimensions = params.output.sourceMetadata?.measurementStatus === 'measured' &&
    params.output.sourceMetadata.width &&
    params.output.sourceMetadata.height
    ? {
        width: params.output.sourceMetadata.width,
        height: params.output.sourceMetadata.height,
      }
    : null;
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
      audioProvenance: 'external',
      mediaUrl: params.output.audioUrl ?? null,
      thumbnailUrl: null,
    },
  ];
}
