import type { CharacterReferenceSelection } from '@/types/image-generation';
import type {
  PersistedCharacterReference,
  ReferenceSlotValue,
} from './image-workspace-types';

export function getCharacterReferenceLabel(reference: CharacterReferenceSelection): string {
  if (reference.action === 'lighting-variant') return 'Lighting variant';
  if (reference.action === 'full-body-fix') return 'Full-body fix';
  if (reference.outputMode === 'character-sheet') return 'Character sheet';
  return 'Portrait reference';
}

export function formatCharacterReferenceDate(value?: string | null): string {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function parseCharacterReferenceEntry(entry: unknown): PersistedCharacterReference | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Partial<CharacterReferenceSelection>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return null;
  return {
    id,
    jobId,
    imageUrl,
    thumbUrl: typeof record.thumbUrl === 'string' ? record.thumbUrl : null,
    prompt: typeof record.prompt === 'string' ? record.prompt : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    engineLabel: typeof record.engineLabel === 'string' ? record.engineLabel : null,
    outputMode:
      record.outputMode === 'portrait-reference' || record.outputMode === 'character-sheet'
        ? record.outputMode
        : null,
    action:
      record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
        ? record.action
        : null,
  };
}

export function createCharacterReferenceSlot(
  reference: CharacterReferenceSelection,
  idPrefix = 'character'
): ReferenceSlotValue {
  return {
    id: `${idPrefix}-${reference.id}`,
    url: reference.imageUrl,
    previewUrl: reference.thumbUrl ?? reference.imageUrl,
    name: getCharacterReferenceLabel(reference),
    status: 'ready',
    source: 'character',
    characterReference: reference,
  };
}

export function mergeCharacterReferencesIntoSlots(
  slots: Array<ReferenceSlotValue | null>,
  references: CharacterReferenceSelection[],
  limit: number
): Array<ReferenceSlotValue | null> {
  if (!references.length || limit <= 0) return slots;
  const next = slots.slice();
  references.forEach((reference) => {
    if (next.some((slot) => slot?.characterReference?.id === reference.id)) {
      return;
    }
    const existingUrlIndex = next.findIndex((slot) => slot?.url === reference.imageUrl);
    if (existingUrlIndex >= 0) {
      next[existingUrlIndex] = {
        ...(next[existingUrlIndex] as ReferenceSlotValue),
        source: 'character',
        characterReference: reference,
        name: getCharacterReferenceLabel(reference),
        previewUrl: next[existingUrlIndex]?.previewUrl ?? reference.thumbUrl ?? reference.imageUrl,
      };
      return;
    }
    const emptyIndex = next.slice(0, limit).findIndex((slot) => slot === null);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : -1;
    if (targetIndex >= 0) {
      next[targetIndex] = createCharacterReferenceSlot(reference);
    }
  });
  return next;
}
