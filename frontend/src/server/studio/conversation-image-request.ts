import {isGptImage26EngineId} from '@/lib/image/gptImage26';
import {gptImage26PixelSize,gptImage26SizeMatchesRatio} from '@/lib/image/gptImage26Dimensions';
import type {ImageDraft,ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {conversationSelectionSettings,imageSelectionSchema} from '@/lib/studio/conversation-creation-contract';
import {getDefaultResolution} from '@/lib/image/inputSchema';
import {AgentApiError} from '@/server/agent-api/errors';
import {studioReferenceFingerprint} from '@/server/agent-api/generation-actor';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {GenerationNormalizationError,normalizeGenerationRequest} from '@/server/agent-api/generation-normalization';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';

/** Rebind selected canonical roles to the original reviewed facts, never to a fresh asset read. */
export function imageReferenceFingerprintFromReview(request: Pick<CanonicalGenerationRequest,'references'>, reviewed: readonly ResolvedReference[]): string {
  return studioReferenceFingerprint(request.references.map(reference => {
    const original=reference.kind === 'asset' ? reviewed.find(ref => ref.assetId === reference.assetId && ref.mediaKind === 'image') : undefined;
    if (!original) throw new AgentApiError('REFERENCE_INVALID','Studio has not reviewed this selected image.');
    const facts={...original};
    delete facts.slot;
    return {...facts,role: reference.role,...(reference.slot === undefined ? {} : {slot: reference.slot})};
  }));
}
export function imageRequestFromDraft(
  draft: ImageDraft,
  input: ImageTurnInput,
  catalog: AgentPublicGenerationEngine[],
): CanonicalGenerationRequest {
  if (!draft.image)
    throw new AgentApiError("PARAMETER_INVALID", "No image was requested.");
  const selection = imageSelectionSchema.parse(draft.image);
  const references: CanonicalGenerationRequest['references'] = selection.references == null
    ? input.references.map(assetId => ({kind: 'asset',assetId,role: 'reference'}))
    : selection.references.map(reference => {
      if (reference.ref.type !== 'asset' || !input.references.includes(reference.ref.assetId))
        throw new AgentApiError('REFERENCE_INVALID','Attach this library image before selecting it as a reference.');
      return {kind: 'asset',assetId: reference.ref.assetId,role: reference.role,...(reference.slot == null ? {} : {slot: reference.slot})};
    });
  const mode = selection.mode ?? (references.length ? "i2i" : "t2i");
  const candidate =
    selection.modelId ? catalog.find(entry => entry.engine.id === selection.modelId && entry.publicModes.includes(mode)) : catalog.find(
      (entry) =>
        entry.engine.id === "gpt-image-2-5-flare" &&
        entry.publicModes.includes(mode),
    ) ??
    catalog.find(
      (entry) =>
        entry.engine.id === "gpt-image-2" && entry.publicModes.includes(mode),
    );
  if (!candidate)
    throw new AgentApiError(
      "ENGINE_UNAVAILABLE",
      "The Studio image model is unavailable.",
    );
  const ratio = selection.aspectRatio;
  const selected = conversationSelectionSettings(selection.settings);
  if (selected.aspectRatio !== undefined && selected.aspectRatio !== ratio)
    throw new AgentApiError('PARAMETER_INVALID','Choose one consistent image aspect ratio.');
  const choices: Record<string,string[]>={
    '3:2': ['1536x1024'], '2:3': ['1024x1536'],
    '1:1': ['1024x1024','square_hd'], '16:9': ['landscape_16_9','1920x1080'],
    '9:16': ['portrait_16_9'], '4:3': ['landscape_4_3','1024x768'], '3:4': ['portrait_4_3'],
    auto: [getDefaultResolution(candidate.engine,mode)],
  };
  const allowed =
    candidate.modeCaps[mode]?.resolution ?? candidate.engine.resolutions;
  const details = projectAgentModelModeDetails(candidate,mode);
  const image26 = isGptImage26EngineId(candidate.engine.id);
  // Explicit dimensions describe a custom size. Preserve that saved intent on
  // resume instead of pairing it with an incompatible aspect-ratio preset.
  const hasDimensions = selected.imageWidth !== undefined || selected.imageHeight !== undefined;
  const resolution = selected.resolution
    ?? (hasDimensions && details.resolutions.includes('custom') ? 'custom' : undefined)
    ?? (image26 && ratio !== 'auto' ? allowed.find(value => {
      if (value === 'custom' || value === 'auto') return false;
      const size = gptImage26PixelSize(value);
      return size && gptImage26SizeMatchesRatio(size, ratio);
    }) : undefined)
    ?? choices[ratio]?.find((value) => allowed.includes(value)) ?? details.resolutions[0];
  if (!resolution)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This image format is unavailable.",
    );
  if (image26) {
    let pixels;
    try { pixels = gptImage26PixelSize(String(resolution), hasDimensions ? {width: Number(selected.imageWidth), height: Number(selected.imageHeight)} : undefined); }
    catch { throw new AgentApiError('PARAMETER_INVALID','Choose valid GPT Image 2.6 pixel dimensions.'); }
    if (ratio !== 'auto' && (!pixels || !gptImage26SizeMatchesRatio(pixels, ratio))) throw new AgentApiError('PARAMETER_INVALID','Choose pixel dimensions matching the requested image aspect ratio.');
    delete selected.aspectRatio;
  }
  try {
  const request = normalizeGenerationRequest({
    schemaVersion: 1,
    surface: "image",
    engineId: candidate.engine.id,
    mode,
    prompt: draft.image.prompt,
    settings: {
      ...(!image26 ? {aspectRatio: ratio} : {}),
      resolution,
      ...(details.settings.some(setting => setting.key === 'quality') ? {quality: 'high'} : {}),
      ...(details.settings.some(setting => setting.key === 'outputFormat') ? {outputFormat: 'png'} : {}),
      ...selected,
    },
    references,
    outputCount: 1,
  });
  validateCanonicalGenerationCapabilities(request,candidate);
  return request;
  } catch (error) {
    if (error instanceof GenerationNormalizationError)
      throw new AgentApiError(error.field.startsWith('references') ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID',error.message);
    if (error instanceof GenerationCapabilityError)
      throw new AgentApiError(error.kind === 'reference_required' ? 'REFERENCE_REQUIRED' : error.kind === 'reference_invalid' ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID',`${error.field} is not supported for the selected model and mode.`);
    throw error;
  }
}
