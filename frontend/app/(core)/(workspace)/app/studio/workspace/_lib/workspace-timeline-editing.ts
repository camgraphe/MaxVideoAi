import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';

function trackOrder(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): string[] {
  return items
    .filter((item) => item.track === track)
    .sort((left, right) => left.startSec - right.startSec)
    .map((item) => item.id);
}

function orderedTrackItems(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack, order: string[]): WorkspaceTimelineItem[] {
  const itemById = new Map(items.filter((item) => item.track === track).map((item) => [item.id, item]));
  return order.map((id) => itemById.get(id)).filter((item): item is WorkspaceTimelineItem => Boolean(item));
}

export function normalizeWorkspaceTimelineStarts(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  const tracks = Array.from(new Set(items.map((item) => item.track)));
  const normalizedById = new Map<string, WorkspaceTimelineItem>();

  tracks.forEach((track) => {
    let startSec = 0;
    items
      .filter((item) => item.track === track)
      .forEach((item) => {
        normalizedById.set(item.id, { ...item, startSec });
        startSec += item.durationSec;
      });
  });

  return items.map((item) => normalizedById.get(item.id) ?? item);
}

export function moveWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  direction: -1 | 1
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;

  const order = trackOrder(items, item.track);
  const oldIndex = order.indexOf(itemId);
  const nextIndex = oldIndex + direction;
  if (oldIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return items;

  const nextOrder = [...order];
  const [movedId] = nextOrder.splice(oldIndex, 1);
  nextOrder.splice(nextIndex, 0, movedId);
  const reorderedItems = orderedTrackItems(items, item.track, nextOrder);
  const remainingItems = items.filter((candidate) => candidate.track !== item.track);
  return normalizeWorkspaceTimelineStarts([...remainingItems, ...reorderedItems]);
}

export function reorderWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  targetItemId: string
): WorkspaceTimelineItem[] {
  if (itemId === targetItemId) return items;
  const item = items.find((candidate) => candidate.id === itemId);
  const targetItem = items.find((candidate) => candidate.id === targetItemId);
  if (!item || !targetItem || item.track !== targetItem.track) return items;

  const order = trackOrder(items, item.track).filter((id) => id !== itemId);
  const targetIndex = order.indexOf(targetItemId);
  if (targetIndex < 0) return items;
  order.splice(targetIndex + 1, 0, itemId);

  const reorderedItems = orderedTrackItems(items, item.track, order);
  const remainingItems = items.filter((candidate) => candidate.track !== item.track);
  return normalizeWorkspaceTimelineStarts([...remainingItems, ...reorderedItems]);
}

export function splitWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  splitOffsetSec?: number
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;

  const splitAt = Math.max(1, Math.min(item.durationSec - 1, Math.round(splitOffsetSec ?? item.durationSec / 2)));
  if (splitAt <= 0 || splitAt >= item.durationSec) return items;

  const left: WorkspaceTimelineItem = {
    ...item,
    durationSec: splitAt,
  };
  const right: WorkspaceTimelineItem = {
    ...item,
    id: `${item.id}-split`,
    title: `${item.title} B`,
    durationSec: item.durationSec - splitAt,
    startSec: item.startSec + splitAt,
  };

  const nextItems = items.flatMap((candidate) => (candidate.id === itemId ? [left, right] : [candidate]));
  return normalizeWorkspaceTimelineStarts(nextItems);
}
