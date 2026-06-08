import type { WorkspaceAssetRecord, WorkspaceOutputMetadata, WorkspaceTimelineItem, WorkspaceTimelineTrack } from './workspace-types';
import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from './workspace-timeline-tracks';

const MIN_CLIP_DURATION_SEC = 1;
const TIMELINE_SECOND_PRECISION = 1_000_000;

export type WorkspaceTimelineTrimEdge = 'start' | 'end';
export type WorkspaceTimelineInsertMode = 'insert' | 'overwrite' | 'replace';
export type WorkspaceTimelineTrimMode = 'trim' | 'ripple' | 'roll';

function clampTimelineValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snapTimelineValue(value: number): number {
  return Math.round(value * TIMELINE_SECOND_PRECISION) / TIMELINE_SECOND_PRECISION;
}

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

function primaryTimelineItemFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem {
  if (!item.linkedGroupId) return item;
  return items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track)) ?? item;
}

function shouldMirrorLinkedVideo(item: WorkspaceTimelineItem, items: WorkspaceTimelineItem[]): boolean {
  if (!item.linkedGroupId || item.linkedGroupKind === 'manual' || !isWorkspaceTimelineAudioTrack(item.track)) return false;
  return items.some((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
}

function groupItemsFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem[] {
  return item.linkedGroupId ? items.filter((candidate) => candidate.linkedGroupId === item.linkedGroupId) : [item];
}

function itemEndSec(item: WorkspaceTimelineItem): number {
  return item.startSec + item.durationSec;
}

function uniqueTimelineIdentifier(baseId: string, usedIds: Set<string>): string {
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

function sourceDurationForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceStartSec = item.sourceStartSec ?? 0;
  return Math.max(MIN_CLIP_DURATION_SEC, item.sourceDurationSec ?? sourceStartSec + item.durationSec);
}

function sourceStartForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceDurationSec = sourceDurationForTimelineItem(item);
  return clampTimelineValue(item.sourceStartSec ?? 0, 0, Math.max(0, sourceDurationSec - MIN_CLIP_DURATION_SEC));
}

function sourceRightRoomForTimelineItem(item: WorkspaceTimelineItem): number {
  return Math.max(0, sourceDurationForTimelineItem(item) - sourceStartForTimelineItem(item) - item.durationSec);
}

function maxResizeDurationForTimelineItem(item: WorkspaceTimelineItem, edge: WorkspaceTimelineTrimEdge): number {
  if (edge === 'start') return Math.max(MIN_CLIP_DURATION_SEC, item.durationSec + sourceStartForTimelineItem(item));
  return Math.max(MIN_CLIP_DURATION_SEC, item.durationSec + sourceRightRoomForTimelineItem(item));
}

function clampSourceStartForDuration(item: WorkspaceTimelineItem, sourceStartSec: number, durationSec: number): number {
  return clampTimelineValue(
    sourceStartSec,
    0,
    Math.max(0, sourceDurationForTimelineItem(item) - durationSec)
  );
}

function resolveResizeTarget(params: {
  item: WorkspaceTimelineItem;
  edge: WorkspaceTimelineTrimEdge;
  nextDurationSec: number;
}): { safeDurationSec: number; safeStartSec: number; sourceDeltaSec: number } {
  const itemEnd = itemEndSec(params.item);
  const maxDurationSec = maxResizeDurationForTimelineItem(params.item, params.edge);
  const requestedDurationSec = snapTimelineValue(clampTimelineValue(params.nextDurationSec, MIN_CLIP_DURATION_SEC, maxDurationSec));

  if (params.edge === 'end') {
    return {
      safeDurationSec: requestedDurationSec,
      safeStartSec: params.item.startSec,
      sourceDeltaSec: 0,
    };
  }

  const safeStartSec = snapTimelineValue(clampTimelineValue(
    itemEnd - requestedDurationSec,
    0,
    itemEnd - MIN_CLIP_DURATION_SEC
  ));
  return {
    safeDurationSec: snapTimelineValue(itemEnd - safeStartSec),
    safeStartSec,
    sourceDeltaSec: snapTimelineValue(safeStartSec - params.item.startSec),
  };
}

function syncLinkedAudioWithVideo(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
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

function updateGroupItems(
  items: WorkspaceTimelineItem[],
  groupItems: WorkspaceTimelineItem[],
  updater: (item: WorkspaceTimelineItem) => WorkspaceTimelineItem
): WorkspaceTimelineItem[] {
  const groupIds = new Set(groupItems.map((groupItem) => groupItem.id));
  return items.map((item) => (groupIds.has(item.id) ? updater(item) : item));
}

function primaryTrackItems(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): WorkspaceTimelineItem[] {
  return items
    .filter((item) => item.track === track)
    .sort((left, right) => left.startSec - right.startSec);
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

function nearestTrackItemAfter(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem | null {
  return primaryTrackItems(items, item.track).find((candidate) => candidate.id !== item.id && candidate.startSec >= itemEndSec(item) - 0.25) ?? null;
}

function nearestTrackItemBefore(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem | null {
  return primaryTrackItems(items, item.track)
    .filter((candidate) => candidate.id !== item.id && itemEndSec(candidate) <= item.startSec + 0.25)
    .at(-1) ?? null;
}

function retimeNewItems(items: WorkspaceTimelineItem[], startSec: number, durationSec?: number): WorkspaceTimelineItem[] {
  const primaryItem = items.find((item) => isWorkspaceTimelineVideoTrack(item.track)) ?? items[0] ?? null;
  const startDeltaSec = primaryItem ? startSec - primaryItem.startSec : 0;
  return items.map((item) => ({
    ...item,
    startSec: snapTimelineValue(item.startSec + startDeltaSec),
    durationSec: durationSec ? Math.max(MIN_CLIP_DURATION_SEC, Math.min(item.durationSec, durationSec)) : item.durationSec,
    sourceDurationSec: item.sourceDurationSec ?? item.durationSec,
    sourceStartSec: item.sourceStartSec ?? 0,
  }));
}

function hasLinkedVideoPeer(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): boolean {
  return Boolean(item.linkedGroupId && items.some((candidate) => (
    candidate.linkedGroupId === item.linkedGroupId &&
    item.linkedGroupKind !== 'manual' &&
    isWorkspaceTimelineVideoTrack(candidate.track)
  )));
}

function editTracksForPreparedItems(items: WorkspaceTimelineItem[]): WorkspaceTimelineTrack[] {
  return Array.from(new Set(items.flatMap((item) => {
    if (isWorkspaceTimelineAudioTrack(item.track) && hasLinkedVideoPeer(items, item)) return [];
    return [item.track];
  })));
}

function shouldEditTrackItem(params: {
  items: WorkspaceTimelineItem[];
  item: WorkspaceTimelineItem;
  track: WorkspaceTimelineTrack;
}): boolean {
  if (params.item.track === params.track) return true;
  if (!isWorkspaceTimelineVideoTrack(params.track) || !isWorkspaceTimelineAudioTrack(params.item.track) || !params.item.linkedGroupId) {
    return false;
  }
  return params.items.some((candidate) => (
    candidate.linkedGroupId === params.item.linkedGroupId &&
    candidate.track === params.track
  ));
}

function rewriteOverlappedTrackItems(params: {
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
  rangeStartSec: number;
  rangeEndSec: number;
  idSeed: string;
}): WorkspaceTimelineItem[] {
  return params.items.flatMap((item) => {
    if (!shouldEditTrackItem({ items: params.items, item, track: params.track })) return [item];
    const itemStartSec = item.startSec;
    const itemEnd = itemEndSec(item);
    if (itemEnd <= params.rangeStartSec || itemStartSec >= params.rangeEndSec) return [item];

    const leftDurationSec = Math.max(0, params.rangeStartSec - itemStartSec);
    const rightDurationSec = Math.max(0, itemEnd - params.rangeEndSec);
    const nextItems: WorkspaceTimelineItem[] = [];

    if (leftDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        durationSec: snapTimelineValue(leftDurationSec),
      });
    }

    if (rightDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        id: `${item.id}-tail-${params.idSeed}`,
        title: `${item.title} Tail`,
        startSec: snapTimelineValue(params.rangeEndSec),
        durationSec: snapTimelineValue(rightDurationSec),
        sourceStartSec: snapTimelineValue((item.sourceStartSec ?? 0) + (params.rangeEndSec - itemStartSec)),
        linkedGroupId: item.linkedGroupId ? `${item.linkedGroupId}-tail-${params.idSeed}` : item.linkedGroupId,
      });
    }

    return nextItems;
  });
}

function insertIntoTrackItems(params: {
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
  insertStartSec: number;
  insertDurationSec: number;
  idSeed: string;
}): WorkspaceTimelineItem[] {
  return params.items.flatMap((item) => {
    if (!shouldEditTrackItem({ items: params.items, item, track: params.track })) return [item];
    const itemStartSec = item.startSec;
    const itemEnd = itemEndSec(item);
    if (itemEnd <= params.insertStartSec) return [item];
    if (itemStartSec >= params.insertStartSec) {
      return [{
        ...item,
        startSec: snapTimelineValue(item.startSec + params.insertDurationSec),
      }];
    }

    const leftDurationSec = params.insertStartSec - itemStartSec;
    const rightDurationSec = itemEnd - params.insertStartSec;
    const nextItems: WorkspaceTimelineItem[] = [];
    if (leftDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        durationSec: snapTimelineValue(leftDurationSec),
      });
    }
    if (rightDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        id: `${item.id}-tail-${params.idSeed}`,
        title: `${item.title} Tail`,
        startSec: snapTimelineValue(params.insertStartSec + params.insertDurationSec),
        durationSec: snapTimelineValue(rightDurationSec),
        sourceStartSec: snapTimelineValue((item.sourceStartSec ?? 0) + leftDurationSec),
        linkedGroupId: item.linkedGroupId ? `${item.linkedGroupId}-tail-${params.idSeed}` : item.linkedGroupId,
      });
    }
    return nextItems;
  });
}

function insertReferenceTrackForPreparedItems(items: WorkspaceTimelineItem[]): WorkspaceTimelineTrack | null {
  const tracks = editTracksForPreparedItems(items);
  return tracks.find((track) => isWorkspaceTimelineVideoTrack(track)) ?? tracks[0] ?? null;
}

function insertionBoundaryForWholeClipInsert(params: {
  items: WorkspaceTimelineItem[];
  preparedItems: WorkspaceTimelineItem[];
  requestedStartSec: number;
}): number {
  const referenceTrack = insertReferenceTrackForPreparedItems(params.preparedItems);
  if (!referenceTrack) return params.requestedStartSec;

  const targetItem = params.items
    .filter((item) => shouldEditTrackItem({ items: params.items, item, track: referenceTrack }))
    .filter((item) => params.requestedStartSec > item.startSec && params.requestedStartSec < itemEndSec(item))
    .sort((left, right) => left.startSec - right.startSec)[0] ?? null;
  if (!targetItem) return params.requestedStartSec;

  const midpointSec = targetItem.startSec + targetItem.durationSec / 2;
  return snapTimelineValue(params.requestedStartSec < midpointSec ? targetItem.startSec : itemEndSec(targetItem));
}

export function normalizeWorkspaceTimelineStarts(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  const tracks = Array.from(new Set(items.filter((item) => !shouldMirrorLinkedVideo(item, items)).map((item) => item.track)));
  const normalizedById = new Map<string, WorkspaceTimelineItem>();

  tracks.forEach((track) => {
    let startSec = 0;
    items
      .filter((item) => item.track === track && !shouldMirrorLinkedVideo(item, items))
      .forEach((item) => {
        normalizedById.set(item.id, { ...item, startSec });
        startSec += item.durationSec;
      });
  });

  items
    .filter((item) => shouldMirrorLinkedVideo(item, items))
    .forEach((item) => {
      const videoItem = items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
      const normalizedVideoItem = videoItem ? normalizedById.get(videoItem.id) ?? videoItem : null;
      normalizedById.set(item.id, {
        ...item,
        startSec: normalizedVideoItem?.startSec ?? item.startSec,
        durationSec: normalizedVideoItem?.durationSec ?? item.durationSec,
        sourceStartSec: normalizedVideoItem?.sourceStartSec ?? item.sourceStartSec,
        sourceDurationSec: normalizedVideoItem?.sourceDurationSec ?? item.sourceDurationSec,
      });
    });

  return items.map((item) => normalizedById.get(item.id) ?? item);
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
  if (primaryItem.durationSec < MIN_CLIP_DURATION_SEC * 2) return items;

  const splitAt = clampTimelineValue(
    snapTimelineValue(splitOffsetSec ?? primaryItem.durationSec / 2),
    MIN_CLIP_DURATION_SEC,
    primaryItem.durationSec - MIN_CLIP_DURATION_SEC
  );
  if (splitAt <= 0 || splitAt >= primaryItem.durationSec) return items;
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
  const trimBy = Math.max(0, Math.min(primaryItem.durationSec - MIN_CLIP_DURATION_SEC, snapTimelineValue(deltaSec)));
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

export function positionWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  nextStartSec: number,
  nextTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  const targetTrack = nextTrack && isWorkspaceTimelineVideoTrack(primaryItem.track) && isWorkspaceTimelineVideoTrack(nextTrack)
    ? nextTrack
    : primaryItem.track;
  const groupId = primaryItem.linkedGroupId ?? null;
  const groupItems = groupId ? items.filter((candidate) => candidate.linkedGroupId === groupId) : [primaryItem];
  const safeStartSec = snapTimelineValue(Math.max(0, nextStartSec));
  const startDeltaSec = safeStartSec - primaryItem.startSec;
  const primaryCenterSec = safeStartSec + primaryItem.durationSec / 2;
  const trackItems = items
    .filter((candidate) => candidate.track === targetTrack)
    .sort((left, right) => left.startSec - right.startSec);
  const crossedTrackNeighbor = trackItems.some((candidate) => {
    if (candidate.id === primaryItem.id) return false;
    if (safeStartSec >= itemEndSec(candidate) || safeStartSec + primaryItem.durationSec <= candidate.startSec) return false;
    const candidateMidSec = candidate.startSec + candidate.durationSec / 2;
    if (primaryItem.startSec < candidate.startSec) return primaryCenterSec >= candidateMidSec;
    if (primaryItem.startSec > candidate.startSec) return primaryCenterSec <= candidateMidSec;
    return false;
  });

  if (crossedTrackNeighbor) {
    const reorderedItems = trackItems.filter((candidate) => candidate.id !== primaryItem.id);
    const insertionIndex = reorderedItems.findIndex((candidate) => primaryCenterSec < candidate.startSec + candidate.durationSec / 2);
    reorderedItems.splice(insertionIndex < 0 ? reorderedItems.length : insertionIndex, 0, {
      ...primaryItem,
      track: targetTrack,
    });
    const remainingItems = items.filter((candidate) => candidate.id !== primaryItem.id && candidate.track !== targetTrack);
    return normalizeWorkspaceTimelineStarts([...remainingItems, ...reorderedItems]);
  }

  return items.map((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return candidate;
    return {
      ...candidate,
      track: candidate.id === primaryItem.id ? targetTrack : candidate.track,
      startSec: snapTimelineValue(Math.max(0, candidate.startSec + startDeltaSec)),
    };
  });
}

function timelineSelectionKeyForItem(item: WorkspaceTimelineItem): string {
  return item.linkedGroupId ? `group:${item.linkedGroupId}` : `item:${item.id}`;
}

function timelineSelectionKeysForItemIds(items: WorkspaceTimelineItem[], itemIds: string[]): Set<string> {
  const keys = new Set<string>();
  itemIds.forEach((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) keys.add(timelineSelectionKeyForItem(item));
  });
  return keys;
}

function constrainTimelineSelectionDelta(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  selectedItems: WorkspaceTimelineItem[],
  requestedDeltaSec: number
): number {
  let minDeltaSec = Number.NEGATIVE_INFINITY;
  let maxDeltaSec = Number.POSITIVE_INFINITY;

  selectedItems.forEach((selectedItem) => {
    const selectedStartSec = selectedItem.startSec;
    const selectedEndSec = itemEndSec(selectedItem);
    minDeltaSec = Math.max(minDeltaSec, -selectedStartSec);

    items
      .filter((blocker) => blocker.track === selectedItem.track && !selectedKeys.has(timelineSelectionKeyForItem(blocker)))
      .forEach((blocker) => {
        const blockerStartSec = blocker.startSec;
        const blockerEndSec = itemEndSec(blocker);
        if (blockerEndSec <= selectedStartSec) {
          minDeltaSec = Math.max(minDeltaSec, blockerEndSec - selectedStartSec);
          return;
        }
        if (blockerStartSec >= selectedEndSec) {
          maxDeltaSec = Math.min(maxDeltaSec, blockerStartSec - selectedEndSec);
        }
      });
  });

  if (Number.isFinite(minDeltaSec) && Number.isFinite(maxDeltaSec) && minDeltaSec > maxDeltaSec) {
    return snapTimelineValue(requestedDeltaSec >= 0 ? maxDeltaSec : minDeltaSec);
  }

  let safeDeltaSec = requestedDeltaSec;
  if (Number.isFinite(minDeltaSec)) safeDeltaSec = Math.max(safeDeltaSec, minDeltaSec);
  if (Number.isFinite(maxDeltaSec)) safeDeltaSec = Math.min(safeDeltaSec, maxDeltaSec);
  return snapTimelineValue(safeDeltaSec);
}

function timelineSelectionItemsForKeys(items: WorkspaceTimelineItem[], selectedKeys: Set<string>): WorkspaceTimelineItem[] {
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

function retargetTimelineSelectionItems(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  anchorItem: WorkspaceTimelineItem,
  targetTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  if (!targetTrack || selectedKeys.size > 1) return items;
  return items.map((item) => {
    if (isWorkspaceTimelineVideoTrack(item.track) && isWorkspaceTimelineVideoTrack(targetTrack)) {
      return { ...item, track: targetTrack };
    }
    if (
      isWorkspaceTimelineAudioTrack(item.track) &&
      isWorkspaceTimelineAudioTrack(targetTrack) &&
      (item.id === anchorItem.id || !hasLinkedVideoPeer(items, item))
    ) {
      return { ...item, track: targetTrack };
    }
    return item;
  });
}

export function positionWorkspaceTimelineItems(
  items: WorkspaceTimelineItem[],
  itemIds: string[],
  anchorItemId: string,
  nextStartSec: number,
  nextTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  const selectedKeys = timelineSelectionKeysForItemIds(items, itemIds);
  const anchorItem = items.find((candidate) => candidate.id === anchorItemId);
  if (!anchorItem) return items;

  const anchorKey = timelineSelectionKeyForItem(anchorItem);
  if (!selectedKeys.has(anchorKey)) {
    return positionWorkspaceTimelineItem(items, anchorItemId, nextStartSec, nextTrack);
  }
  if (selectedKeys.size <= 1) {
    return positionWorkspaceTimelineItem(items, anchorItemId, nextStartSec, nextTrack);
  }

  const anchorPrimaryItem = primaryTimelineItemFor(items, anchorItem);
  const selectedItems = items.filter((candidate) => selectedKeys.has(timelineSelectionKeyForItem(candidate)));
  const requestedDeltaSec = snapTimelineValue(Math.max(0, nextStartSec) - anchorPrimaryItem.startSec);
  const safeDeltaSec = constrainTimelineSelectionDelta(items, selectedKeys, selectedItems, requestedDeltaSec);
  if (safeDeltaSec === 0) return items;

  return items.map((candidate) => {
    if (!selectedKeys.has(timelineSelectionKeyForItem(candidate))) return candidate;
    return {
      ...candidate,
      startSec: snapTimelineValue(candidate.startSec + safeDeltaSec),
    };
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

  if (params.mode === 'insert' && targetInsideSelection && !targetInsideExternalClip) {
    if (isWorkspaceTimelineVideoTrack(targetTrack)) return params.items;
    return selectedKeys.size > 1
      ? positionWorkspaceTimelineItems(params.items, params.itemIds, params.anchorItemId, params.nextStartSec, params.nextTrack)
      : positionWorkspaceTimelineItem(params.items, params.anchorItemId, params.nextStartSec, params.nextTrack);
  }
  const movedItems = retargetTimelineSelectionItems(selectedItems, selectedKeys, anchorItem, params.nextTrack);
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

export function resizeWorkspaceTimelineItem(params: {
  items: WorkspaceTimelineItem[];
  itemId: string;
  edge: WorkspaceTimelineTrimEdge;
  nextStartSec: number;
  nextDurationSec: number;
  mode?: WorkspaceTimelineTrimMode;
}): WorkspaceTimelineItem[] {
  const item = params.items.find((candidate) => candidate.id === params.itemId);
  if (!item) return params.items;
  const primaryItem = primaryTimelineItemFor(params.items, item);
  const groupId = primaryItem.linkedGroupId ?? null;
  const groupItems = groupId ? params.items.filter((candidate) => candidate.linkedGroupId === groupId) : [primaryItem];
  const { safeDurationSec, safeStartSec, sourceDeltaSec } = resolveResizeTarget({
    item: primaryItem,
    edge: params.edge,
    nextDurationSec: params.nextDurationSec,
  });
  const trimMode = params.mode ?? 'trim';

  if (trimMode === 'ripple') {
    const nextDurationSec = safeDurationSec;
    const durationDeltaSec = snapTimelineValue(nextDurationSec - primaryItem.durationSec);
    const resizedItems = updateGroupItems(params.items, groupItems, (candidate) => ({
      ...candidate,
      startSec: primaryItem.startSec,
      durationSec: nextDurationSec,
      sourceStartSec:
        params.edge === 'start'
          ? clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + sourceDeltaSec, nextDurationSec)
          : candidate.sourceStartSec,
    }));
    const ignoredIds = new Set(groupItems.map((groupItem) => groupItem.id));
    return shiftTrackItemsAfter(resizedItems, primaryItem.track, itemEndSec(primaryItem), durationDeltaSec, ignoredIds);
  }

  if (trimMode === 'roll') {
    const trackItems = primaryTrackItems(params.items, primaryItem.track);
    const neighborItem = params.edge === 'end'
      ? nearestTrackItemAfter(trackItems, primaryItem)
      : nearestTrackItemBefore(trackItems, primaryItem);
    if (!neighborItem) return params.items;

    const neighborGroupItems = neighborItem.linkedGroupId
      ? params.items.filter((candidate) => candidate.linkedGroupId === neighborItem.linkedGroupId)
      : [neighborItem];
    const rawDeltaSec = params.edge === 'end'
      ? safeDurationSec - primaryItem.durationSec
      : safeStartSec - primaryItem.startSec;
    const deltaMinSec = params.edge === 'end'
      ? Math.max(MIN_CLIP_DURATION_SEC - primaryItem.durationSec, -sourceStartForTimelineItem(neighborItem))
      : Math.max(MIN_CLIP_DURATION_SEC - neighborItem.durationSec, -sourceStartForTimelineItem(primaryItem));
    const deltaMaxSec = params.edge === 'end'
      ? Math.min(neighborItem.durationSec - MIN_CLIP_DURATION_SEC, sourceRightRoomForTimelineItem(primaryItem))
      : Math.min(primaryItem.durationSec - MIN_CLIP_DURATION_SEC, sourceRightRoomForTimelineItem(neighborItem));
    const deltaSec = snapTimelineValue(clampTimelineValue(rawDeltaSec, deltaMinSec, deltaMaxSec));
    if (deltaSec === 0) return params.items;

    const primaryGroupIds = new Set(groupItems.map((groupItem) => groupItem.id));
    const neighborGroupIds = new Set(neighborGroupItems.map((groupItem) => groupItem.id));
    return syncLinkedAudioWithVideo(params.items.map((candidate) => {
      if (primaryGroupIds.has(candidate.id)) {
        if (params.edge === 'end') {
          return {
            ...candidate,
            durationSec: snapTimelineValue(candidate.durationSec + deltaSec),
          };
        }
        return {
          ...candidate,
          startSec: snapTimelineValue(candidate.startSec + deltaSec),
          durationSec: snapTimelineValue(candidate.durationSec - deltaSec),
          sourceStartSec: clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + deltaSec, snapTimelineValue(candidate.durationSec - deltaSec)),
        };
      }

      if (neighborGroupIds.has(candidate.id)) {
        if (params.edge === 'end') {
          return {
            ...candidate,
            startSec: snapTimelineValue(candidate.startSec + deltaSec),
            durationSec: snapTimelineValue(candidate.durationSec - deltaSec),
            sourceStartSec: clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + deltaSec, snapTimelineValue(candidate.durationSec - deltaSec)),
          };
        }
        return {
          ...candidate,
          durationSec: snapTimelineValue(candidate.durationSec + deltaSec),
        };
      }

      return candidate;
    }));
  }

  return params.items.map((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return candidate;
    return {
      ...candidate,
      startSec: params.edge === 'start' ? safeStartSec : candidate.startSec,
      durationSec: safeDurationSec,
      sourceStartSec:
        params.edge === 'start'
          ? clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + sourceDeltaSec, safeDurationSec)
          : candidate.sourceStartSec,
    };
  });
}

export function toggleWorkspaceTimelineCrossfade(
  items: WorkspaceTimelineItem[],
  itemId: string,
  durationSec = 1
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  if (!isWorkspaceTimelineVideoTrack(primaryItem.track)) return items;
  const nextItem = nearestTrackItemAfter(items, primaryItem);
  if (!nextItem) return items;
  const safeDurationSec = snapTimelineValue(Math.max(0.25, Math.min(durationSec, primaryItem.durationSec / 2, nextItem.durationSec / 2)));
  const hasSameTransition = primaryItem.transitionOut?.type === 'crossfade' && primaryItem.transitionOut.durationSec === safeDurationSec;
  return items.map((candidate) => {
    if (candidate.id !== primaryItem.id) return candidate;
    return {
      ...candidate,
      transitionOut: hasSameTransition ? null : { type: 'crossfade', durationSec: safeDurationSec },
    };
  });
}

export function workspaceOutputHasTimelineAudio(output: WorkspaceOutputMetadata): boolean {
  return output.kind === 'video' && Boolean(output.hasAudio || output.audioUrl);
}

function workspaceAssetTimelineDuration(asset: WorkspaceAssetRecord): number {
  if (asset.durationSec) return Math.max(MIN_CLIP_DURATION_SEC, asset.durationSec);
  if (asset.kind === 'audio') return 12;
  if (asset.kind === 'video') return 6;
  return 5;
}

export function workspaceAssetHasTimelineAudio(asset: WorkspaceAssetRecord): boolean {
  return asset.kind === 'video';
}

export function buildWorkspaceTimelineItemsForAsset(params: {
  assetNodeId: string;
  title: string;
  asset: WorkspaceAssetRecord;
  startSec: number;
  idSeed?: string;
}): WorkspaceTimelineItem[] {
  if (params.asset.kind === 'text') return [];

  const idSuffix = params.idSeed ?? Date.now().toString(36);
  const baseId = `timeline-${params.assetNodeId}-${idSuffix}`;
  const durationSec = workspaceAssetTimelineDuration(params.asset);
  const sourceDurationSec = durationSec;
  const mediaUrl = params.asset.url ?? params.asset.thumbUrl ?? null;
  const common = {
    outputNodeId: params.assetNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    sourceDurationSec,
    status: 'completed' as const,
  };

  if (params.asset.kind === 'audio') {
    return [
      {
        ...common,
        id: baseId,
        track: 'audio',
        mediaKind: 'audio',
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
    hasEmbeddedAudio: workspaceAssetHasTimelineAudio(params.asset),
    mediaUrl,
    thumbnailUrl: params.asset.thumbUrl ?? mediaUrl,
  };

  if (!workspaceAssetHasTimelineAudio(params.asset)) return [videoItem];

  return [
    videoItem,
    {
      ...common,
      id: `${baseId}-audio`,
      title: `${params.title} Audio`,
      track: 'audio',
      linkedGroupId: baseId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      mediaUrl,
      thumbnailUrl: null,
    },
  ];
}

export function buildWorkspaceTimelineItemsForOutput(params: {
  outputNodeId: string;
  title: string;
  output: WorkspaceOutputMetadata;
  startSec: number;
  idSeed?: string;
}): WorkspaceTimelineItem[] {
  const idSuffix = params.idSeed ?? Date.now().toString(36);
  const baseId = `timeline-${params.outputNodeId}-${idSuffix}`;
  const durationSec = Math.max(MIN_CLIP_DURATION_SEC, params.output.durationSec ?? 5);
  const sourceDurationSec = durationSec;
  const common = {
    outputNodeId: params.outputNodeId,
    title: params.title,
    durationSec,
    startSec: params.startSec,
    sourceStartSec: 0,
    sourceDurationSec,
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
    hasEmbeddedAudio: workspaceOutputHasTimelineAudio(params.output),
    mediaUrl: params.output.url ?? null,
    thumbnailUrl: params.output.thumbUrl ?? params.output.url ?? null,
  };

  if (!workspaceOutputHasTimelineAudio(params.output)) return [videoItem];

  return [
    videoItem,
    {
      ...common,
      id: `${baseId}-audio`,
      title: `${params.title} Audio`,
      track: 'audio',
      linkedGroupId: baseId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      mediaUrl: params.output.audioUrl ?? params.output.url ?? null,
      thumbnailUrl: null,
    },
  ];
}
