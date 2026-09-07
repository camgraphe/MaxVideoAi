import type { AssetSlotAttachment } from '@/components/AssetDropzone';

/** Compact presentation preserves source indices, including holes in saved drafts. */
export function getWorkspaceReferenceSlots({ assets, maxCount, minCount = 0, limit = Infinity }: {
  assets: (AssetSlotAttachment | null)[]; maxCount: number; minCount?: number; limit?: number;
}) {
  const capacity = Math.max(1, maxCount, minCount);
  const occupied = assets.flatMap((asset, slotIndex) => asset ? [{ asset, slotIndex }] : []);
  const slots: { asset: AssetSlotAttachment | null; slotIndex: number }[] = occupied.slice(0, limit);
  // Never substitute the count for an index: sparse arrays keep their authored role.
  const nextIndex = Array.from({ length: capacity }, (_, index) => index).find((index) => !assets[index]);
  if (nextIndex !== undefined && occupied.length < capacity) slots.push({ asset: null, slotIndex: nextIndex });
  return slots;
}
