type VisibleAssetSlotCountOptions = {
  maxCount?: number;
  minCount?: number;
  filledCount: number;
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
