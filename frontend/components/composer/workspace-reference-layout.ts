import type { AssetFieldConfig, AssetSlotAttachment } from '@/components/AssetDropzone';

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

export function isWorkspaceFrameField({ field, role }: AssetFieldConfig) {
  return field.type === 'image' && (field.maxCount ?? 1) <= 1 && (role === 'frame' || role === 'primary' || ['image_url', 'end_image_url', 'start_image', 'end_image'].includes(field.id));
}

export function getWorkspaceReferenceSummary(fields: AssetFieldConfig[], assets: Record<string, (AssetSlotAttachment | null)[]>, limit = 3) {
  let remaining = limit;
  return fields.flatMap((entry) => {
    const count = (assets[entry.field.id] ?? []).filter(Boolean).length;
    const visibleCount = Math.min(entry.required || isWorkspaceFrameField(entry) ? Math.max(1, remaining) : remaining, count);
    remaining = Math.max(0, remaining - visibleCount);
    return visibleCount || entry.required || isWorkspaceFrameField(entry) ? [{ entry, visibleCount }] : [];
  });
}
