import { deriveGenerationAttachmentReferences } from './attachment-references';
import { processGenerationAttachments } from './attachments';
import {
  validateGenerationMediaConstraints,
  type GenerationMediaConstraintValidationResult,
} from './generation-media-constraints';

type GenerationAttachmentProcessingParams = Omit<
  Parameters<typeof deriveGenerationAttachmentReferences>[0],
  'attachments'
> & {
  rawInputs: unknown;
  userId: string;
  mediaConstraintDeps?: Parameters<typeof validateGenerationMediaConstraints>[0]['deps'];
};

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

export async function processAndValidateGenerationAttachments(
  params: GenerationAttachmentProcessingParams
): Promise<GenerationAttachmentProcessingResult> {
  const { rawInputs, userId, mediaConstraintDeps, ...referenceParams } = params;
  const attachmentProcessing = await processGenerationAttachments({ rawInputs, userId });
  if (!attachmentProcessing.ok) {
    return { ...attachmentProcessing, metric: undefined };
  }

  const references = deriveGenerationAttachmentReferences({
    ...referenceParams,
    attachments: attachmentProcessing.attachments,
  });
  const mediaConstraints = await validateGenerationMediaConstraints({
    engineId: params.engineId,
    mode: params.mode,
    userId,
    inputSchema: params.inputSchema,
    attachments: attachmentProcessing.attachments,
    referenceMediaItems: references.referenceMediaItems,
    deps: mediaConstraintDeps,
  });
  if (!mediaConstraints.ok) return mediaConstraints;

  return {
    ok: true,
    attachments: attachmentProcessing.attachments,
    references,
    trustedDurationSecByField: mediaConstraints.trustedDurationSecByField ?? {},
  };
}
