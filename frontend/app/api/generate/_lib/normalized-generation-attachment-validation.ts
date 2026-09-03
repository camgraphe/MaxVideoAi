import { deriveGenerationAttachmentReferences } from './attachment-references';
import type { NormalizedAttachment } from './generation-attachment-types';
import {
  validateGenerationMediaConstraints,
  type GenerationMediaConstraintValidationResult,
} from './generation-media-constraints';
import type { ResolvedReference } from '@/server/agent-api/reference-types';

export type NormalizedGenerationAttachmentValidationParams = Omit<
  Parameters<typeof deriveGenerationAttachmentReferences>[0],
  'attachments'
> & {
  attachments: NormalizedAttachment[];
  userId: string;
  mediaConstraintDeps?: Parameters<typeof validateGenerationMediaConstraints>[0]['deps'];
  trustedResolvedReferences?: readonly ResolvedReference[];
};

type MediaConstraintFailure = Extract<
  GenerationMediaConstraintValidationResult,
  { ok: false }
>;

export type NormalizedGenerationAttachmentValidationResult =
  | {
      ok: true;
      attachments: NormalizedAttachment[];
      references: ReturnType<typeof deriveGenerationAttachmentReferences>;
      trustedDurationSecByField: Record<string, number[]>;
    }
  | MediaConstraintFailure;

export async function validateNormalizedGenerationAttachments(
  params: NormalizedGenerationAttachmentValidationParams,
): Promise<NormalizedGenerationAttachmentValidationResult> {
  const { attachments, userId, mediaConstraintDeps, trustedResolvedReferences, ...referenceParams } = params;
  const references = deriveGenerationAttachmentReferences({
    ...referenceParams,
    attachments,
  });
  const mediaConstraints = await validateGenerationMediaConstraints({
    engineId: params.engineId,
    mode: params.mode,
    userId,
    inputSchema: params.inputSchema,
    attachments,
    referenceMediaItems: references.referenceMediaItems,
    trustedResolvedReferences,
    deps: mediaConstraintDeps,
  });
  if (!mediaConstraints.ok) return mediaConstraints;

  return {
    ok: true,
    attachments,
    references,
    trustedDurationSecByField: mediaConstraints.trustedDurationSecByField ?? {},
  };
}
