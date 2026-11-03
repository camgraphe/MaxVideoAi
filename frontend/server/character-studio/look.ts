import { query } from '@/lib/db';
import { bindStudioLookRequest } from '@/lib/character-studio-look';
import { CharacterBuilderError } from '@/server/tools/character-builder/error';
import type { RunCharacterBuilderInput } from '@/server/tools/character-builder/types';
import { getStudioCharacter } from './store';
import { resolveStudioOutput, StudioLibraryError } from './source';

export async function resolveStudioLookRequest(
  input: RunCharacterBuilderInput,
): Promise<RunCharacterBuilderInput> {
  if (!input.characterId) return input;
  try {
    if (input.action !== 'generate') throw new StudioLibraryError('look_generate_only');
    const character = await getStudioCharacter(input.userId, input.characterId);
    await resolveStudioOutput({ query }, input.userId, character.identity.jobId, character.identity.imageUrl);
    return bindStudioLookRequest(input, character);
  } catch (error) {
    throw new CharacterBuilderError(
      'The saved character is unavailable. Return to your characters and try again.',
      {
        status: error instanceof StudioLibraryError ? error.status : 503,
        code: error instanceof StudioLibraryError ? error.code : 'character_library_unavailable',
      },
    );
  }
}
