import type { CharacterReferenceSelection } from '@/types/image-generation';
import type {
  PersistedReferenceSlot,
  ReferenceSlotValue,
} from './image-workspace-types';

export function cleanupSlotPreview(slot: ReferenceSlotValue | null) {
  if (slot?.previewUrl && slot.previewUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(slot.previewUrl);
    } catch {}
  }
}

export function getReadyReferenceSlots(slots: (ReferenceSlotValue | null)[]): ReferenceSlotValue[] {
  return slots.filter((slot): slot is ReferenceSlotValue => Boolean(slot && slot.status === 'ready'));
}

export function getReferenceSizeSignature(slots: (ReferenceSlotValue | null)[]): string {
  return getReadyReferenceSlots(slots)
    .map((slot) => `${slot.width ?? ''}x${slot.height ?? ''}`)
    .join('|');
}

export function getSelectedCharacterReferences(
  slots: (ReferenceSlotValue | null)[]
): CharacterReferenceSelection[] {
  return slots.reduce<CharacterReferenceSelection[]>((acc, slot) => {
    if (slot?.characterReference) {
      acc.push(slot.characterReference);
    }
    return acc;
  }, []);
}

export function countRegularReferenceSelections(slots: (ReferenceSlotValue | null)[]): number {
  return slots.filter((slot) => Boolean(slot && !slot.characterReference)).length;
}

export function buildPersistableReferenceSlots(
  slots: (ReferenceSlotValue | null)[]
): PersistedReferenceSlot[] {
  return slots.map((slot) => {
    if (!slot || slot.status !== 'ready') return null;
    const url = slot.url?.trim?.() ?? '';
    if (!url || url.startsWith('blob:')) return null;
    return {
      url,
      source: slot.source,
      width: slot.width ?? null,
      height: slot.height ?? null,
      characterReference: slot.characterReference
        ? {
            id: slot.characterReference.id,
            jobId: slot.characterReference.jobId,
            imageUrl: slot.characterReference.imageUrl,
            thumbUrl: slot.characterReference.thumbUrl ?? null,
            prompt: slot.characterReference.prompt ?? null,
            createdAt: slot.characterReference.createdAt ?? null,
            engineLabel: slot.characterReference.engineLabel ?? null,
            outputMode: slot.characterReference.outputMode ?? null,
            action: slot.characterReference.action ?? null,
          }
        : null,
    };
  });
}
