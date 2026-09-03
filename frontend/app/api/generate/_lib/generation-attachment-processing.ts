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
  | AttachmentProcessingFailure
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: 'OWNED_MEDIA_REQUIRED';
        message: string;
      };
      metric?: undefined;
    };

function modeRequiresOwnedMedia(params: GenerationAttachmentProcessingParams): boolean {
  const modes = params.inputSchema?.constraints?.ownedAssetModes;
  return Array.isArray(modes) && modes.includes(params.mode);
}

export async function processAndValidateGenerationAttachments(
  params: GenerationAttachmentProcessingParams
): Promise<GenerationAttachmentProcessingResult> {
  const { rawInputs, userId, mediaConstraintDeps, ...referenceParams } = params;
  const attachmentProcessing = await processGenerationAttachments({ rawInputs, userId });
  if (!attachmentProcessing.ok) {
    return { ...attachmentProcessing, metric: undefined };
  }
  if (
    modeRequiresOwnedMedia(params)
    && attachmentProcessing.attachments.some((attachment) => attachment.url && !attachment.assetId)
  ) {
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'OWNED_MEDIA_REQUIRED',
        message: 'This mode requires media saved in your MaxVideoAI library.',
      },
      metric: undefined,
    };
  }

  return validateNormalizedGenerationAttachments({
    ...referenceParams,
    userId,
    attachments: attachmentProcessing.attachments,
    mediaConstraintDeps,
  });
}
