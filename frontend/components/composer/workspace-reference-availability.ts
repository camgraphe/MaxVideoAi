import type { AssetFieldConfig, AssetSlotAttachment } from '@/components/AssetDropzone';

export type ReferenceCommandAvailability = {
  addDisabled: boolean;
  canOpen: boolean;
  reasons: string[];
};

/** Derives compact-command state without changing the original field or asset contracts. */
export function getReferenceCommandAvailability(
  entries: AssetFieldConfig[],
  assets: Record<string, (AssetSlotAttachment | null)[]>
): ReferenceCommandAvailability {
  const canAdd = entries.some((entry) => !entry.disabled);
  const hasExistingMedia = entries.some((entry) =>
    (assets[entry.field.id] ?? []).some((asset) => asset != null)
  );
  const reasons = Array.from(new Set(entries.flatMap((entry) => {
    const reason = entry.disabled ? entry.disabledReason?.trim() : '';
    return reason ? [reason] : [];
  })));

  return {
    addDisabled: !canAdd,
    canOpen: canAdd || hasExistingMedia,
    reasons,
  };
}
