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
  })[];
  pending: { requestId: string; attachments?: MiloAttachment[] } | null;
};
export type MiloMediaRead = MiloAttachment &
  ({ state: 'unavailable' } | { state: 'ready'; name?: string; thumbnail?: string; original?: string });

/** A conversation marker carries no user filename, asset identity or URL. */
export function miloAttachments(
  references: PromptAssistanceRequest['draft']['references'],
): MiloAttachment[] {
  return references.flatMap(({ fieldId, slot, ref }) => (ref ? [{ fieldId, slot, kind: ref.kind }] : []));
}
