import type {
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from './workspace-types';
import {
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineVideoTrackIndex,
} from './workspace-timeline-tracks';

const WORKSPACE_TIMELINE_RENDER_VERSION = 1;
const AUDIO_TRACK_ORDER: WorkspaceTimelineTrack[] = ['linked-audio', 'music', 'voiceover', 'sfx'];

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

export type WorkspaceTimelineRenderManifest = {
  version: typeof WORKSPACE_TIMELINE_RENDER_VERSION;
  source: 'maxvideoai-editor';
  projectName: string;
  projectSettings?: WorkspaceProjectSettings;
  createdAt: string;
  status: 'ready' | 'blocked';
  durationSec: number;
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
  return [...(videoTracks.length ? videoTracks : ['video' as WorkspaceTimelineTrack]), ...AUDIO_TRACK_ORDER];
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
    if (item.track !== 'linked-audio' || !item.linkedGroupId) return [];
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
  projectSettings?: WorkspaceProjectSettings;
  createdAt?: string;
}): WorkspaceTimelineRenderManifest {
  const issues: WorkspaceTimelineRenderIssue[] = [];
  if (!params.items.length) {
    issues.push({
      code: 'empty_timeline',
      severity: 'blocking',
      message: 'The timeline is empty.',
    });
  }

  params.items.forEach((item) => {
    const issue = issueForUnavailableItem(params.nodes, item);
    if (issue) issues.push(issue);
  });
  issues.push(...overlapIssues(params.items), ...linkedAudioIssues(params.items), ...transitionIssues(params.items));

  const tracks = timelineTrackOrderForItems(params.items).map((track): WorkspaceTimelineRenderTrack => {
    const clips = params.items
      .filter((item) => item.track === track)
      .sort((left, right) => left.startSec - right.startSec)
      .map((item) => renderClipForItem(params.nodes, params.items, item))
      .filter((clip): clip is WorkspaceTimelineRenderClip => Boolean(clip));
    return {
      id: track,
      clips,
      durationSec: clips.reduce((durationSec, clip) => Math.max(durationSec, clip.endSec), 0),
    };
  });
  const durationSec = roundTimelineSeconds(tracks.reduce((maxDurationSec, track) => Math.max(maxDurationSec, track.durationSec), 0));
  const status = issues.some((issue) => issue.severity === 'blocking') ? 'blocked' : 'ready';

  return {
    version: WORKSPACE_TIMELINE_RENDER_VERSION,
    source: 'maxvideoai-editor',
    projectName: params.projectName,
    projectSettings: params.projectSettings,
    createdAt: params.createdAt ?? new Date().toISOString(),
    status,
    durationSec,
    tracks,
    issues,
  };
}

export function serializeWorkspaceTimelineRenderManifest(manifest: WorkspaceTimelineRenderManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function workspaceTimelineRenderReadinessLabel(manifest: WorkspaceTimelineRenderManifest): string {
  const clipCount = manifest.tracks.reduce((count, track) => count + track.clips.length, 0);
  if (manifest.status === 'blocked') {
    const blockingCount = manifest.issues.filter((issue) => issue.severity === 'blocking').length;
    return `Render blocked: ${blockingCount} issue${blockingCount > 1 ? 's' : ''} to fix.`;
  }
  return `Render manifest ready: ${clipCount} clip${clipCount > 1 ? 's' : ''}, ${Math.round(manifest.durationSec)}s.`;
}
