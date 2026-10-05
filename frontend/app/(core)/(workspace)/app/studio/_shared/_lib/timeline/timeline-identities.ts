import type { WorkspaceTimelineItem } from '../workspace-types';
import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';

export function uniqueTimelineIdentifier(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  usedIds.add(nextId);
  return nextId;
}

function sortLinkedTimelineItems(left: WorkspaceTimelineItem, right: WorkspaceTimelineItem): number {
  return (
    left.startSec - right.startSec ||
    (left.sourceStartSec ?? 0) - (right.sourceStartSec ?? 0) ||
    left.durationSec - right.durationSec ||
    left.id.localeCompare(right.id)
  );
}

export function normalizeWorkspaceTimelineIdentities(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  let changed = false;
  const usedItemIds = new Set<string>();
  const uniqueItems = items.map((item) => {
    const nextId = uniqueTimelineIdentifier(item.id, usedItemIds);
    if (nextId === item.id) return item;
    changed = true;
    return {
      ...item,
      id: nextId,
    };
  });

  const linkedGroups = new Map<string, WorkspaceTimelineItem[]>();
  uniqueItems.forEach((item) => {
    if (!item.linkedGroupId) return;
    const groupItems = linkedGroups.get(item.linkedGroupId) ?? [];
    groupItems.push(item);
    linkedGroups.set(item.linkedGroupId, groupItems);
  });

  const usedGroupIds = new Set<string>();
  const nextGroupIdByItemId = new Map<string, string | null>();
  linkedGroups.forEach((groupItems, groupId) => {
    if (groupItems.every((item) => item.linkedGroupKind === 'manual')) {
      const manualGroupId = uniqueTimelineIdentifier(groupId, usedGroupIds);
      groupItems.forEach((item) => {
        nextGroupIdByItemId.set(item.id, manualGroupId);
      });
      return;
    }

    const videoItems = groupItems.filter((item) => isWorkspaceTimelineVideoTrack(item.track)).sort(sortLinkedTimelineItems);
    const audioItems = groupItems.filter((item) => isWorkspaceTimelineAudioTrack(item.track)).sort(sortLinkedTimelineItems);
    const remainingItems = groupItems
      .filter((item) => !isWorkspaceTimelineVideoTrack(item.track) && !isWorkspaceTimelineAudioTrack(item.track))
      .sort(sortLinkedTimelineItems);
    if (!videoItems.length || !audioItems.length) {
      groupItems.forEach((item) => {
        nextGroupIdByItemId.set(item.id, null);
      });
      return;
    }
    const pairCount = Math.max(videoItems.length, audioItems.length);

    for (let index = 0; index < pairCount; index += 1) {
      const pairGroupId = uniqueTimelineIdentifier(index === 0 ? groupId : `${groupId}-${index + 1}`, usedGroupIds);
      const videoItem = videoItems[index];
      const audioItem = audioItems[index];
      if (videoItem) nextGroupIdByItemId.set(videoItem.id, pairGroupId);
      if (audioItem) nextGroupIdByItemId.set(audioItem.id, pairGroupId);
    }

    remainingItems.forEach((item, index) => {
      const groupBaseId = pairCount === 0 && index === 0 ? groupId : `${groupId}-item-${index + 1}`;
      nextGroupIdByItemId.set(item.id, uniqueTimelineIdentifier(groupBaseId, usedGroupIds));
    });
  });

  const repairedItems = uniqueItems.map((item) => {
    if (!item.linkedGroupId) return item;
    const nextGroupId = nextGroupIdByItemId.get(item.id);
    if (nextGroupId === undefined || nextGroupId === item.linkedGroupId) return item;
    changed = true;
    return {
      ...item,
      linkedGroupId: nextGroupId,
      linkedGroupKind: nextGroupId ? item.linkedGroupKind : null,
    };
  });

  return changed ? repairedItems : items;
}
