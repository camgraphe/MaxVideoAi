import type { PromptAssistanceRequest, PromptReferenceLocation } from '@/lib/prompt-assistance/contract';
import { resolveStudioMedia } from '@/server/studio/media-resolver';

type SubmittedReference = PromptAssistanceRequest['draft']['references'][number];

export class UnavailablePromptReference extends Error {
  readonly location: PromptReferenceLocation;

  constructor(code: 'REFERENCE_REATTACH_REQUIRED' | 'MEDIA_NOT_AVAILABLE', reference: PromptReferenceLocation) {
    super(code);
    this.location = { fieldId: reference.fieldId, slot: reference.slot };
  }
}

/** Only the originating composer slot travels with a media access failure. */
export async function resolvePromptReference(
  userId: string,
  reference: SubmittedReference,
  resolve: typeof resolveStudioMedia = resolveStudioMedia,
) {
  if (!reference.ref) throw new UnavailablePromptReference('REFERENCE_REATTACH_REQUIRED', reference);
  try {
    const media = await resolve(userId, reference.ref);
    if (media.kind !== reference.ref.kind) throw new Error('REFERENCE_INVALID');
    return media;
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE') {
      throw new UnavailablePromptReference('MEDIA_NOT_AVAILABLE', reference);
    }
    throw error;
  }
}
