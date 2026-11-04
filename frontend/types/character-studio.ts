import type { CharacterBuilderSettingsSnapshot } from './character-builder';

export interface StudioImage {
  jobId: string;
  imageUrl: string;
  thumbUrl: string;
  settingsSnapshot: CharacterBuilderSettingsSnapshot;
}
export interface StudioLook extends StudioImage {
  id: string;
  name: string;
  createdAt: string;
}
export interface StudioCharacterSummary {
  id: string;
  name: string;
  identity: Omit<StudioImage, 'settingsSnapshot'>;
  lookCount: number;
  createdAt: string;
}
export interface StudioCharacter extends StudioCharacterSummary {
  presentation?: import('@/lib/character-studio-presentation').StudioPresentation;
  identity: StudioImage;
  looks: StudioLook[];
  nextLookCursor: string | null;
}
export interface StudioCharacterPage {
  characters: StudioCharacterSummary[];
  nextCursor: string | null;
}
export interface StudioSaveInput {
  name: string;
  jobId: string;
  imageUrl: string;
}
export interface StudioSaveResult {
  character: StudioCharacter;
  kind: 'character' | 'look';
}
export interface StudioRecastSelection {
  jobId: string;
  transferId: string;
  imageUrl: string;
  name: string;
  characterId?: string;
}
