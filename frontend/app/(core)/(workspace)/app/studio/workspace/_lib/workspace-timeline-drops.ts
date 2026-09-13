import type { WorkspaceAssetRecord, WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';
import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from './workspace-timeline-tracks';

export function workspaceTimelineItemsCompatibleWithTrack(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack
): boolean {
  const hasVisualItem = items.some((item) => isWorkspaceTimelineVideoTrack(item.track) && item.mediaKind !== 'audio');
  const hasOnlyAudioItems = items.every((item) => item.mediaKind === 'audio' || isWorkspaceTimelineAudioTrack(item.track));
  return isWorkspaceTimelineVideoTrack(track) ? hasVisualItem : isWorkspaceTimelineAudioTrack(track) && hasOnlyAudioItems;
}

export function retargetWorkspaceTimelineItemsForTrack(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  if (isWorkspaceTimelineVideoTrack(track)) {
    return items.map((item) => (isWorkspaceTimelineVideoTrack(item.track) ? { ...item, track } : item));
  }
  if (isWorkspaceTimelineAudioTrack(track)) {
    return items.map((item) => (item.mediaKind === 'audio' || isWorkspaceTimelineAudioTrack(item.track) ? { ...item, track } : item));
  }
  return items;
}

export function timelineTrackHasClipAt(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack,
  seconds: number
): boolean {
  return items.some((item) => (
    item.track === track &&
    seconds > item.startSec &&
    seconds < item.startSec + item.durationSec
  ));
}

export function projectAssetTimelineNodeId(asset: WorkspaceAssetRecord): string {
  const safeId = asset.id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
  return `project-asset-${safeId}`;
}
