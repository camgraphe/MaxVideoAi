import { processGenerationAttachments } from './attachments';
import {
  validateNormalizedGenerationAttachments,
  type NormalizedGenerationAttachmentValidationParams,
  type NormalizedGenerationAttachmentValidationResult,
} from './normalized-generation-attachment-validation';

type GenerationAttachmentProcessingParams = Omit<
  NormalizedGenerationAttachmentValidationParams,
  'attachments'
> & { rawInputs: unknown };

type AttachmentProcessingFailure = Extract<
  Awaited<ReturnType<typeof processGenerationAttachments>>,
  { ok: false }
> & { metric?: undefined };

type GenerationAttachmentProcessingResult =
  | NormalizedGenerationAttachmentValidationResult
  | AttachmentProcessingFailure;

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
