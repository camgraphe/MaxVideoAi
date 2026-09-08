import type { WorkspaceTimelineItem } from '../workspace-types';
import { uniqueTimelineIdentifier } from './timeline-identities';

export function timelineSelectionKeyForItem(item: WorkspaceTimelineItem): string {
  return item.linkedGroupId ? `group:${item.linkedGroupId}` : `item:${item.id}`;
}

export function timelineSelectionKeysForItemIds(items: WorkspaceTimelineItem[], itemIds: string[]): Set<string> {
  const keys = new Set<string>();
  itemIds.forEach((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) keys.add(timelineSelectionKeyForItem(item));
  });
  return keys;
}

export function timelineSelectionItemsForKeys(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>
): WorkspaceTimelineItem[] {
  return items.filter((candidate) => selectedKeys.has(timelineSelectionKeyForItem(candidate)));
}

export function unlinkWorkspaceTimelineSelection(items: WorkspaceTimelineItem[], itemIds: string[]): WorkspaceTimelineItem[] {
  const selectedKeys = timelineSelectionKeysForItemIds(items, itemIds);
  if (!selectedKeys.size) return items;
  const selectedGroupIds = new Set(
    timelineSelectionItemsForKeys(items, selectedKeys)
      .map((item) => item.linkedGroupId)
      .filter((groupId): groupId is string => Boolean(groupId))
  );
  if (!selectedGroupIds.size) return items;

  return items.map((item) => {
    if (!item.linkedGroupId || !selectedGroupIds.has(item.linkedGroupId)) return item;
    return {
      ...item,
      linkedGroupId: null,
      linkedGroupKind: null,
    };
  });
}

export function linkWorkspaceTimelineSelection(
  items: WorkspaceTimelineItem[],
  itemIds: string[],
  idSeed = Date.now().toString(36)
): WorkspaceTimelineItem[] {
  const selectedKeys = timelineSelectionKeysForItemIds(items, itemIds);
  if (selectedKeys.size < 2) return items;
  const selectedItems = timelineSelectionItemsForKeys(items, selectedKeys);
  if (selectedItems.length < 2) return items;
  const selectedItemIds = new Set(selectedItems.map((item) => item.id));
  const usedGroupIds = new Set(
    items
      .filter((item) => !selectedItemIds.has(item.id))
      .map((item) => item.linkedGroupId)
      .filter((groupId): groupId is string => Boolean(groupId))
  );
  const linkedGroupId = uniqueTimelineIdentifier(idSeed, usedGroupIds);

  return items.map((item) => {
    if (!selectedItemIds.has(item.id)) return item;
    return {
      ...item,
      linkedGroupId,
      linkedGroupKind: 'manual',
    };
  });
}
