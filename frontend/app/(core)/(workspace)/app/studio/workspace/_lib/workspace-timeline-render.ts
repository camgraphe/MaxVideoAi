import type {
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from './workspace-types';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineVideoTrackIndex,
} from './workspace-timeline-tracks';

const WORKSPACE_TIMELINE_RENDER_VERSION = 1;

type WorkspaceTimelineRenderIssueCode =
  | 'empty_timeline'
  | 'missing_media'
  | 'processing_media'
  | 'overlapping_clips'
  | 'orphan_linked_audio'
  | 'invalid_transition';

export type WorkspaceTimelineRenderIssue = {
  code: WorkspaceTimelineRenderIssueCode;
  severity: 'blocking' | 'warning';
  itemId?: string;
  message: string;
};

export type WorkspaceTimelineRenderTransition = {
  type: 'crossfade';
  durationSec: number;
  nextClipId: string;
};

export type WorkspaceTimelineRenderClip = {
  id: string;
  outputNodeId: string;
  title: string;
  track: WorkspaceTimelineTrack;
  mediaKind: 'video' | 'audio' | 'image';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  startSec: number;
  endSec: number;
  durationSec: number;
  sourceStartSec: number;
  sourceEndSec: number;
  sourceDurationSec: number;
  linkedGroupId?: string | null;
  hasEmbeddedAudio?: boolean;
  modelId?: string;
  transform?: WorkspaceTimelineItem['transform'];
  audioMix?: WorkspaceTimelineItem['audioMix'];
  transitionOut?: WorkspaceTimelineRenderTransition | null;
};

export type WorkspaceTimelineRenderTrack = {
  id: WorkspaceTimelineTrack;
  clips: WorkspaceTimelineRenderClip[];
  durationSec: number;
};

export type WorkspaceTimelineExportRangeMode = 'sequence' | 'in-out';

export type WorkspaceTimelineRenderExportRange = {
  mode: WorkspaceTimelineExportRangeMode;
  startSec: number;
  endSec: number;
  durationSec: number;
};

export type WorkspaceTimelineRenderManifest = {
  version: typeof WORKSPACE_TIMELINE_RENDER_VERSION;
  source: 'maxvideoai-editor';
  projectName: string;
  sequenceId: string;
  sequenceName: string;
  projectSettings?: WorkspaceProjectSettings;
  createdAt: string;
  status: 'ready' | 'blocked';
  durationSec: number;
  exportRange: WorkspaceTimelineRenderExportRange;
  tracks: WorkspaceTimelineRenderTrack[];
  issues: WorkspaceTimelineRenderIssue[];
};

function roundTimelineSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function itemEndSec(item: Pick<WorkspaceTimelineItem, 'startSec' | 'durationSec'>): number {
  return roundTimelineSeconds(item.startSec + item.durationSec);
}

function isVideoTimelineTrack(track: WorkspaceTimelineTrack): boolean {
  return isWorkspaceTimelineVideoTrack(track);
}

function timelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineVideoTrackIndex(track);
}

function timelineTrackOrderForItems(items: WorkspaceTimelineItem[]): WorkspaceTimelineTrack[] {
  const videoTracks = Array.from(new Set(items.map((item) => item.track).filter(isVideoTimelineTrack)))
    .sort((left, right) => timelineVideoTrackIndex(left) - timelineVideoTrackIndex(right));
  const audioTracks = Array.from(new Set(items.map((item) => item.track).filter(isWorkspaceTimelineAudioTrack)))
    .sort((left, right) => workspaceTimelineAudioTrackIndex(left) - workspaceTimelineAudioTrackIndex(right));
  return [
    ...(videoTracks.length ? videoTracks : ['video' as WorkspaceTimelineTrack]),
    ...(audioTracks.length ? audioTracks : ['audio' as WorkspaceTimelineTrack]),
  ];
}

function mediaKindForItem(item: WorkspaceTimelineItem): WorkspaceTimelineRenderClip['mediaKind'] {
  if (item.mediaKind) return item.mediaKind;
  return isVideoTimelineTrack(item.track) ? 'video' : 'audio';
}

function nodeForItem(nodes: WorkspaceGraphNode[], item: WorkspaceTimelineItem): WorkspaceGraphNode | null {
  return nodes.find((node) => node.id === item.outputNodeId) ?? null;
}

function outputForItem(nodes: WorkspaceGraphNode[], item: WorkspaceTimelineItem) {
  return nodeForItem(nodes, item)?.data.output ?? null;
}

function mediaUrlForItem(nodes: WorkspaceGraphNode[], item: WorkspaceTimelineItem): string | null {
  if (item.mediaUrl) return item.mediaUrl;
  const node = nodeForItem(nodes, item);
  return node?.data.output?.url ?? node?.data.asset?.url ?? null;
}

function timelineDurationForItems(items: WorkspaceTimelineItem[]): number {
  return roundTimelineSeconds(items.reduce((durationSec, item) => Math.max(durationSec, itemEndSec(item)), 0));
}

function exportRangeForItems(
  items: WorkspaceTimelineItem[],
  requestedRange?: {
    mode: WorkspaceTimelineExportRangeMode;
    startSec?: number | null;
    endSec?: number | null;
  }
): WorkspaceTimelineRenderExportRange {
  const sequenceEndSec = timelineDurationForItems(items);
  if (requestedRange?.mode === 'in-out') {
    const startSec = roundTimelineSeconds(Math.max(0, Math.min(requestedRange.startSec ?? 0, sequenceEndSec)));
    const endSec = roundTimelineSeconds(Math.max(startSec, Math.min(requestedRange.endSec ?? sequenceEndSec, sequenceEndSec)));
    if (endSec > startSec) {
      return {
        mode: 'in-out',
        startSec,
        endSec,
        durationSec: roundTimelineSeconds(endSec - startSec),
      };
    }
  }

  return {
    mode: 'sequence',
    startSec: 0,
    endSec: sequenceEndSec,
    durationSec: sequenceEndSec,
  };
}

function trimItemToExportRange(item: WorkspaceTimelineItem, exportRange: WorkspaceTimelineRenderExportRange): WorkspaceTimelineItem | null {
  const overlapStartSec = Math.max(item.startSec, exportRange.startSec);
  const overlapEndSec = Math.min(itemEndSec(item), exportRange.endSec);
  if (overlapEndSec <= overlapStartSec) return null;

  const trimBeforeSec = roundTimelineSeconds(overlapStartSec - item.startSec);
  const durationSec = roundTimelineSeconds(overlapEndSec - overlapStartSec);
  return {
    ...item,
    startSec: roundTimelineSeconds(overlapStartSec - exportRange.startSec),
    durationSec,
    sourceStartSec: roundTimelineSeconds((item.sourceStartSec ?? 0) + trimBeforeSec),
    transitionOut: overlapEndSec < itemEndSec(item) ? null : item.transitionOut,
  };
}

function itemsForExportRange(items: WorkspaceTimelineItem[], exportRange: WorkspaceTimelineRenderExportRange): WorkspaceTimelineItem[] {
  return items.flatMap((item) => {
    const exportItem = trimItemToExportRange(item, exportRange);
    return exportItem ? [exportItem] : [];
  });
}

function issueForUnavailableItem(nodes: WorkspaceGraphNode[], item: WorkspaceTimelineItem): WorkspaceTimelineRenderIssue | null {
  const output = outputForItem(nodes, item);
  if (output?.status === 'processing' || output?.status === 'placeholder') {
    return {
      code: 'processing_media',
      severity: 'blocking',
      itemId: item.id,
      message: `${item.title} is still processing and cannot be rendered yet.`,
    };
  }
  if (output?.status === 'failed') {
    return {
      code: 'missing_media',
      severity: 'blocking',
      itemId: item.id,
      message: `${item.title} failed and has no renderable media.`,
    };
  }
  if (!mediaUrlForItem(nodes, item)) {
    return {
      code: 'missing_media',
      severity: 'blocking',
      itemId: item.id,
      message: `${item.title} has no media URL for final render.`,
    };
  }
  return null;
}

function transitionForItem(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineRenderTransition | null {
  if (!isVideoTimelineTrack(item.track) || item.transitionOut?.type !== 'crossfade') return null;
  const nextClip = items
    .filter((candidate) => candidate.track === item.track && candidate.id !== item.id)
    .sort((left, right) => left.startSec - right.startSec)
    .find((candidate) => candidate.startSec >= itemEndSec(item) - 0.25);
  if (!nextClip) return null;
  const safeDurationSec = Math.max(0, Math.min(
    item.transitionOut.durationSec,
    item.durationSec / 2,
    nextClip.durationSec / 2
  ));
  if (safeDurationSec <= 0) return null;
  return {
    type: 'crossfade',
    durationSec: roundTimelineSeconds(safeDurationSec),
    nextClipId: nextClip.id,
  };
}

function renderClipForItem(nodes: WorkspaceGraphNode[], items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineRenderClip | null {
  const mediaUrl = mediaUrlForItem(nodes, item);
  if (!mediaUrl) return null;
  const sourceStartSec = roundTimelineSeconds(item.sourceStartSec ?? 0);
  const durationSec = roundTimelineSeconds(item.durationSec);
  const sourceDurationSec = roundTimelineSeconds(item.sourceDurationSec ?? item.durationSec);
  return {
    id: item.id,
    outputNodeId: item.outputNodeId,
    title: item.title,
    track: item.track,
    mediaKind: mediaKindForItem(item),
    mediaUrl,
    thumbnailUrl: item.thumbnailUrl ?? nodeForItem(nodes, item)?.data.output?.thumbUrl ?? nodeForItem(nodes, item)?.data.asset?.thumbUrl ?? null,
    startSec: roundTimelineSeconds(item.startSec),
    endSec: itemEndSec(item),
    durationSec,
    sourceStartSec,
    sourceEndSec: roundTimelineSeconds(sourceStartSec + durationSec),
    sourceDurationSec,
    linkedGroupId: item.linkedGroupId ?? null,
    hasEmbeddedAudio: item.hasEmbeddedAudio,
    modelId: item.modelId,
    transform: item.transform,
    audioMix: item.audioMix,
    transitionOut: transitionForItem(items, item),
  };
}

function overlapIssues(items: WorkspaceTimelineItem[]): WorkspaceTimelineRenderIssue[] {
  return timelineTrackOrderForItems(items).flatMap((track) => {
    const clips = items
      .filter((item) => item.track === track)
      .sort((left, right) => left.startSec - right.startSec);
    return clips.flatMap((item, index) => {
      const previous = clips[index - 1];
      if (!previous || item.startSec >= itemEndSec(previous)) return [];
      return [{
        code: 'overlapping_clips' as const,
        severity: 'blocking' as const,
        itemId: item.id,
        message: `${item.title} overlaps ${previous.title} on the ${track} track.`,
      }];
    });
  });
}

function linkedAudioIssues(items: WorkspaceTimelineItem[]): WorkspaceTimelineRenderIssue[] {
  return items.flatMap((item) => {
    if (!isWorkspaceTimelineAudioTrack(item.track) || !item.linkedGroupId) return [];
    const linkedVideo = items.some((candidate) => isVideoTimelineTrack(candidate.track) && candidate.linkedGroupId === item.linkedGroupId);
    if (linkedVideo) return [];
    return [{
      code: 'orphan_linked_audio' as const,
      severity: 'warning' as const,
      itemId: item.id,
      message: `${item.title} is linked audio without a matching video clip.`,
    }];
  });
}

function transitionIssues(items: WorkspaceTimelineItem[]): WorkspaceTimelineRenderIssue[] {
  return items.flatMap((item) => {
    if (!isVideoTimelineTrack(item.track) || item.transitionOut?.type !== 'crossfade') return [];
    const transition = transitionForItem(items, item);
    if (!transition) {
      return [{
        code: 'invalid_transition' as const,
        severity: 'warning' as const,
        itemId: item.id,
        message: `${item.title} has a transition but no next video clip.`,
      }];
    }
    const nextClip = items.find((candidate) => candidate.id === transition.nextClipId);
    if (!nextClip || Math.abs(nextClip.startSec - itemEndSec(item)) <= 0.25) return [];
    return [{
      code: 'invalid_transition' as const,
      severity: 'warning' as const,
      itemId: item.id,
      message: `${item.title} has a crossfade across a gap.`,
    }];
  });
}

export function buildWorkspaceTimelineRenderManifest(params: {
  items: WorkspaceTimelineItem[];
  nodes: WorkspaceGraphNode[];
  projectName: string;
  sequenceId?: string;
  sequenceName?: string;
  projectSettings?: WorkspaceProjectSettings;
  createdAt?: string;
  exportRange?: {
    mode: WorkspaceTimelineExportRangeMode;
    startSec?: number | null;
    endSec?: number | null;
  };
}): WorkspaceTimelineRenderManifest {
  const exportRange = exportRangeForItems(params.items, params.exportRange);
  const exportItems = itemsForExportRange(params.items, exportRange);
  const issues: WorkspaceTimelineRenderIssue[] = [];
  if (!exportItems.length) {
    issues.push({
      code: 'empty_timeline',
      severity: 'blocking',
      message: 'The timeline is empty.',
    });
  }

  exportItems.forEach((item) => {
    const issue = issueForUnavailableItem(params.nodes, item);
    if (issue) issues.push(issue);
  });
  issues.push(...overlapIssues(exportItems), ...linkedAudioIssues(exportItems), ...transitionIssues(exportItems));

  const tracks = timelineTrackOrderForItems(exportItems).map((track): WorkspaceTimelineRenderTrack => {
    const clips = exportItems
      .filter((item) => item.track === track)
      .sort((left, right) => left.startSec - right.startSec)
      .map((item) => renderClipForItem(params.nodes, exportItems, item))
      .filter((clip): clip is WorkspaceTimelineRenderClip => Boolean(clip));
    return {
      id: track,
      clips,
      durationSec: clips.reduce((durationSec, clip) => Math.max(durationSec, clip.endSec), 0),
    };
  });
  const durationSec = exportRange.durationSec;
  const status = issues.some((issue) => issue.severity === 'blocking') ? 'blocked' : 'ready';

  return {
    version: WORKSPACE_TIMELINE_RENDER_VERSION,
    source: 'maxvideoai-editor',
    projectName: params.projectName,
    sequenceId: params.sequenceId ?? 'sequence-main',
    sequenceName: params.sequenceName?.trim() || 'Main sequence',
    projectSettings: params.projectSettings,
    createdAt: params.createdAt ?? new Date().toISOString(),
    status,
    durationSec,
    exportRange,
    tracks,
    issues,
  };
}

export function serializeWorkspaceTimelineRenderManifest(manifest: WorkspaceTimelineRenderManifest): string {
  return JSON.stringify(manifest, null, 2);
}
