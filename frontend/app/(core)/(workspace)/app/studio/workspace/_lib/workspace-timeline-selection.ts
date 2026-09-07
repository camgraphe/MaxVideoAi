import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from './workspace-types';
import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from './workspace-timeline-tracks';

export function workspaceTimelineCutPoints(items: WorkspaceTimelineItem[]): number[] {
  const cutPoints = new Set<number>([0]);
  items
    .filter((item) => isWorkspaceTimelineVideoTrack(item.track))
    .forEach((item) => {
      cutPoints.add(Math.round(item.startSec * 1_000_000) / 1_000_000);
      cutPoints.add(Math.round((item.startSec + item.durationSec) * 1_000_000) / 1_000_000);
    });
  return Array.from(cutPoints).sort((left, right) => left - right);
}

export function timelineSelectionTouchesLockedTrack(
  items: WorkspaceTimelineItem[],
  itemIds: string[],
  lockedTracks: WorkspaceTimelineTrack[]
): boolean {
  if (!itemIds.length || !lockedTracks.length) return false;
  const selectedItemIds = new Set(itemIds);
  const selectedLinkedGroupIds = new Set(
    items
      .filter((item) => selectedItemIds.has(item.id) && item.linkedGroupId)
      .map((item) => item.linkedGroupId as string)
  );
  const lockedTrackSet = new Set(lockedTracks);
  return items.some((item) => (
    lockedTrackSet.has(item.track) &&
    (selectedItemIds.has(item.id) || Boolean(item.linkedGroupId && selectedLinkedGroupIds.has(item.linkedGroupId)))
  ));
}

export function filterHiddenVideoTrackItems(
  items: WorkspaceTimelineItem[],
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[]
): WorkspaceTimelineItem[] {
  if (!hiddenVideoTracks.length) return items;
  const hiddenVideoTrackSet = new Set<WorkspaceTimelineTrack>(hiddenVideoTracks);
  return items.filter((item) => !isWorkspaceTimelineVideoTrack(item.track) || !hiddenVideoTrackSet.has(item.track));
}

export function muteAudioTrackItems(
  items: WorkspaceTimelineItem[],
  mutedAudioTracks: WorkspaceTimelineAudioTrack[]
): WorkspaceTimelineItem[] {
  if (!mutedAudioTracks.length) return items;
  const mutedAudioTrackSet = new Set<WorkspaceTimelineTrack>(mutedAudioTracks);
  return items.map((item) => {
    if (!isWorkspaceTimelineAudioTrack(item.track) || !mutedAudioTrackSet.has(item.track)) return item;
    return {
      ...item,
      audioMix: {
        volume: item.audioMix?.volume ?? 100,
        muted: true,
      },
    };
  });
}

export function defaultTimelineSelection(items: WorkspaceTimelineItem[]): string | null {
  return items.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? items[0]?.id ?? null;
}

export function defaultTimelineSelectionIds(items: WorkspaceTimelineItem[]): string[] {
  const itemId = defaultTimelineSelection(items);
  return itemId ? [itemId] : [];
}

export function uniqueTimelineSelectionIds(itemIds: string[]): string[] {
  return Array.from(new Set(itemIds.filter(Boolean)));
}

export function nextAvailableTimelineItemId(baseId: string, items: WorkspaceTimelineItem[]): string {
  const usedIds = new Set(items.map((item) => item.id));
  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  return nextId;
}
