import type {
  CharacterBuilderConsistencyMode,
  CharacterBuilderOutputMode,
  CharacterBuilderQualityMode,
  CharacterBuilderReferenceStrength,
  CharacterBuilderState,
  CharacterBuilderTraits,
  CharacterBuilderSourceMode,
  TraitValue,
} from '@/types/character-builder';

type TraitOption = {
  id: string;
  label: string;
  prompt: string;
  swatch?: string;
  hint?: string;
};

function traitValue<T extends string>(value: T | 'auto' | null, source: 'auto' | 'manual'): TraitValue<T> {
  return { value, source };
}

export const CHARACTER_BUILDER_STORAGE_KEY = 'maxvideoai.character-builder.v1';
export const CHARACTER_BUILDER_STORAGE_VERSION = 1;
export const CHARACTER_BUILDER_MAX_REFERENCE_IMAGES = 2;

export const CHARACTER_OUTPUT_OPTIONS: Array<{ id: CharacterBuilderOutputMode; label: string; description: string }> = [
  {
    id: 'portrait-reference',
    label: 'Portrait reference',
    description: 'Centered face-forward anchor for later reuse.',
  },
  {
    id: 'character-sheet',
    label: 'Character sheet',
    description: 'Full-body turnaround with clean multi-angle coverage.',
  },
];

export const CHARACTER_CONSISTENCY_OPTIONS: Array<{
  id: CharacterBuilderConsistencyMode;
  label: string;
  description: string;
}> = [
  {
    id: 'exploratory',
    label: 'Exploratory',
    description: 'Keep identity recognizable while allowing more variation.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Aim for stable identity with a little creative flexibility.',
  },
  {
    id: 'strict',
    label: 'Strict',
    description: 'Bias strongly toward identity preservation across outputs.',
  },
];

export const CHARACTER_REFERENCE_STRENGTH_OPTIONS: Array<{
  id: CharacterBuilderReferenceStrength;
  label: string;
  description: string;
}> = [
  {
    id: 'loose',
    label: 'Loose',
    description: 'Use the reference for general vibe and broad identity cues.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Preserve the core face and styling while allowing cleanup.',
  },
  {
    id: 'strong',
    label: 'Strong',
    description: 'Stay close to the uploaded identity and key visible markers.',
  },
];

export const CHARACTER_QUALITY_OPTIONS: Array<{
  id: CharacterBuilderQualityMode;
  label: string;
  description: string;
  engineId: string;
}> = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Fast exploratory passes on Nano Banana 2.',
    engineId: 'nano-banana-2',
  },
  {
    id: 'final',
    label: 'Final',
    description: 'Cleaner export-ready references on Nano Banana Pro.',
    engineId: 'nano-banana-pro',
  },
];

export const GENDER_PRESENTATION_OPTIONS: TraitOption[] = [
  { id: 'woman', label: 'Woman', prompt: 'woman character' },
  { id: 'man', label: 'Man', prompt: 'man character' },
  { id: 'androgynous', label: 'Androgynous', prompt: 'androgynous character' },
  { id: 'custom', label: 'Custom', prompt: 'character with a custom gender presentation' },
];

export const AGE_RANGE_OPTIONS: TraitOption[] = [
  { id: 'teen', label: 'Teen', prompt: 'late-teen age range' },
  { id: 'young-adult', label: 'Young adult', prompt: 'young adult age range' },
  { id: 'adult', label: 'Adult', prompt: 'adult age range' },
  { id: 'mature', label: 'Mature', prompt: 'mature adult age range' },
  { id: 'senior', label: 'Senior', prompt: 'senior age range' },
];

export const SKIN_TONE_OPTIONS: TraitOption[] = [
  { id: 'fair', label: 'Fair', prompt: 'fair skin tone', swatch: '#f4d9c4' },
  { id: 'light', label: 'Light', prompt: 'light skin tone', swatch: '#edc9af' },
  { id: 'medium', label: 'Medium', prompt: 'medium skin tone', swatch: '#c68642' },
  { id: 'olive', label: 'Olive', prompt: 'olive skin tone', swatch: '#b38b6d' },
  { id: 'deep', label: 'Deep', prompt: 'deep skin tone', swatch: '#8d5524' },
  { id: 'rich', label: 'Rich', prompt: 'rich dark skin tone', swatch: '#5c4033' },
];

export const FACE_CUES_OPTIONS: TraitOption[] = [
  { id: 'soft', label: 'Soft', prompt: 'soft facial features' },
  { id: 'angular', label: 'Angular', prompt: 'angular facial features' },
  { id: 'round', label: 'Round', prompt: 'round face shape' },
  { id: 'defined', label: 'Defined', prompt: 'defined cheekbones and facial structure' },
  { id: 'strong-jaw', label: 'Strong jaw', prompt: 'strong jawline' },
];

export const HAIR_COLOR_OPTIONS: TraitOption[] = [
  { id: 'black', label: 'Black', prompt: 'black hair', swatch: '#1b1b1b' },
  { id: 'dark-brown', label: 'Dark brown', prompt: 'dark brown hair', swatch: '#3d2b1f' },
  { id: 'brown', label: 'Brown', prompt: 'brown hair', swatch: '#6f4e37' },
  { id: 'blonde', label: 'Blonde', prompt: 'blonde hair', swatch: '#e2c26d' },
  { id: 'red', label: 'Red', prompt: 'red hair', swatch: '#b55239' },
  { id: 'gray', label: 'Gray', prompt: 'gray hair', swatch: '#9ca3af' },
  { id: 'fantasy', label: 'Fantasy', prompt: 'fantasy-colored hair' },
];

export const HAIR_LENGTH_OPTIONS: TraitOption[] = [
  { id: 'short', label: 'Short', prompt: 'short hair length' },
  { id: 'medium', label: 'Medium', prompt: 'medium hair length' },
  { id: 'long', label: 'Long', prompt: 'long hair length' },
  { id: 'very-long', label: 'Very long', prompt: 'very long hair length' },
];

export const HAIRSTYLE_OPTIONS: TraitOption[] = [
  { id: 'straight', label: 'Straight', prompt: 'straight hairstyle' },
  { id: 'wavy-bob', label: 'Wavy bob', prompt: 'wavy bob hairstyle' },
  { id: 'curly', label: 'Curly', prompt: 'curly hairstyle' },
  { id: 'ponytail', label: 'Ponytail', prompt: 'ponytail hairstyle' },
  { id: 'braids', label: 'Braids', prompt: 'braided hairstyle' },
  { id: 'buzz-cut', label: 'Buzz cut', prompt: 'buzz cut hairstyle' },
  { id: 'afro', label: 'Afro', prompt: 'afro hairstyle' },
  { id: 'tied-back', label: 'Tied back', prompt: 'tied-back hairstyle' },
];

export const EYE_COLOR_OPTIONS: TraitOption[] = [
  { id: 'brown', label: 'Brown', prompt: 'brown eyes', swatch: '#6b4226' },
  { id: 'hazel', label: 'Hazel', prompt: 'hazel eyes', swatch: '#8e7618' },
  { id: 'blue', label: 'Blue', prompt: 'blue eyes', swatch: '#6ca0dc' },
  { id: 'green', label: 'Green', prompt: 'green eyes', swatch: '#3a7d44' },
  { id: 'gray', label: 'Gray', prompt: 'gray eyes', swatch: '#9aa6b2' },
  { id: 'amber', label: 'Amber', prompt: 'amber eyes', swatch: '#bf8f00' },
];

export const BODY_BUILD_OPTIONS: TraitOption[] = [
  { id: 'slim', label: 'Slim', prompt: 'slim body build' },
  { id: 'average', label: 'Average', prompt: 'average body build' },
  { id: 'athletic', label: 'Athletic', prompt: 'athletic body build' },
  { id: 'strong', label: 'Strong', prompt: 'strong body build' },
  { id: 'curvy', label: 'Curvy', prompt: 'curvy body build' },
];

export const OUTFIT_STYLE_OPTIONS: TraitOption[] = [
  { id: 'casual', label: 'Casual', prompt: 'casual wardrobe styling' },
  { id: 'business', label: 'Business', prompt: 'business wardrobe styling' },
  { id: 'streetwear', label: 'Streetwear', prompt: 'streetwear styling' },
  { id: 'formal', label: 'Formal', prompt: 'formal wardrobe styling' },
  { id: 'luxury', label: 'Luxury', prompt: 'luxury wardrobe styling' },
  { id: 'sci-fi', label: 'Sci-fi', prompt: 'sci-fi wardrobe styling' },
  { id: 'fantasy', label: 'Fantasy', prompt: 'fantasy wardrobe styling' },
  { id: 'tactical', label: 'Tactical', prompt: 'tactical wardrobe styling' },
];

export const REALISM_STYLE_OPTIONS: Array<{
  id: CharacterBuilderTraits['realismStyle'];
  label: string;
  prompt: string;
}> = [
  { id: 'photoreal', label: 'Photoreal', prompt: 'photoreal reference quality' },
  { id: 'cinematic', label: 'Cinematic', prompt: 'cinematic still photography look' },
  { id: 'stylized', label: 'Stylized', prompt: 'stylized illustration look' },
  { id: 'animated', label: 'Animated', prompt: 'animated character design look' },
];

export const ACCESSORY_OPTIONS: TraitOption[] = [
  { id: 'glasses', label: 'Glasses', prompt: 'wearing glasses' },
  { id: 'sunglasses', label: 'Sunglasses', prompt: 'wearing sunglasses' },
  { id: 'earrings', label: 'Earrings', prompt: 'distinctive earrings' },
  { id: 'necklace', label: 'Necklace', prompt: 'signature necklace' },
  { id: 'hat', label: 'Hat', prompt: 'signature hat' },
  { id: 'headscarf', label: 'Headscarf', prompt: 'headscarf accessory' },
];

export const DISTINCTIVE_FEATURE_OPTIONS: TraitOption[] = [
  { id: 'freckles', label: 'Freckles', prompt: 'visible freckles' },
  { id: 'scar', label: 'Scar', prompt: 'visible facial scar' },
  { id: 'tattoo', label: 'Tattoo', prompt: 'visible tattoo' },
  { id: 'piercing', label: 'Piercing', prompt: 'visible piercing' },
  { id: 'beard', label: 'Beard', prompt: 'well-defined beard' },
  { id: 'beauty-mark', label: 'Beauty mark', prompt: 'visible beauty mark' },
  { id: 'makeup', label: 'Makeup', prompt: 'makeup styling' },
  { id: 'wrinkles', label: 'Wrinkles', prompt: 'natural visible wrinkles' },
];

export const AUTO_TRAIT_KEYS = new Set<keyof CharacterBuilderTraits>([
  'skinTone',
  'faceCues',
  'hairColor',
  'hairLength',
  'hairstyle',
  'eyeColor',
  'bodyBuild',
]);

export const CHARACTER_TRAIT_OPTION_MAP = {
  genderPresentation: GENDER_PRESENTATION_OPTIONS,
  ageRange: AGE_RANGE_OPTIONS,
  skinTone: SKIN_TONE_OPTIONS,
  faceCues: FACE_CUES_OPTIONS,
  hairColor: HAIR_COLOR_OPTIONS,
  hairLength: HAIR_LENGTH_OPTIONS,
  hairstyle: HAIRSTYLE_OPTIONS,
  eyeColor: EYE_COLOR_OPTIONS,
  bodyBuild: BODY_BUILD_OPTIONS,
  outfitStyle: OUTFIT_STYLE_OPTIONS,
} as const;

export function getQualityEngineId(qualityMode: CharacterBuilderQualityMode): string {
  return CHARACTER_QUALITY_OPTIONS.find((entry) => entry.id === qualityMode)?.engineId ?? 'nano-banana-2';
}

export function getDefaultAspectRatio(outputMode: CharacterBuilderOutputMode, action: 'generate' | 'full-body-fix' | 'lighting-variant'): string {
  if (action === 'full-body-fix') return '2:3';
  if (outputMode === 'character-sheet') return '3:2';
  return '4:5';
}

export function getDefaultResolution(qualityMode: CharacterBuilderQualityMode): string {
  return qualityMode === 'final' ? '2k' : '1k';
}

export function createDefaultTraits(sourceMode: CharacterBuilderSourceMode = 'scratch'): CharacterBuilderTraits {
  const autoValue = sourceMode === 'reference-image' ? 'auto' : null;
  const autoSource = sourceMode === 'reference-image' ? 'auto' : 'manual';

  return {
    genderPresentation: traitValue<'woman' | 'man' | 'androgynous' | 'custom'>(null, 'manual'),
    customGenderDescription: '',
    ageRange: traitValue<'teen' | 'young-adult' | 'adult' | 'mature' | 'senior'>(null, 'manual'),
    skinTone: traitValue(autoValue, autoSource),
    faceCues: traitValue(autoValue, autoSource),
    hairColor: traitValue(autoValue, autoSource),
    hairLength: traitValue(autoValue, autoSource),
    hairstyle: traitValue(autoValue, autoSource),
    eyeColor: traitValue(autoValue, autoSource),
    bodyBuild: traitValue(autoValue, autoSource),
    outfitStyle: traitValue(null, 'manual'),
    accessories: [],
    distinctiveFeatures: [],
    realismStyle: 'photoreal',
  };
}

export function normalizeTraitsForSourceMode(
  traits: CharacterBuilderTraits,
  sourceMode: CharacterBuilderSourceMode
): CharacterBuilderTraits {
  const next = { ...traits };

  for (const key of AUTO_TRAIT_KEYS) {
    const current = next[key];
    if (!current || typeof current !== 'object' || !('value' in current)) continue;
    if (sourceMode === 'reference-image') {
      if (current.value == null) {
        (next[key] as TraitValue<string>) = traitValue('auto', 'auto');
      }
      continue;
    }
    if (current.value === 'auto') {
      (next[key] as TraitValue<string>) = traitValue(null, 'manual');
    }
  }

  return next;
}

export function createDefaultCharacterBuilderState(
  sourceMode: CharacterBuilderSourceMode = 'scratch'
): CharacterBuilderState {
  return {
    sourceMode,
    referenceImages: [],
    traits: createDefaultTraits(sourceMode),
    outputMode: 'portrait-reference',
    consistencyMode: 'balanced',
    referenceStrength: sourceMode === 'reference-image' ? 'balanced' : null,
    qualityMode: 'draft',
    outputOptions: {
      fullBodyRequired: false,
      includeCloseUps: false,
      neutralStudioBackground: true,
      preserveFacialDetails: true,
      avoid3dRenderLook: true,
    },
    advancedNotes: '',
    mustRemainVisible: [],
    selectedResultId: null,
    pinnedReferenceResultId: null,
    runs: [],
    refinementHistory: [],
  };
}

export function findTraitOption(options: readonly TraitOption[], value: string | null | undefined): TraitOption | null {
  if (!value) return null;
  return options.find((option) => option.id === value) ?? null;
}

export function getTraitOptionPrompt(
  traitKey: keyof typeof CHARACTER_TRAIT_OPTION_MAP,
  value: string | null | undefined
): string | null {
  const option = findTraitOption(CHARACTER_TRAIT_OPTION_MAP[traitKey], value);
  return option?.prompt ?? null;
}

export function getAccessoryPrompt(value: string): string | null {
  return findTraitOption(ACCESSORY_OPTIONS, value)?.prompt ?? null;
}

export function getDistinctiveFeaturePrompt(value: string): string | null {
  return findTraitOption(DISTINCTIVE_FEATURE_OPTIONS, value)?.prompt ?? null;
}

export function getRealismPrompt(value: CharacterBuilderTraits['realismStyle']): string | null {
  return REALISM_STYLE_OPTIONS.find((option) => option.id === value)?.prompt ?? null;
}

export function summarizeCharacterState(state: Pick<CharacterBuilderState, 'traits' | 'outputMode'>): string {
  const parts: string[] = [];
  const gender = state.traits.genderPresentation.value;
  const age = state.traits.ageRange.value;
  const outfit = state.traits.outfitStyle.value;

  const genderLabel = findTraitOption(GENDER_PRESENTATION_OPTIONS, gender)?.label;
  const ageLabel = findTraitOption(AGE_RANGE_OPTIONS, age)?.label;
  const outfitLabel = findTraitOption(OUTFIT_STYLE_OPTIONS, outfit)?.label;

  if (genderLabel) parts.push(genderLabel);
  if (ageLabel) parts.push(ageLabel.toLowerCase());
  if (outfitLabel) parts.push(outfitLabel.toLowerCase());
  parts.push(state.outputMode === 'character-sheet' ? 'character sheet' : 'portrait reference');

  return parts.join(' · ');
}
