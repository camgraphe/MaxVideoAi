type VisibleAssetSlotCountOptions = {
  maxCount?: number;
  minCount?: number;
  filledCount: number;
  initialVisibleCount?: number;
};

type VisibleAssetSlotsOptions<T> = {
  assets: Array<T | null | undefined>;
  maxCount?: number;
  minCount?: number;
  initialVisibleCount?: number;
};

export function getVisibleAssetSlotCount({
  maxCount = 0,
  minCount = 0,
  filledCount,
  initialVisibleCount = 3,
}: VisibleAssetSlotCountOptions): number {
  const safeFilledCount = Math.max(0, filledCount);
  const safeMinCount = Math.max(0, minCount);

  if (maxCount > 1) {
    const clampedMax = Math.max(1, maxCount);
    const initialVisible = Math.min(clampedMax, Math.max(safeMinCount, initialVisibleCount));
    const revealedCount =
      safeFilledCount >= initialVisible ? Math.min(clampedMax, safeFilledCount + 1) : initialVisible;
    return Math.max(1, revealedCount);
  }

  if (maxCount > 0) {
    return maxCount;
  }

  return Math.max(safeMinCount, safeFilledCount + 1, 1);
}

export function getVisibleAssetSlots<T>({
  assets,
  maxCount = 0,
  minCount = 0,
  initialVisibleCount = 3,
}: VisibleAssetSlotsOptions<T>): Array<{ asset: T | null; slotIndex: number }> {
  const filledCount = assets.filter((asset) => asset != null).length;
  const slotCount = getVisibleAssetSlotCount({
    maxCount,
    minCount,
    filledCount,
    initialVisibleCount,
  });

  if (maxCount > 1) {
    const highestFilledIndex = assets.reduce((highest, asset, index) => (asset != null ? index : highest), -1);
    const visibleCount = Math.min(maxCount, Math.max(slotCount, highestFilledIndex + 1, 1));
    return Array.from({ length: visibleCount }, (_, slotIndex) => ({
      asset: assets[slotIndex] ?? null,
      slotIndex,
    }));
  }

  const visibleCount = Math.max(slotCount, 1);
  return Array.from({ length: visibleCount }, (_, slotIndex) => ({
    asset: assets[slotIndex] ?? null,
    slotIndex,
  }));
}
