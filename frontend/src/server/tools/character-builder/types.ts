import type { CharacterBuilderRequest } from '@/types/character-builder';

export type RunCharacterBuilderInput = CharacterBuilderRequest & {
  userId: string;
};
