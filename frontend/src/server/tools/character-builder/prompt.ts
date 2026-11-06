import { getStudioScene } from '@/lib/character-studio-catalog';
import { buildTraitPrompt } from './trait-prompt';
import { getDistinctiveFeaturePrompt } from '@/lib/character-builder';
import type {
  CharacterBuilderConsistencyMode,
  CharacterBuilderReferenceImage,
  CharacterBuilderReferenceStrength,
  CharacterBuilderRequest,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import {
  buildAnchorParts,
  buildCloseUpIdentityParts,
  buildLightingPreservationParts,
  buildPreservationParts,
  hasFlexibleCharacterAnatomy,
  isOutfitEnabled,
} from './traits';
import { collectReferenceImages, trimString, uniqueStrings } from './utils';

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
      return 'Keep the same character recognizable while allowing a little stylistic variation.';
    case 'strict':
      return `Preserve the same identity, ${buildAnchorParts(traits)}, and distinctive markers as consistently as possible.`;
    case 'balanced':
    default:
      return 'Aim for stable identity and styling while still allowing small cleanup improvements.';
  }
}

function buildReferenceBlock(input: CharacterBuilderRequest, referenceImages: CharacterBuilderReferenceImage[]): string[] {
  const identityImages = collectReferenceImages(referenceImages, 'identity');
  const styleImages = collectReferenceImages(referenceImages, 'style');
  const blocks: string[] = [];
  if (input.characterId) {
    blocks.push(
      'Create a new look of the saved character identity shown in the first reference. Preserve its face, age, species, anatomy and distinctive identity markers. Only change the requested hairstyle, wardrobe, accessories, setting or lighting. Styling directions must not replace this identity.',
    );
  }

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
    blocks.push(hasFlexibleCharacterAnatomy(input.traits)
      ? 'Transform the reference into the requested character concept. Keep recognizable identity cues only where compatible; the reference must not override the requested species or material.'
      : 'Apply manual builder choices as supporting constraints rather than hard replacements.');
  }

  return blocks;
}

function buildLayoutBlock(input: CharacterBuilderRequest): string[] {
  const { action, outputMode, outputOptions } = input;
  const flexibleAnatomy = hasFlexibleCharacterAnatomy(input.traits);

  if (action === 'full-body-fix') {
    return [
      'Rebuild the character as a clean head-to-toe reference image.',
      flexibleAnatomy
        ? 'Show the entire character, including all appendages appropriate to its design, with no crop.'
        : 'Ensure the full head, torso, arms, hands, legs, ankles, and feet are visible with no crop.',
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
      'The saved reference defines the exact outfit and identity. Rotate the same subject in place, in the same relaxed neutral pose. Match the crown, eyes, hip and ground heights between views. Preserve limb count, assistive devices, garment construction and left-right asymmetry; in a true profile, far-side limbs may be occluded.',
      'No lettering, titles, swatches, borders, UI, decorative props or captions inside the generated art.',
    ];
    if (outputOptions.includeCloseUps) {
      blocks.push('Arrange the sheet as a clean two-row grid.');
      blocks.push('Top row: four full-body views showing front, side, three-quarter, and back.');
      blocks.push('Reserve roughly two-thirds of the total canvas height for the top row so each full-body panel is tall enough to show the complete head-to-toe figure.');
      blocks.push(flexibleAnatomy
        ? 'Each top-row panel must include the complete character and all its appendages with no crop.'
        : 'Each top-row panel must include the full head, full legs, ankles, and feet with no crop.');
      blocks.push('Bottom row: four compact close-up head-and-shoulders portraits directly underneath, matching the same view order.');
      blocks.push('Keep the bottom row to roughly one-third of the total canvas height so the close-ups read as a shorter strip and do not steal height from the full-body views.');
      blocks.push('Keep all eight panels aligned with even spacing, the same background, and consistent lighting.');
      blocks.push(
        `The close-ups must clearly show the ${buildCloseUpIdentityParts(input.traits)} as the full-body views.`
      );
    }
    if (!outputOptions.includeCloseUps) {
      blocks.push('Exactly one landscape lineup in four equally wide columns: 01 front (0 degrees), 02 front three-quarter (45 degrees), 03 true side (90 degrees), 04 straight back (180 degrees). One complete figure per column, facing the same turn direction. Use a level orthographic camera; no perspective shifts. Frame everything from the tips of the highest appendages to the soles, with breathing room above and below and a common floor line. Keep all four silhouettes large, distinct and fully inside their columns. No inset portraits.');
    }
    return blocks;
  }

  const blocks = [
    'Create a clean front-facing character reference portrait framed as a balanced medium portrait, with strong facial clarity and readable signature details.',
    'The face must be clearly visible and facing the camera, but avoid an extreme close-up that crops too tightly around the face.',
    flexibleAnatomy
      ? 'Frame the complete head or defining form with space for ears, antennae, leaves or other signature parts. Adapt portrait framing to the character anatomy without inventing human body parts.'
      : 'Use a waist-up portrait by default, leaving space above the head and below the waistline.',
    'Show the character dressed in a complete, coherent outfit suited to their role. Respect the selected wardrobe or reference outfit; if neither specifies clothing, choose one that fits their world. For a creature, fit the garments to its anatomy and show them clearly.',
    'Pull back enough to show the outfit, hands or equivalent appendages and any requested signature accessories in the same image as the face. Respect explicit requests for wider framing.',
    'Bias toward a stable, reusable identity anchor rather than a generic beauty shot.',
  ];
  if (outputMode !== 'portrait-reference' && outputOptions.fullBodyRequired) {
    blocks.push('Frame the character full body from head to toe.');
  }
  return blocks;
}

function buildOutputOptionBlock(input: CharacterBuilderRequest): string[] {
  const blocks: string[] = [];
  const scene = getStudioScene(input.traits.sceneId);
  const customScene = trimString(input.traits.customSceneDescription);
  if (scene || customScene) {
    blocks.push(`Place the character in this environment: ${scene?.prompt ?? customScene}.`);
    if (scene && customScene) {
      blocks.push(`Customize the environment with these directions, taking priority over any conflicting preset details: ${customScene}.`);
    }
    blocks.push('Keep the environment consistent across every view.');
  } else if (input.outputOptions.neutralStudioBackground) {
    blocks.push('Use a clean neutral studio background.');
  }
  if (input.outputOptions.preserveFacialDetails) {
    blocks.push(hasFlexibleCharacterAnatomy(input.traits)
      ? 'Preserve clear expressive features and the textures appropriate to the character: fur, chitin, fruit peel, alien skin or the described material.'
      : 'Preserve facial detail clarity and readable skin texture.');
  }
  if (input.outputOptions.avoid3dRenderLook) {
    blocks.push('Avoid a glossy 3D-render look.');
  }
  if (input.outputMode === 'character-sheet') {
    blocks.push(hasFlexibleCharacterAnatomy(input.traits)
      ? 'Keep the character fully visible with consistent anatomy appropriate to its concept and complete framing.'
      : 'Keep the character fully visible with realistic anatomy and complete framing.');
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

  if (trimString(input.traits.customDetailsDescription)) {
    blocks.push(`Preserve these extra visible details: ${trimString(input.traits.customDetailsDescription)}.`);
  }

  if (detailTags.length) {
    blocks.push(`These details must remain visible: ${detailTags.join(', ')}.`);
  }

  return blocks;
}

export function buildPrompt(input: CharacterBuilderRequest): string {
  const referenceImages = input.referenceImages.filter((image) => /^https?:\/\//i.test(image.url));
  const sections: string[] = [
    'Create a reusable AI character reference asset as a single still image output. Do not imply motion, timeline editing, or video generation.',
  ];
  const traitPrompt = buildTraitPrompt(input.traits);
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
    sections.push(`${hasFlexibleCharacterAnatomy(input.traits) ? 'Apply these detail locks only where compatible with the character concept. ' : ''}${detailLockBlock.join(' ')}`);
  }

  if (advancedNotes) {
    sections.push(`Additional guidance: ${advancedNotes}.`);
  }

  return sections.join('\n\n');
}
