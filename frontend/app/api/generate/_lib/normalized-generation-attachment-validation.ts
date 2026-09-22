import type { MinimaxH3MaxPricingReference } from '@/lib/minimax-h3-max-pricing';
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
      trustedMediaReferences?: MinimaxH3MaxPricingReference[];
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

  const trustedMediaByUrl = new Map((mediaConstraints.trustedMediaReferences ?? []).map((reference) =>
    [`${reference.kind}:${reference.url}`, reference]));
  const validatedAttachments = attachments.map((attachment) => {
    const trusted = trustedMediaByUrl.get(`${attachment.kind}:${attachment.url?.trim()}`);
    if (!trusted) return attachment;
    return {
      ...attachment,
      width: trusted.width ?? undefined,
      height: trusted.height ?? undefined,
      durationSec: trusted.durationSec ?? undefined,
    };
  });

  return {
    ok: true,
    attachments: validatedAttachments,
    references,
    trustedDurationSecByField: mediaConstraints.trustedDurationSecByField ?? {},
    trustedMediaReferences: mediaConstraints.trustedMediaReferences ?? [],
  };
}
