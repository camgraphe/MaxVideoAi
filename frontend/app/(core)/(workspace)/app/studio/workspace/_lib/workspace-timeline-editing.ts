import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';
import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from './workspace-timeline-tracks';
import {
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline/timeline-frames';
import {
  timelineRangeOverlapsItem,
} from './timeline/timeline-collisions';
import {
  groupItemsFor,
  hasLinkedVideoPeer,
  primaryTimelineItemFor,
  syncLinkedAudioWithVideo,
} from './timeline/timeline-linked-audio';
import {
  editTracksForPreparedItems,
  insertIntoTrackItems,
  insertionBoundaryForWholeClipInsert,
  retimeNewItems,
  rewriteOverlappedTrackItems,
} from './timeline/timeline-insert';
import {
  resolveTimelineSplitOffset,
  resolveTimelineTrimAmount,
  type WorkspaceTimelineTrimEdge,
} from './timeline/timeline-trim';
import { uniqueTimelineIdentifier } from './timeline/timeline-identities';
import { normalizeWorkspaceTimelineStarts } from './timeline/timeline-normalize';
import {
  positionWorkspaceTimelineItem,
  positionWorkspaceTimelineItems,
  retargetTimelineSelectionItems,
} from './timeline/timeline-positioning';
import {
  timelineSelectionItemsForKeys,
  timelineSelectionKeyForItem,
  timelineSelectionKeysForItemIds,
} from './timeline/timeline-selection-groups';

export type { WorkspaceTimelineTrimEdge } from './timeline/timeline-trim';
export {
  buildWorkspaceTimelineItemsForAsset,
  buildWorkspaceTimelineItemsForOutput,
  workspaceAssetHasTimelineAudio,
  workspaceAssetTimelineDuration,
  workspaceOutputHasTimelineAudio,
  workspaceOutputTimelineDuration,
} from './timeline/timeline-builders';
export { normalizeWorkspaceTimelineIdentities } from './timeline/timeline-identities';
export { normalizeWorkspaceTimelineStarts } from './timeline/timeline-normalize';
export {
  positionWorkspaceTimelineItem,
  positionWorkspaceTimelineItems,
} from './timeline/timeline-positioning';
export {
  resizeWorkspaceTimelineItem,
  toggleWorkspaceTimelineCrossfade,
} from './timeline/timeline-resize-editing';
export type { WorkspaceTimelineTrimMode } from './timeline/timeline-resize-editing';
export { linkWorkspaceTimelineSelection, unlinkWorkspaceTimelineSelection } from './timeline/timeline-selection-groups';
export type WorkspaceTimelineInsertMode = 'insert' | 'overwrite' | 'replace';

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

function shiftTrackItemsAfter(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack,
  afterSec: number,
  deltaSec: number,
  ignoredIds: Set<string>
): WorkspaceTimelineItem[] {
  if (deltaSec === 0) return items;
  return syncLinkedAudioWithVideo(items.map((item) => {
    if (item.track !== track || ignoredIds.has(item.id) || item.startSec < afterSec) return item;
    return {
      ...item,
      startSec: snapTimelineValue(Math.max(0, item.startSec + deltaSec)),
    };
  }));
}

export function deleteWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  options: { ripple?: boolean } = {}
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  const groupItems = groupItemsFor(items, primaryItem);
  const removedIds = new Set(groupItems.map((groupItem) => groupItem.id));
  const removedTrackDurations = new Map<WorkspaceTimelineTrack, number>();
  groupItems.forEach((groupItem) => {
    removedTrackDurations.set(groupItem.track, Math.max(removedTrackDurations.get(groupItem.track) ?? 0, groupItem.durationSec));
  });

  const remainingItems = items.filter((candidate) => !removedIds.has(candidate.id));
  if (!options.ripple) return remainingItems;

  return remainingItems.map((candidate) => {
    const rippleDurationSec = removedTrackDurations.get(candidate.track);
    if (!rippleDurationSec || candidate.startSec < primaryItem.startSec + primaryItem.durationSec) return candidate;
    return {
      ...candidate,
      startSec: snapTimelineValue(Math.max(0, candidate.startSec - rippleDurationSec)),
    };
  });
}

export function insertWorkspaceTimelineItems(params: {
  allowInsertIntoClip?: boolean;
  items: WorkspaceTimelineItem[];
  newItems: WorkspaceTimelineItem[];
  mode: WorkspaceTimelineInsertMode;
  playheadSec: number;
  selectedItemId?: string | null;
  idSeed?: string;
}): WorkspaceTimelineItem[] {
  if (!params.newItems.length) return params.items;

  const idSeed = params.idSeed ?? Date.now().toString(36);
  const selectedItem = params.selectedItemId
    ? params.items.find((candidate) => candidate.id === params.selectedItemId) ?? null
    : null;
  const selectedPrimaryItem = selectedItem ? primaryTimelineItemFor(params.items, selectedItem) : null;
  const targetStartSec =
    params.mode === 'replace' && selectedPrimaryItem
      ? selectedPrimaryItem.startSec
      : snapTimelineValue(params.playheadSec);
  const replaceDurationSec = params.mode === 'replace' && selectedPrimaryItem ? selectedPrimaryItem.durationSec : undefined;
  const preliminaryItems = retimeNewItems(params.newItems, targetStartSec, replaceDurationSec);
  const resolvedTargetStartSec = params.mode === 'insert' && !params.allowInsertIntoClip
    ? insertionBoundaryForWholeClipInsert({
        items: params.items,
        preparedItems: preliminaryItems,
        requestedStartSec: targetStartSec,
      })
    : targetStartSec;
  const preparedItems = resolvedTargetStartSec === targetStartSec
    ? preliminaryItems
    : retimeNewItems(params.newItems, resolvedTargetStartSec, replaceDurationSec);
  const affectedTracks = editTracksForPreparedItems(preparedItems);
  const insertRangesByTrack = new Map<WorkspaceTimelineTrack, { endSec: number; startSec: number }>();
  preparedItems.forEach((item) => {
    if (isWorkspaceTimelineAudioTrack(item.track) && hasLinkedVideoPeer(preparedItems, item)) return;
    const currentRange = insertRangesByTrack.get(item.track);
    insertRangesByTrack.set(item.track, {
      startSec: Math.min(currentRange?.startSec ?? item.startSec, item.startSec),
      endSec: Math.max(currentRange?.endSec ?? itemEndSec(item), itemEndSec(item)),
    });
  });
  const insertDurationsByTrack = new Map(Array.from(insertRangesByTrack.entries()).map(([track, range]) => [
    track,
    snapTimelineValue(range.endSec - range.startSec),
  ]));

  if (params.mode === 'replace' && selectedPrimaryItem) {
    return [
      ...deleteWorkspaceTimelineItem(params.items, selectedPrimaryItem.id),
      ...preparedItems,
    ].sort((left, right) => left.startSec - right.startSec);
  }

  if (params.mode === 'overwrite') {
    const overwrittenItems = affectedTracks.reduce((currentItems, track) => {
      const durationSec = insertDurationsByTrack.get(track) ?? 0;
      return rewriteOverlappedTrackItems({
        items: currentItems,
        track,
        rangeStartSec: targetStartSec,
        rangeEndSec: targetStartSec + durationSec,
        idSeed,
      });
    }, params.items);
    return [...overwrittenItems, ...preparedItems].sort((left, right) => left.startSec - right.startSec);
  }

  const shiftedItems = affectedTracks.reduce((currentItems, track) => {
    const insertDurationSec = insertDurationsByTrack.get(track) ?? 0;
    return insertIntoTrackItems({
      items: currentItems,
      track,
      insertStartSec: resolvedTargetStartSec,
      insertDurationSec,
      idSeed,
    });
  }, params.items);

  return [...shiftedItems, ...preparedItems].sort((left, right) => left.startSec - right.startSec);
}

export function moveWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  direction: -1 | 1
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);

  const order = trackOrder(items, primaryItem.track);
  const oldIndex = order.indexOf(primaryItem.id);
  const nextIndex = oldIndex + direction;
  if (oldIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return items;

  const nextOrder = [...order];
  const [movedId] = nextOrder.splice(oldIndex, 1);
  nextOrder.splice(nextIndex, 0, movedId);
  const reorderedItems = orderedTrackItems(items, primaryItem.track, nextOrder);
  const remainingItems = items.filter((candidate) => candidate.track !== primaryItem.track);
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
  if (!item || !targetItem) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  const primaryTargetItem = primaryTimelineItemFor(items, targetItem);
  if (primaryItem.id === primaryTargetItem.id || primaryItem.track !== primaryTargetItem.track) return items;

  const order = trackOrder(items, primaryItem.track).filter((id) => id !== primaryItem.id);
  const targetIndex = order.indexOf(primaryTargetItem.id);
  if (targetIndex < 0) return items;
  order.splice(targetIndex + 1, 0, primaryItem.id);

  const reorderedItems = orderedTrackItems(items, primaryItem.track, order);
  const remainingItems = items.filter((candidate) => candidate.track !== primaryItem.track);
  return normalizeWorkspaceTimelineStarts([...remainingItems, ...reorderedItems]);
}

export function splitWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  splitOffsetSec?: number
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const groupId = item.linkedGroupId ?? null;
  const groupItems = groupId ? items.filter((candidate) => candidate.linkedGroupId === groupId) : [item];
  const primaryItem = primaryTimelineItemFor(items, item);
  const splitAt = resolveTimelineSplitOffset(primaryItem, splitOffsetSec);
  if (splitAt === null) return items;
  const usedItemIds = new Set(items.map((candidate) => candidate.id));
  const usedLinkedGroupIds = new Set(
    items.map((candidate) => candidate.linkedGroupId).filter((candidate): candidate is string => Boolean(candidate))
  );
  const rightGroupId = groupId ? uniqueTimelineIdentifier(`${groupId}-split`, usedLinkedGroupIds) : null;

  const nextItems = items.flatMap((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return [candidate];
    const sourceStartSec = candidate.sourceStartSec ?? 0;
    const left: WorkspaceTimelineItem = {
      ...candidate,
      durationSec: splitAt,
    };
    const right: WorkspaceTimelineItem = {
      ...candidate,
      id: uniqueTimelineIdentifier(`${candidate.id}-split`, usedItemIds),
      title: `${candidate.title} B`,
      durationSec: candidate.durationSec - splitAt,
      startSec: candidate.startSec + splitAt,
      sourceStartSec: sourceStartSec + splitAt,
      linkedGroupId: rightGroupId ?? candidate.linkedGroupId,
    };
    return [left, right];
  });

  return nextItems;
}

export function trimWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  edge: WorkspaceTimelineTrimEdge,
  deltaSec = 1
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item || deltaSec <= 0) return items;
  const groupId = item.linkedGroupId ?? null;
  const groupItems = groupId ? items.filter((candidate) => candidate.linkedGroupId === groupId) : [item];
  const primaryItem = primaryTimelineItemFor(items, item);
  const trimBy = resolveTimelineTrimAmount(primaryItem, deltaSec);
  if (trimBy <= 0) return items;

  const nextItems = items.map((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return candidate;
    return {
      ...candidate,
      durationSec: candidate.durationSec - trimBy,
      sourceStartSec: edge === 'start' ? (candidate.sourceStartSec ?? 0) + trimBy : candidate.sourceStartSec,
    };
  });
  return normalizeWorkspaceTimelineStarts(nextItems);
}

function packagePrimaryTimelineItemFor(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem | null {
  return [...items]
    .sort((left, right) => (
      (isWorkspaceTimelineVideoTrack(left.track) ? 0 : 1) - (isWorkspaceTimelineVideoTrack(right.track) ? 0 : 1) ||
      left.startSec - right.startSec ||
      left.id.localeCompare(right.id)
    ))[0] ?? null;
}

function timelineSelectionRemovalEvents(items: WorkspaceTimelineItem[], selectedKeys: Set<string>): Array<{
  durationSec: number;
  startSec: number;
  track: WorkspaceTimelineTrack;
}> {
  const selectedItems = timelineSelectionItemsForKeys(items, selectedKeys);
  return selectedItems
    .filter((item) => !(isWorkspaceTimelineAudioTrack(item.track) && hasLinkedVideoPeer(selectedItems, item)))
    .map((item) => ({
      durationSec: item.durationSec,
      startSec: item.startSec,
      track: item.track,
    }))
    .sort((left, right) => left.startSec - right.startSec || left.track.localeCompare(right.track));
}

function removeTimelineSelectionWithRipple(items: WorkspaceTimelineItem[], selectedKeys: Set<string>): WorkspaceTimelineItem[] {
  const selectedIds = new Set(timelineSelectionItemsForKeys(items, selectedKeys).map((item) => item.id));
  const removalEvents = timelineSelectionRemovalEvents(items, selectedKeys);
  const removedDurationByTrack = new Map<WorkspaceTimelineTrack, number>();
  let nextItems = items.filter((item) => !selectedIds.has(item.id));

  removalEvents.forEach((event) => {
    const removedBeforeSec = removedDurationByTrack.get(event.track) ?? 0;
    const adjustedAfterSec = snapTimelineValue(event.startSec + event.durationSec - removedBeforeSec);
    nextItems = shiftTrackItemsAfter(nextItems, event.track, adjustedAfterSec, -event.durationSec, new Set());
    removedDurationByTrack.set(event.track, snapTimelineValue(removedBeforeSec + event.durationSec));
  });

  return nextItems;
}

function adjustInsertStartAfterSelectionRipple(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  targetTrack: WorkspaceTimelineTrack,
  targetStartSec: number
): number {
  const removedBeforeSec = timelineSelectionRemovalEvents(items, selectedKeys)
    .filter((event) => event.track === targetTrack && event.startSec < targetStartSec)
    .reduce((durationSec, event) => durationSec + Math.min(event.durationSec, Math.max(0, targetStartSec - event.startSec)), 0);
  return snapTimelineValue(Math.max(0, targetStartSec - removedBeforeSec));
}

function timelineSelectionContainsTarget(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  targetTrack: WorkspaceTimelineTrack,
  targetStartSec: number
): boolean {
  return items.some((item) => (
    selectedKeys.has(timelineSelectionKeyForItem(item)) &&
    item.track === targetTrack &&
    targetStartSec > item.startSec &&
    targetStartSec < itemEndSec(item)
  ));
}

function timelineSelectionHasExternalTarget(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  targetTrack: WorkspaceTimelineTrack,
  targetStartSec: number
): boolean {
  return items.some((item) => (
    !selectedKeys.has(timelineSelectionKeyForItem(item)) &&
    item.track === targetTrack &&
    targetStartSec > item.startSec &&
    targetStartSec < itemEndSec(item)
  ));
}

function replacementTargetItemIdFor(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  targetTrack: WorkspaceTimelineTrack,
  targetStartSec: number
): string | null {
  return items
    .filter((item) => (
      !selectedKeys.has(timelineSelectionKeyForItem(item)) &&
      item.track === targetTrack &&
      targetStartSec >= item.startSec &&
      targetStartSec < itemEndSec(item)
    ))
    .sort((left, right) => left.startSec - right.startSec)[0]?.id ?? null;
}

function timelineSelectionCanMoveFreely(params: {
  items: WorkspaceTimelineItem[];
  movedItems: WorkspaceTimelineItem[];
  packagePrimaryItem: WorkspaceTimelineItem;
  packageTargetStartSec: number;
  selectedKeys: Set<string>;
}): boolean {
  const moveDeltaSec = snapTimelineValue(params.packageTargetStartSec - params.packagePrimaryItem.startSec);
  return params.movedItems.every((item) => {
    const nextStartSec = snapTimelineValue(item.startSec + moveDeltaSec);
    const nextEndSec = snapTimelineValue(nextStartSec + item.durationSec);
    return !params.items.some((candidate) => (
      !params.selectedKeys.has(timelineSelectionKeyForItem(candidate)) &&
      candidate.track === item.track &&
      timelineRangeOverlapsItem(candidate, nextStartSec, nextEndSec)
    ));
  });
}

export function moveWorkspaceTimelineSelectionWithMode(params: {
  allowInsertIntoClip?: boolean;
  anchorItemId: string;
  idSeed?: string;
  itemIds: string[];
  items: WorkspaceTimelineItem[];
  mode: WorkspaceTimelineInsertMode;
  nextStartSec: number;
  nextTrack?: WorkspaceTimelineTrack;
}): WorkspaceTimelineItem[] {
  const selectedKeys = timelineSelectionKeysForItemIds(params.items, params.itemIds);
  const anchorItem = params.items.find((candidate) => candidate.id === params.anchorItemId);
  if (!anchorItem) return params.items;

  const anchorKey = timelineSelectionKeyForItem(anchorItem);
  if (!selectedKeys.has(anchorKey)) {
    return positionWorkspaceTimelineItem(params.items, params.anchorItemId, params.nextStartSec, params.nextTrack);
  }

  const selectedItems = timelineSelectionItemsForKeys(params.items, selectedKeys);
  const anchorPrimaryItem = primaryTimelineItemFor(params.items, anchorItem);
  const packagePrimaryItem = packagePrimaryTimelineItemFor(selectedItems);
  if (!packagePrimaryItem) return params.items;

  const targetTrack = params.nextTrack && isWorkspaceTimelineVideoTrack(anchorPrimaryItem.track) && isWorkspaceTimelineVideoTrack(params.nextTrack)
    ? params.nextTrack
    : params.nextTrack && isWorkspaceTimelineAudioTrack(anchorItem.track) && isWorkspaceTimelineAudioTrack(params.nextTrack) && !hasLinkedVideoPeer(selectedItems, anchorItem)
      ? params.nextTrack
      : anchorPrimaryItem.track;
  const anchorOffsetSec = snapTimelineValue(anchorPrimaryItem.startSec - packagePrimaryItem.startSec);
  const packageTargetStartSec = snapTimelineValue(Math.max(0, params.nextStartSec - anchorOffsetSec));
  const targetInsideSelection = timelineSelectionContainsTarget(params.items, selectedKeys, targetTrack, packageTargetStartSec);
  const targetInsideExternalClip = timelineSelectionHasExternalTarget(params.items, selectedKeys, targetTrack, packageTargetStartSec);
  const movedItems = retargetTimelineSelectionItems(selectedItems, selectedKeys, anchorItem, params.nextTrack);

  if (
    params.mode === 'insert' &&
    timelineSelectionCanMoveFreely({
      items: params.items,
      movedItems,
      packagePrimaryItem,
      packageTargetStartSec,
      selectedKeys,
    })
  ) {
    return selectedKeys.size > 1
      ? positionWorkspaceTimelineItems(params.items, params.itemIds, params.anchorItemId, params.nextStartSec, params.nextTrack)
      : positionWorkspaceTimelineItem(params.items, params.anchorItemId, params.nextStartSec, params.nextTrack);
  }

  if (params.mode === 'insert' && targetInsideSelection && !targetInsideExternalClip) {
    if (isWorkspaceTimelineVideoTrack(targetTrack)) return params.items;
    return selectedKeys.size > 1
      ? positionWorkspaceTimelineItems(params.items, params.itemIds, params.anchorItemId, params.nextStartSec, params.nextTrack)
      : positionWorkspaceTimelineItem(params.items, params.anchorItemId, params.nextStartSec, params.nextTrack);
  }
  const baseItems = params.mode === 'insert'
    ? removeTimelineSelectionWithRipple(params.items, selectedKeys)
    : params.items.filter((item) => !selectedKeys.has(timelineSelectionKeyForItem(item)));
  const replacementTargetItemId = params.mode === 'replace' && selectedKeys.size <= 1
    ? replacementTargetItemIdFor(baseItems, new Set(), targetTrack, packageTargetStartSec)
    : null;
  const resolvedMode: WorkspaceTimelineInsertMode = params.mode === 'replace' && !replacementTargetItemId ? 'insert' : params.mode;
  const insertStartSec = resolvedMode === 'insert'
    ? adjustInsertStartAfterSelectionRipple(params.items, selectedKeys, targetTrack, packageTargetStartSec)
    : packageTargetStartSec;

  return insertWorkspaceTimelineItems({
    items: baseItems,
    newItems: movedItems,
    mode: resolvedMode,
    playheadSec: insertStartSec,
    selectedItemId: replacementTargetItemId,
    idSeed: params.idSeed ?? `move-${params.anchorItemId}`,
    allowInsertIntoClip: params.allowInsertIntoClip,
  });
}
