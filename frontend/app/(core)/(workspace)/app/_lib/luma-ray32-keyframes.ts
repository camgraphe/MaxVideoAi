export const DEFAULT_VISIBLE_KEYFRAME_COUNT = 4;
export const EMPTY_KEYFRAME_SLOT_VALUE = '__empty__';

export type KeyframeSlot = {
  assetSlot: number;
  frameIndex: number;
};

export function clampFrameIndex(value: number, maxFrameIndex: number): number {
  return Math.max(0, Math.min(maxFrameIndex, Math.trunc(value)));
}

export function findNearestUnusedFrameIndex(
  requestedFrameIndex: number,
  usedFrameIndexes: Set<number>,
  maxFrameIndex: number
): number | null {
  const preferredFrameIndex = clampFrameIndex(requestedFrameIndex, maxFrameIndex);
  if (!usedFrameIndexes.has(preferredFrameIndex)) return preferredFrameIndex;
  for (let offset = 1; offset <= maxFrameIndex; offset += 1) {
    const lower = preferredFrameIndex - offset;
    if (lower >= 0 && !usedFrameIndexes.has(lower)) return lower;
    const upper = preferredFrameIndex + offset;
    if (upper <= maxFrameIndex && !usedFrameIndexes.has(upper)) return upper;
  }
  return null;
}

export function getUniqueFrameIndexForSlot(
  slots: KeyframeSlot[],
  assetSlot: number,
  requestedFrameIndex: number,
  maxFrameIndex: number
): number | null {
  const usedFrameIndexes = new Set(
    slots.filter((slot) => slot.assetSlot !== assetSlot).map((slot) => slot.frameIndex)
  );
  return findNearestUnusedFrameIndex(requestedFrameIndex, usedFrameIndexes, maxFrameIndex);
}

export function defaultFrameIndexes(slotCount: number, maxFrameIndex: number): number[] {
  if (slotCount <= 1) return [0];
  return Array.from({ length: slotCount }, (_, index) =>
    clampFrameIndex(Math.round((maxFrameIndex * index) / (slotCount - 1)), maxFrameIndex)
  );
}

export function normalizeKeyframeSlots(slots: KeyframeSlot[], maxSlots: number, maxFrameIndex: number): KeyframeSlot[] {
  const seen = new Set<number>();
  const usedFrameIndexes = new Set<number>();
  const normalized: KeyframeSlot[] = [];
  slots.forEach((slot) => {
    if (!Number.isFinite(slot.assetSlot) || !Number.isFinite(slot.frameIndex)) return;
    const assetSlot = Math.trunc(slot.assetSlot);
    if (assetSlot < 0 || assetSlot >= maxSlots || seen.has(assetSlot)) return;
    const frameIndex = findNearestUnusedFrameIndex(slot.frameIndex, usedFrameIndexes, maxFrameIndex);
    if (frameIndex == null) return;
    seen.add(assetSlot);
    usedFrameIndexes.add(frameIndex);
    normalized.push({
      assetSlot,
      frameIndex,
    });
  });
  return normalized;
}

export function getOccupiedAssetSlots(assets: readonly unknown[], maxSlots: number): number[] {
  return assets
    .map((asset, index) => (asset && index < maxSlots ? index : -1))
    .filter((index) => index >= 0);
}

export function initialKeyframeSlots(
  assets: readonly unknown[],
  maxSlots: number,
  maxFrameIndex: number
): KeyframeSlot[] {
  const occupiedSlots = getOccupiedAssetSlots(assets, maxSlots);
  const initialCount = Math.min(
    maxSlots,
    Math.max(
      DEFAULT_VISIBLE_KEYFRAME_COUNT,
      occupiedSlots.length ? Math.max(...occupiedSlots) + 1 : DEFAULT_VISIBLE_KEYFRAME_COUNT
    )
  );
  return defaultFrameIndexes(initialCount, maxFrameIndex).map((frameIndex, assetSlot) => ({
    assetSlot,
    frameIndex,
  }));
}

export function parseKeyframeSlots(
  value: unknown,
  assets: readonly unknown[],
  maxSlots: number,
  maxFrameIndex: number
): KeyframeSlot[] {
  const occupiedSlots = getOccupiedAssetSlots(assets, maxSlots);
  if (value === EMPTY_KEYFRAME_SLOT_VALUE && occupiedSlots.length === 0) {
    return [];
  }
  if (typeof value !== 'string' || !value.trim()) {
    return initialKeyframeSlots(assets, maxSlots, maxFrameIndex);
  }
  if (value.trim() === EMPTY_KEYFRAME_SLOT_VALUE && occupiedSlots.length === 0) {
    return [];
  }

  const parts = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const hasSlotPairs = parts.some((entry) => entry.includes(':'));
  const parsed = hasSlotPairs
    ? parts.map((entry) => {
        const [slotRaw, frameRaw] = entry.split(':');
        return {
          assetSlot: Number(slotRaw),
          frameIndex: Number(frameRaw),
        };
      })
    : parts.map((entry, index) => ({
        assetSlot: index,
        frameIndex: Number(entry),
      }));

  const normalized = normalizeKeyframeSlots(parsed, maxSlots, maxFrameIndex);
  if (!normalized.length) {
    return occupiedSlots.length ? initialKeyframeSlots(assets, maxSlots, maxFrameIndex) : [];
  }

  const slotsByAsset = new Set(normalized.map((slot) => slot.assetSlot));
  const withOccupiedSlots = [...normalized];
  occupiedSlots.forEach((assetSlot) => {
    if (slotsByAsset.has(assetSlot)) return;
    const fallbackIndexes = defaultFrameIndexes(maxSlots, maxFrameIndex);
    withOccupiedSlots.push({
      assetSlot,
      frameIndex: fallbackIndexes[assetSlot] ?? maxFrameIndex,
    });
    slotsByAsset.add(assetSlot);
  });

  const targetSlotCount = occupiedSlots.length
    ? Math.min(maxSlots, Math.max(normalized.length, Math.max(...occupiedSlots) + 1))
    : normalized.length;
  while (withOccupiedSlots.length < targetSlotCount) {
    const assetSlot = findFirstUnusedAssetSlot(withOccupiedSlots, maxSlots);
    if (assetSlot == null) break;
    withOccupiedSlots.push({
      assetSlot,
      frameIndex: findBestNewFrameIndex(withOccupiedSlots, maxFrameIndex),
    });
  }

  return normalizeKeyframeSlots(withOccupiedSlots, maxSlots, maxFrameIndex);
}

export function formatKeyframeSlots(slots: KeyframeSlot[]): string {
  if (!slots.length) return EMPTY_KEYFRAME_SLOT_VALUE;
  return slots.map((slot) => `${slot.assetSlot}:${slot.frameIndex}`).join(', ');
}

export function getPayloadIndexes(slots: KeyframeSlot[], assets: readonly unknown[]): number[] {
  const frameByAssetSlot = new Map(slots.map((slot) => [slot.assetSlot, slot.frameIndex]));
  return assets.reduce<number[]>((indexes, asset, assetSlot) => {
    const frameIndex = frameByAssetSlot.get(assetSlot);
    if (asset && typeof frameIndex === 'number') {
      indexes.push(frameIndex);
    }
    return indexes;
  }, []);
}

export function formatIndexes(indexes: number[]): string {
  return indexes.join(', ');
}

export function formatFramecode(frameIndex: number, fps: number): string {
  const safeFps = Math.max(1, Math.trunc(fps));
  const seconds = Math.floor(frameIndex / safeFps);
  const frame = frameIndex % safeFps;
  return `${seconds}:${String(frame).padStart(2, '0')}`;
}

export function getTimelineLeft(frameIndex: number, maxFrameIndex: number): string {
  const ratio = maxFrameIndex > 0 ? frameIndex / maxFrameIndex : 0;
  return `${10 + ratio * 80}%`;
}

export function getFrameIndexFromClientX(clientX: number, rect: DOMRect, maxFrameIndex: number): number {
  const usableLeft = rect.left + rect.width * 0.1;
  const usableWidth = rect.width * 0.8;
  const ratio = usableWidth > 0 ? (clientX - usableLeft) / usableWidth : 0;
  return clampFrameIndex(Math.round(Math.max(0, Math.min(1, ratio)) * maxFrameIndex), maxFrameIndex);
}

export function findFirstUnusedAssetSlot(slots: KeyframeSlot[], maxSlots: number): number | null {
  const usedSlots = new Set(slots.map((slot) => slot.assetSlot));
  for (let index = 0; index < maxSlots; index += 1) {
    if (!usedSlots.has(index)) return index;
  }
  return null;
}

export function findBestNewFrameIndex(slots: KeyframeSlot[], maxFrameIndex: number): number {
  if (!slots.length) return 0;
  const sortedFrames = Array.from(new Set(slots.map((slot) => slot.frameIndex))).sort((left, right) => left - right);
  let bestStart = sortedFrames[0] >= maxFrameIndex / 2 ? 0 : sortedFrames[0];
  let bestEnd = sortedFrames[0] >= maxFrameIndex / 2 ? sortedFrames[0] : maxFrameIndex;
  let bestGap = Math.abs(bestEnd - bestStart);

  for (let index = 0; index < sortedFrames.length - 1; index += 1) {
    const start = sortedFrames[index] ?? 0;
    const end = sortedFrames[index + 1] ?? maxFrameIndex;
    const gap = end - start;
    if (gap > bestGap) {
      bestGap = gap;
      bestStart = start;
      bestEnd = end;
    }
  }

  const midpoint = Math.round((bestStart + bestEnd) / 2);
  if (!sortedFrames.includes(midpoint)) return clampFrameIndex(midpoint, maxFrameIndex);
  for (let offset = 1; offset <= maxFrameIndex; offset += 1) {
    const lower = clampFrameIndex(midpoint - offset, maxFrameIndex);
    if (!sortedFrames.includes(lower)) return lower;
    const upper = clampFrameIndex(midpoint + offset, maxFrameIndex);
    if (!sortedFrames.includes(upper)) return upper;
  }
  return clampFrameIndex(midpoint, maxFrameIndex);
}
