import { createDefaultCharacterBuilderState } from './character-builder';
import type {
  CharacterBuilderRequest,
  CharacterBuilderState,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import type { StudioCharacter } from '@/types/character-studio';

const identityKeys = [
  'characterType',
  'customCharacterDescription',
  'genderPresentation',
  'customGenderDescription',
  'ageRange',
  'skinTone',
  'faceCues',
  'eyeColor',
  'eyeShape',
  'bodyBuild',
  'distinctiveFeatures',
  'customDetailsDescription',
  'realismStyle',
] as const;

/** Shared intent projection. The server always supplies the owned saved character. */
export function bindStudioLookRequest<T extends CharacterBuilderRequest>(
  input: T,
  character: StudioCharacter,
): T {
  const identityTraits = {
    ...createDefaultCharacterBuilderState().traits,
    ...character.identity.settingsSnapshot.builder.traits,
  };
  const traits = { ...input.traits };
  for (const key of identityKeys) Object.assign(traits, { [key]: identityTraits[key] });
  return {
    ...input,
    characterId: character.id,
    sourceMode: 'reference-image',
    consistencyMode: 'strict',
    referenceStrength: 'strong',
    traits: traits as CharacterBuilderTraits,
    referenceImages: [
      {
        id: `character:${character.id}`,
        role: 'identity',
        url: character.identity.imageUrl,
        name: character.name,
      },
      ...(input.referenceImages ?? []).filter((image) => image.role === 'style').slice(0, 1),
    ],
    selectedResultId: null,
    selectedResultUrl: null,
    pinnedReferenceResultId: null,
    pinnedReferenceResultUrl: null,
    lineage: { parentRunId: character.identity.jobId, parentResultId: null, pinnedReferenceResultId: null },
  };
}

export function buildStudioLookDraft(
  previous: CharacterBuilderState,
  character: StudioCharacter,
): CharacterBuilderState {
  const base = createDefaultCharacterBuilderState();
  const builder = character.identity.settingsSnapshot.builder;
  const request = bindStudioLookRequest(
    {
      ...base,
      ...builder,
      action: 'generate',
      traits: { ...base.traits, ...builder.traits },
      referenceImages: [],
      advancedNotes: '',
      mustRemainVisible: [],
    },
    character,
  );
  return { ...base, ...request, runs: previous.runs, refinementHistory: previous.refinementHistory };
}
