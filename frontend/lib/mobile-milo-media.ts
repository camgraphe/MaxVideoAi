import type { PromptAssistanceRequest } from '../src/lib/prompt-assistance/contract';
import type { PromptSessionSnapshot } from '../src/lib/prompt-assistance/session';

export const MILO_MEDIA_PAGE_SIZE = 3;

export type MiloAttachment = {
  fieldId: string;
  slot: number;
  kind: 'image' | 'video' | 'audio';
};
export type MobileMiloSession = Omit<PromptSessionSnapshot, 'turns' | 'pending'> & {
  turns: (PromptSessionSnapshot['turns'][number] & {
    attachments?: MiloAttachment[];
    addedAttachmentIndexes?: number[];
  })[];
  pending: { requestId: string; attachments?: MiloAttachment[]; addedAttachmentIndexes?: number[] } | null;
};
export type MiloMediaRead = MiloAttachment &
  ({ state: 'unavailable' } | { state: 'ready'; name?: string; thumbnail?: string; original?: string });

/** A conversation marker carries no user filename, asset identity or URL. */
export function miloAttachments(
  references: PromptAssistanceRequest['draft']['references'],
): MiloAttachment[] {
  return references.flatMap(({ fieldId, slot, ref }) => (ref ? [{ fieldId, slot, kind: ref.kind }] : []));
}

/** Match a source at its submitted location, independently of labels and object property order. */
export function miloAttachmentKeys(references: PromptAssistanceRequest['draft']['references']): string[] {
  return references.flatMap(({ fieldId, slot, ref }) => ref ? [JSON.stringify([
    fieldId, slot, ref.kind, ref.type, ...(ref.type === 'asset' ? [ref.assetId] : [ref.jobId, ref.outputId]),
  ])] : []);
}

export function addedAttachmentIndexes(previous: readonly string[], current: readonly string[]): number[] {
  const seen = new Set(previous);
  return current.flatMap((key, index) => seen.has(key) ? [] : [index]);
}
