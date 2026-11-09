import { canonicalMediaAssetFields } from '@/lib/media-identity';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import type { CharacterReferenceSelection } from '@/types/image-generation';
import type {
  PersistedReferenceSlot,
  ReferenceSlotValue,
} from './image-workspace-types';

/** Preserve an explicit owned-media identity; URLs and local/legacy card IDs are not proof. */
export function imageReferenceIdentity(value:{ref?:unknown;assetId?:unknown}):ToolAssetRef|undefined {
  if(value.ref!==undefined){
    const parsed=toolAssetRefSchema.safeParse(value.ref);
    if(!parsed.success||parsed.data.kind!=='image')return undefined;
    return parsed.data.type==='asset'?canonicalMediaAssetFields(parsed.data.assetId,'image').ref:parsed.data;
  }
  return canonicalMediaAssetFields(value.assetId,'image').ref;
}

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
      readAccessOwnerId: slot.readAccessOwnerId, readAccessRef: slot.readAccessRef, readAccessRevision: slot.readAccessRevision,
      url,
      name: slot.name?.trim() || undefined,
      ref: imageReferenceIdentity(slot),
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
