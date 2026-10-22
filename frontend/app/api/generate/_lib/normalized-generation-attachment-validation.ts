import type { MinimaxH3MaxPricingReference } from '@/lib/minimax-h3-max-pricing';
import { deriveGenerationAttachmentReferences } from './attachment-references';
import type { NormalizedAttachment } from './generation-attachment-types';
import {
  validateGenerationMediaConstraints,
  type GenerationMediaConstraintValidationResult,
} from './generation-media-constraints';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import { validateKlingV4OwnedMedia } from './kling-v4-owned-media';

export type NormalizedGenerationAttachmentValidationParams = Omit<
  Parameters<typeof deriveGenerationAttachmentReferences>[0],
  'attachments'
> & {
  attachments: NormalizedAttachment[];
  userId: string;
  mediaConstraintDeps?: Parameters<typeof validateGenerationMediaConstraints>[0]['deps'];
  trustedResolvedReferences?: readonly ResolvedReference[];
  elements?: readonly MaxVideoProviderElement[];
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
  const { attachments, userId, mediaConstraintDeps, trustedResolvedReferences, elements, ...referenceParams } = params;
  const references = deriveGenerationAttachmentReferences({
    ...referenceParams,
    attachments,
  });
  if (params.engineId === 'kling-v4') {
    const directImages: Array<[string, unknown]> = [
      ['image_url', params.imageUrl], ['image_url', params.image_url],
      ['end_image_url', params.endImageUrl],
      ...[params.referenceImages, params.reference_images].flatMap(values => Array.isArray(values)
        ? values.map(value => ['image_urls', value] as [string, unknown]) : []),
    ];
    const conflicting = directImages.some(([slotId, value]) => typeof value === 'string' && value.trim()
      && !attachments.some(a => a.kind === 'image' && a.slotId === slotId && a.url?.trim() === value.trim()));
    if (conflicting || references.referenceProvenanceIssues.length) {
      return { ok: false, status: 422,
        body: { ok: false, error: 'MEDIA_METADATA_UNVERIFIED', field: 'references', message: 'Each Kling 4 reference must match an owned original in its selected role.' },
        metric: { errorCode: 'MEDIA_METADATA_UNVERIFIED', meta: { field: 'references' } } };
    }
  }
  const mediaConstraints = params.engineId === 'kling-v4'
    ? await validateKlingV4OwnedMedia({ mode: params.mode, userId, attachments, elements,
      referenceMediaItems: references.referenceMediaItems, trustedResolvedReferences, deps: mediaConstraintDeps })
    : await validateGenerationMediaConstraints({
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
