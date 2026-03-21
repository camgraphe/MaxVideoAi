import { randomUUID } from 'crypto';
import {
  getAccessoryPrompt,
  getDefaultResolution,
  getDistinctiveFeaturePrompt,
  getQualityEngineId,
  getRealismPrompt,
  getTraitOptionPrompt,
} from '@/lib/character-builder';
import { executeImageGeneration, ImageGenerationExecutionError } from '@/server/images/execute-image-generation';
import type {
  CharacterBuilderAction,
  CharacterBuilderConsistencyMode,
  CharacterBuilderOutputMode,
  CharacterBuilderQualityMode,
  CharacterBuilderReferenceImage,
  CharacterBuilderReferenceStrength,
  CharacterBuilderRequest,
  CharacterBuilderResponse,
  CharacterBuilderResult,
  CharacterBuilderRun,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderTraits,
  CharacterBuilderTraitSource,
  TraitValue,
} from '@/types/character-builder';

export class CharacterBuilderError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'character_builder_error';
    this.detail = options?.detail;
  }
}

type RunCharacterBuilderInput = CharacterBuilderRequest & {
  userId: string;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function collectReferenceImages(referenceImages: CharacterBuilderReferenceImage[], role: CharacterBuilderReferenceImage['role']) {
  return referenceImages.filter((image) => image.role === role && /^https?:\/\//i.test(image.url));
}

function getAspectRatio(
  outputMode: CharacterBuilderOutputMode,
  action: CharacterBuilderAction,
  fullBodyRequired: boolean,
  includeCloseUps: boolean
): string {
  if (action === 'full-body-fix') return '2:3';
  if (outputMode === 'character-sheet' && includeCloseUps) return '16:9';
  if (outputMode === 'character-sheet') return '3:2';
  return fullBodyRequired ? '2:3' : '4:5';
}

function buildReferenceStrengthBlock(
  referenceStrength: CharacterBuilderReferenceStrength | null,
  traits: CharacterBuilderTraits
): string {
  const anchorParts = buildAnchorParts(traits);
  switch (referenceStrength) {
    case 'loose':
      return 'Use the reference image for overall vibe and recognizable identity cues, with room to clean up the design.';
    case 'strong':
      return `Stay very close to the uploaded identity reference for ${anchorParts} and defining visible markers.`;
    case 'balanced':
    default:
      return 'Stay close to the uploaded identity reference while cleaning framing, lighting, and readability.';
  }
}

function buildConsistencyBlock(
  consistencyMode: CharacterBuilderConsistencyMode,
  traits: CharacterBuilderTraits
): string {
  switch (consistencyMode) {
    case 'exploratory':
      return 'Keep the same person recognizable while allowing a little stylistic variation.';
    case 'strict':
      return `Preserve the same identity, ${buildAnchorParts(traits)}, and distinctive markers as consistently as possible.`;
    case 'balanced':
    default:
      return 'Aim for stable identity and styling while still allowing small cleanup improvements.';
  }
}

function isHairEnabled(traits: CharacterBuilderTraits): boolean {
  return traits.hairEnabled !== false;
}

function isOutfitEnabled(traits: CharacterBuilderTraits): boolean {
  return traits.outfitEnabled !== false;
}

function getCustomHairDescription(traits: CharacterBuilderTraits): string {
  return trimString(traits.customHairDescription);
}

function getCustomOutfitDescription(traits: CharacterBuilderTraits): string {
  return trimString(traits.customOutfitDescription);
}

function buildAnchorParts(traits: CharacterBuilderTraits): string {
  const parts = ['face', 'proportions'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  return parts.join(', ');
}

function buildPreservationParts(traits: CharacterBuilderTraits): string {
  const parts = ['same face'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  parts.push('proportions');
  if (isOutfitEnabled(traits)) parts.push('outfit identity');
  parts.push('distinctive visible markers');
  return parts.join(', ');
}

function buildLightingPreservationParts(traits: CharacterBuilderTraits): string {
  const parts = ['same person', 'facial identity'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  parts.push('proportions');
  if (isOutfitEnabled(traits)) parts.push('outfit');
  parts.push('signature details');
  return parts.join(', ');
}

function buildTraitPrompt(traits: CharacterBuilderTraits, sourceMode: CharacterBuilderRequest['sourceMode']): string[] {
  const parts: string[] = [];
  const pushValue = (value: string | null) => {
    if (value) parts.push(value);
  };
  const pushTrait = (
    key: keyof Pick<
      CharacterBuilderTraits,
      | 'genderPresentation'
      | 'ageRange'
      | 'skinTone'
      | 'faceCues'
      | 'hairColor'
      | 'hairLength'
      | 'hairstyle'
      | 'eyeColor'
      | 'bodyBuild'
      | 'outfitStyle'
    >
  ) => {
    const trait = traits[key];
    if (!trait || typeof trait !== 'object' || !('value' in trait)) return;
    if (trait.value == null || trait.value === 'auto') return;
    if (key === 'genderPresentation' && trait.value === 'custom') {
      const customGenderDescription = trimString(traits.customGenderDescription);
      if (customGenderDescription) {
        parts.push(customGenderDescription);
      }
      return;
    }
    pushValue(getTraitOptionPrompt(key, trait.value));
  };

  pushTrait('genderPresentation');
  pushTrait('ageRange');
  pushTrait('skinTone');
  pushTrait('faceCues');
  if (isHairEnabled(traits)) {
    const customHairDescription = getCustomHairDescription(traits);
    if (customHairDescription) {
      parts.push(customHairDescription);
    } else {
      pushTrait('hairColor');
      pushTrait('hairLength');
      pushTrait('hairstyle');
    }
  }
  pushTrait('eyeColor');
  pushTrait('bodyBuild');
  if (isOutfitEnabled(traits)) {
    const customOutfitDescription = getCustomOutfitDescription(traits);
    if (customOutfitDescription) {
      parts.push(customOutfitDescription);
    } else {
      pushTrait('outfitStyle');
    }
  }

  traits.accessories.forEach((value) => pushValue(getAccessoryPrompt(value)));
  traits.distinctiveFeatures.forEach((value) => pushValue(getDistinctiveFeaturePrompt(value)));
  pushValue(getRealismPrompt(traits.realismStyle));

  if (sourceMode === 'reference-image') {
    return parts;
  }

  return parts;
}

function buildReferenceBlock(input: CharacterBuilderRequest, referenceImages: CharacterBuilderReferenceImage[]): string[] {
  const identityImages = collectReferenceImages(referenceImages, 'identity');
  const styleImages = collectReferenceImages(referenceImages, 'style');
  const blocks: string[] = [];

  if (identityImages.length) {
    blocks.push(
      `Treat the uploaded identity reference image as the primary anchor for ${buildAnchorParts(input.traits)} and recognizable identity cues.`
    );
    blocks.push(buildReferenceStrengthBlock(input.referenceStrength ?? 'balanced', input.traits));
  }

  if (styleImages.length) {
    blocks.push(
      isOutfitEnabled(input.traits)
        ? 'Use any secondary reference image only for outfit, palette, or styling inspiration. Do not replace the core identity with it.'
        : 'Use any secondary reference image only for palette or overall art direction. Do not replace the core identity with it.'
    );
  }

  if (identityImages.length && input.sourceMode === 'reference-image') {
    blocks.push('Apply manual builder choices as supporting constraints rather than hard replacements.');
  }

  return blocks;
}

function buildLayoutBlock(input: CharacterBuilderRequest): string[] {
  const { action, outputMode, outputOptions } = input;

  if (action === 'full-body-fix') {
    return [
      'Rebuild the character as a clean head-to-toe reference image.',
      'Ensure the full head, torso, arms, hands, legs, ankles, and feet are visible with no crop.',
      `Preserve the same ${buildPreservationParts(input.traits)} from the source image.`,
    ];
  }

  if (action === 'lighting-variant') {
    return [
      'Create a lighting-only variation of the selected character reference.',
      `Preserve the same ${buildLightingPreservationParts(input.traits)}.`,
      'Change the lighting mood while keeping the character readable and reference-friendly.',
    ];
  }

  if (outputMode === 'character-sheet') {
    const blocks = [
      'Create a clean multi-angle character sheet with front, three-quarter, side, and back views.',
      'Keep scale, lighting, anatomy, and spacing consistent across the sheet.',
    ];
    if (outputOptions.includeCloseUps) {
      blocks.push('Arrange the sheet as a clean two-row grid.');
      blocks.push('Top row: four full-body views showing front, side, three-quarter, and back.');
      blocks.push('Reserve roughly two-thirds of the total canvas height for the top row so each full-body panel is tall enough to show the complete head-to-toe figure.');
      blocks.push('Each top-row panel must include the full head, full legs, ankles, and feet with no crop.');
      blocks.push('Bottom row: four compact close-up head-and-shoulders portraits directly underneath, matching the same view order.');
      blocks.push('Keep the bottom row to roughly one-third of the total canvas height so the close-ups read as a shorter strip and do not steal height from the full-body views.');
      blocks.push('Keep all eight panels aligned with even spacing, the same neutral background, and consistent lighting.');
      blocks.push(
        isHairEnabled(input.traits)
          ? 'The close-ups must clearly show the same face, hairstyle, earrings, makeup, and distinctive identity cues as the full-body views.'
          : 'The close-ups must clearly show the same face, earrings, makeup, and distinctive identity cues as the full-body views.'
      );
    }
    return blocks;
  }

  const blocks = [
    'Create a tight character reference portrait framed from roughly chest-up or shoulders-up, with strong facial clarity and readable hair and signature details.',
    'Bias toward a stable, reusable identity anchor rather than a generic beauty shot.',
    'Keep the framing tighter than a full-body shot unless full-body framing is explicitly requested.',
  ];
  if (outputOptions.fullBodyRequired) {
    blocks.push('Frame the character full body from head to toe.');
  }
  return blocks;
}

function buildOutputOptionBlock(input: CharacterBuilderRequest): string[] {
  const blocks: string[] = [];
  if (input.outputOptions.neutralStudioBackground) {
    blocks.push('Use a clean neutral studio background.');
  }
  if (input.outputOptions.preserveFacialDetails) {
    blocks.push('Preserve facial detail clarity and readable skin texture.');
  }
  if (input.outputOptions.avoid3dRenderLook) {
    blocks.push('Avoid a glossy 3D-render look.');
  }
  if (input.outputMode === 'character-sheet' || input.outputOptions.fullBodyRequired) {
    blocks.push('Keep the character fully visible with realistic anatomy and complete framing.');
  }
  return blocks;
}

function buildDetailLockBlock(input: CharacterBuilderRequest): string[] {
  const detailTags = uniqueStrings(input.mustRemainVisible ?? []);
  const blocks: string[] = [];

  if (input.traits.distinctiveFeatures.length) {
    blocks.push(
      `Preserve these distinctive traits: ${input.traits.distinctiveFeatures
        .map((value) => getDistinctiveFeaturePrompt(value) ?? value)
        .filter(Boolean)
        .join(', ')}.`
    );
  }

  if (detailTags.length) {
    blocks.push(`These details must remain visible: ${detailTags.join(', ')}.`);
  }

  return blocks;
}

function buildPrompt(input: CharacterBuilderRequest): string {
  const referenceImages = input.referenceImages.filter((image) => /^https?:\/\//i.test(image.url));
  const sections: string[] = [
    'Create a reusable AI character reference asset as a single still image output. Do not imply motion, timeline editing, or video generation.',
  ];
  const traitPrompt = buildTraitPrompt(input.traits, input.sourceMode);
  const referenceBlock = buildReferenceBlock(input, referenceImages);
  const layoutBlock = buildLayoutBlock(input);
  const outputBlock = buildOutputOptionBlock(input);
  const detailLockBlock = buildDetailLockBlock(input);
  const advancedNotes = trimString(input.advancedNotes);

  if (traitPrompt.length) {
    sections.push(`Character DNA: ${traitPrompt.join(', ')}.`);
  } else if (input.sourceMode === 'scratch') {
    sections.push('Create an original character identity using the selected builder traits and the output constraints below.');
  } else {
    sections.push('Infer the core identity from the uploaded reference image while following the selected builder constraints.');
  }

  if (referenceBlock.length) {
    sections.push(referenceBlock.join(' '));
  }

  sections.push(buildConsistencyBlock(input.consistencyMode, input.traits));
  sections.push(layoutBlock.join(' '));

  if (outputBlock.length) {
    sections.push(outputBlock.join(' '));
  }

  if (detailLockBlock.length) {
    sections.push(detailLockBlock.join(' '));
  }

  if (advancedNotes) {
    sections.push(`Additional guidance: ${advancedNotes}.`);
  }

  return sections.join('\n\n');
}

function buildInputMode(input: CharacterBuilderRequest, imageUrls: string[]): 't2i' | 'i2i' {
  if (input.action !== 'generate') {
    return 'i2i';
  }
  return imageUrls.length > 0 ? 'i2i' : 't2i';
}

function buildImageUrls(input: CharacterBuilderRequest): string[] {
  const urls: string[] = [];

  if (input.action !== 'generate') {
    const selectedUrl = trimString(input.selectedResultUrl);
    const pinnedUrl = trimString(input.pinnedReferenceResultUrl);
    if (selectedUrl) urls.push(selectedUrl);
    if (pinnedUrl && pinnedUrl !== selectedUrl) urls.push(pinnedUrl);
  }

  for (const image of input.referenceImages) {
    const url = trimString(image.url);
    if (url) urls.push(url);
  }

  return uniqueStrings(urls).slice(0, 4);
}

function validateTraitSource(value: unknown): CharacterBuilderTraitSource {
  return value === 'auto' ? 'auto' : 'manual';
}

function sanitizeTraits(traits: CharacterBuilderRequest['traits'] | undefined): CharacterBuilderTraits {
  if (!traits) {
    throw new CharacterBuilderError('Character traits are required.', {
      status: 400,
      code: 'invalid_traits',
    });
  }

  const sanitizeTrait = <T extends string>(value: TraitValue<T> | undefined): TraitValue<T> => ({
    value:
      value && (typeof value.value === 'string' || value.value === null)
        ? (value.value as T | 'auto' | null)
        : null,
    source: validateTraitSource(value?.source),
  });

  return {
    genderPresentation: sanitizeTrait(traits.genderPresentation),
    customGenderDescription: trimString(traits.customGenderDescription),
    ageRange: sanitizeTrait(traits.ageRange),
    skinTone: sanitizeTrait(traits.skinTone),
    faceCues: sanitizeTrait(traits.faceCues),
    hairEnabled: traits.hairEnabled !== false,
    customHairDescription: trimString(traits.customHairDescription),
    hairColor: sanitizeTrait(traits.hairColor),
    hairLength: sanitizeTrait(traits.hairLength),
    hairstyle: sanitizeTrait(traits.hairstyle),
    eyeColor: sanitizeTrait(traits.eyeColor),
    bodyBuild: sanitizeTrait(traits.bodyBuild),
    outfitEnabled: traits.outfitEnabled !== false,
    customOutfitDescription: trimString(traits.customOutfitDescription),
    outfitStyle: sanitizeTrait(traits.outfitStyle),
    accessories: uniqueStrings(Array.isArray(traits.accessories) ? traits.accessories : []),
    distinctiveFeatures: uniqueStrings(Array.isArray(traits.distinctiveFeatures) ? traits.distinctiveFeatures : []),
    realismStyle:
      traits.realismStyle === 'cinematic' ||
      traits.realismStyle === 'stylized' ||
      traits.realismStyle === 'animated'
        ? traits.realismStyle
        : 'photoreal',
  };
}

function sanitizeReferenceImages(referenceImages: CharacterBuilderRequest['referenceImages'] | undefined) {
  if (!Array.isArray(referenceImages)) return [];
  return referenceImages.reduce<CharacterBuilderReferenceImage[]>((acc, image) => {
      const url = trimString(image?.url);
      if (!url) return acc;
      acc.push({
        id: trimString(image.id) || `ref_${randomUUID()}`,
        url,
        role: image.role === 'style' ? 'style' : 'identity',
        name: trimString(image.name) || null,
        width: typeof image.width === 'number' ? image.width : null,
        height: typeof image.height === 'number' ? image.height : null,
      });
      return acc;
    }, []).slice(0, 2);
}

function sanitizeRequest(input: RunCharacterBuilderInput): CharacterBuilderRequest {
  const referenceImages = sanitizeReferenceImages(input.referenceImages);
  const sourceMode = input.sourceMode === 'reference-image' ? 'reference-image' : 'scratch';
  const action = input.action === 'full-body-fix' || input.action === 'lighting-variant' ? input.action : 'generate';
  const outputMode = input.outputMode === 'character-sheet' ? 'character-sheet' : 'portrait-reference';
  const consistencyMode =
    input.consistencyMode === 'exploratory' || input.consistencyMode === 'strict'
      ? input.consistencyMode
      : 'balanced';
  const referenceStrength =
    input.referenceStrength === 'loose' || input.referenceStrength === 'strong'
      ? input.referenceStrength
      : input.referenceStrength === 'balanced'
        ? 'balanced'
        : null;
  const qualityMode = input.qualityMode === 'final' ? 'final' : 'draft';
  const traits = sanitizeTraits(input.traits);
  const outputOptions = {
    fullBodyRequired: input.outputOptions?.fullBodyRequired === true,
    includeCloseUps: input.outputOptions?.includeCloseUps === true,
    neutralStudioBackground: input.outputOptions?.neutralStudioBackground !== false,
    preserveFacialDetails: input.outputOptions?.preserveFacialDetails !== false,
    avoid3dRenderLook: input.outputOptions?.avoid3dRenderLook !== false,
  };

  const request: CharacterBuilderRequest = {
    action,
    sourceMode,
    outputMode,
    consistencyMode,
    referenceStrength,
    qualityMode,
    referenceImages,
    traits,
    outputOptions,
    advancedNotes: trimString(input.advancedNotes),
    mustRemainVisible: uniqueStrings(Array.isArray(input.mustRemainVisible) ? input.mustRemainVisible : []),
    generateCount: input.generateCount === 4 ? 4 : 1,
    selectedResultId: trimString(input.selectedResultId) || null,
    selectedResultUrl: trimString(input.selectedResultUrl) || null,
    pinnedReferenceResultId: trimString(input.pinnedReferenceResultId) || null,
    pinnedReferenceResultUrl: trimString(input.pinnedReferenceResultUrl) || null,
    lineage: {
      parentResultId: trimString(input.lineage?.parentResultId) || null,
      parentRunId: trimString(input.lineage?.parentRunId) || null,
      pinnedReferenceResultId: trimString(input.lineage?.pinnedReferenceResultId) || null,
    },
  };

  if (request.sourceMode === 'reference-image' && !collectReferenceImages(request.referenceImages, 'identity').length) {
    throw new CharacterBuilderError('An identity reference image is required in reference-image mode.', {
      status: 400,
      code: 'identity_reference_required',
    });
  }

  if (request.action !== 'generate' && !request.selectedResultUrl) {
    throw new CharacterBuilderError('Select a result before running a refinement.', {
      status: 400,
      code: 'selected_result_required',
    });
  }

  return request;
}

function buildSettingsSnapshot(
  request: CharacterBuilderRequest,
  prompt: string,
  engineId: string,
  engineLabel: string,
  inputMode: 't2i' | 'i2i'
): CharacterBuilderSettingsSnapshot {
  return {
    schemaVersion: 1,
    surface: 'character-builder',
    action: request.action,
    engineId,
    engineLabel,
    inputMode,
    prompt,
    builder: {
      sourceMode: request.sourceMode,
      outputMode: request.outputMode,
      consistencyMode: request.consistencyMode,
      referenceStrength: request.referenceStrength ?? null,
      qualityMode: request.qualityMode,
      referenceImages: request.referenceImages,
      traits: request.traits,
      outputOptions: request.outputOptions,
      advancedNotes: request.advancedNotes ?? '',
      mustRemainVisible: request.mustRemainVisible ?? [],
    },
    lineage: {
      parentResultId: request.lineage?.parentResultId ?? request.selectedResultId ?? null,
      parentRunId: request.lineage?.parentRunId ?? null,
      pinnedReferenceResultId:
        request.lineage?.pinnedReferenceResultId ?? request.pinnedReferenceResultId ?? null,
    },
  };
}

function getEngineLabel(engineId: string): string {
  return engineId === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana 2';
}

function getBillingProductKey(qualityMode: CharacterBuilderQualityMode): string {
  return qualityMode === 'final' ? 'character-final' : 'character-draft';
}

export async function runCharacterBuilder(input: RunCharacterBuilderInput): Promise<CharacterBuilderResponse> {
  const request = sanitizeRequest(input);
  const prompt = buildPrompt(request);
  const imageUrls = buildImageUrls(request);
  const inputMode = buildInputMode(request, imageUrls);
  const engineId = getQualityEngineId(request.qualityMode);
  const engineLabel = getEngineLabel(engineId);
  const billingProductKey = getBillingProductKey(request.qualityMode);
  const settingsSnapshot = buildSettingsSnapshot(request, prompt, engineId, engineLabel, inputMode);
  const aspectRatio = getAspectRatio(
    request.outputMode,
    request.action,
    request.outputOptions.fullBodyRequired,
    request.outputOptions.includeCloseUps
  );
  const resolution = getDefaultResolution(request.qualityMode);

  try {
    const result = await executeImageGeneration({
      userId: input.userId,
      jobSurface: 'character',
      billingProductKey,
      body: {
        engineId,
        mode: inputMode,
        prompt,
        numImages: request.generateCount === 4 ? 4 : 1,
        imageUrls: inputMode === 'i2i' ? imageUrls : undefined,
        aspectRatio,
        resolution,
        visibility: 'private',
        allowIndex: false,
        indexable: false,
      },
      settingsSnapshot,
    });

    const createdAt = new Date().toISOString();
    const runId = `character_run_${result.jobId ?? randomUUID()}`;
    const parentResultId = request.lineage?.parentResultId ?? request.selectedResultId ?? null;
    const results: CharacterBuilderResult[] = result.images.map((image, index) => ({
      ...image,
      id: `${result.jobId ?? runId}:result:${index + 1}`,
      runId,
      jobId: result.jobId ?? runId,
      engineId: result.engineId ?? engineId,
      engineLabel: result.engineLabel ?? engineLabel,
      action: request.action,
      outputMode: request.outputMode,
      qualityMode: request.qualityMode,
      parentResultId,
      createdAt,
    }));

    const run: CharacterBuilderRun = {
      id: runId,
      jobId: result.jobId ?? runId,
      action: request.action,
      outputMode: request.outputMode,
      qualityMode: request.qualityMode,
      engineId: result.engineId ?? engineId,
      engineLabel: result.engineLabel ?? engineLabel,
      createdAt,
      parentResultId,
      results,
      settingsSnapshot,
      pricing: result.pricing,
      requestId: result.requestId ?? null,
      providerJobId: result.providerJobId ?? null,
    };

    return {
      ok: true,
      run,
      settingsSnapshot,
      pricing: result.pricing,
    };
  } catch (error) {
    if (error instanceof ImageGenerationExecutionError) {
      throw new CharacterBuilderError(error.message, {
        status: error.status,
        code: error.code,
        detail: error.detail,
      });
    }
    throw error;
  }
}
