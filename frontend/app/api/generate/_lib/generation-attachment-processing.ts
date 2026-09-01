import { deriveGenerationAttachmentReferences } from './attachment-references';
import { processGenerationAttachments, type NormalizedAttachment } from './attachments';
import {
  validateGenerationMediaConstraints,
  type GenerationMediaConstraintValidationResult,
} from './generation-media-constraints';

type NormalizedGenerationAttachmentValidationParams = Omit<
  Parameters<typeof deriveGenerationAttachmentReferences>[0],
  'attachments'
> & {
  attachments: NormalizedAttachment[];
  userId: string;
  mediaConstraintDeps?: Parameters<typeof validateGenerationMediaConstraints>[0]['deps'];
};

type GenerationAttachmentProcessingParams = Omit<
  NormalizedGenerationAttachmentValidationParams,
  'attachments'
> & { rawInputs: unknown };

type AttachmentProcessingFailure = Extract<
  Awaited<ReturnType<typeof processGenerationAttachments>>,
  { ok: false }
> & { metric?: undefined };

type MediaConstraintFailure = Extract<
  GenerationMediaConstraintValidationResult,
  { ok: false }
>;

type GenerationAttachmentProcessingResult =
  | {
      ok: true;
      attachments: Extract<
        Awaited<ReturnType<typeof processGenerationAttachments>>,
        { ok: true }
      >['attachments'];
      references: ReturnType<typeof deriveGenerationAttachmentReferences>;
      trustedDurationSecByField: Record<string, number[]>;
    }
  | AttachmentProcessingFailure
  | MediaConstraintFailure;

export async function validateNormalizedGenerationAttachments(
  params: NormalizedGenerationAttachmentValidationParams,
): Promise<Exclude<GenerationAttachmentProcessingResult, AttachmentProcessingFailure>> {
  const { attachments, userId, mediaConstraintDeps, ...referenceParams } = params;
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

export async function processAndValidateGenerationAttachments(
  params: GenerationAttachmentProcessingParams
): Promise<GenerationAttachmentProcessingResult> {
  const { rawInputs, userId, mediaConstraintDeps, ...referenceParams } = params;
  const attachmentProcessing = await processGenerationAttachments({ rawInputs, userId });
  if (!attachmentProcessing.ok) {
    return { ...attachmentProcessing, metric: undefined };
  }

  return validateNormalizedGenerationAttachments({
    ...referenceParams,
    userId,
    attachments: attachmentProcessing.attachments,
    mediaConstraintDeps,
  });
}
