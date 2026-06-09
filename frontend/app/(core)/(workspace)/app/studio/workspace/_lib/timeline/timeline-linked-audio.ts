import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem } from '../workspace-types';

export function primaryTimelineItemFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem {
  if (!item.linkedGroupId) return item;
  return items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track)) ?? item;
}

export function shouldMirrorLinkedVideo(item: WorkspaceTimelineItem, items: WorkspaceTimelineItem[]): boolean {
  if (!item.linkedGroupId || item.linkedGroupKind === 'manual' || !isWorkspaceTimelineAudioTrack(item.track)) return false;
  return items.some((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
}

export function groupItemsFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem[] {
  return item.linkedGroupId ? items.filter((candidate) => candidate.linkedGroupId === item.linkedGroupId) : [item];
}

export function hasLinkedVideoPeer(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): boolean {
  return Boolean(item.linkedGroupId && items.some((candidate) => (
    candidate.linkedGroupId === item.linkedGroupId &&
    item.linkedGroupKind !== 'manual' &&
    isWorkspaceTimelineVideoTrack(candidate.track)
  )));
}

export function syncLinkedAudioWithVideo(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  return items.map((item) => {
    if (!shouldMirrorLinkedVideo(item, items)) return item;
    const videoItem = items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
    if (!videoItem) return item;
    return {
      ...item,
      startSec: videoItem.startSec,
      durationSec: videoItem.durationSec,
      sourceStartSec: videoItem.sourceStartSec,
      sourceDurationSec: videoItem.sourceDurationSec,
    };
  });
}
