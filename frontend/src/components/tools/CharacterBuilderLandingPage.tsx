import type { Dictionary } from '@/lib/i18n/types';
import { CharacterBuilderLandingView } from './character-builder/landing/CharacterBuilderLandingView';

type CharacterBuilderLandingContent = Dictionary['toolMarketing']['characterBuilder'];

export function CharacterBuilderLandingPage({ content }: { content: CharacterBuilderLandingContent }) {
  return <CharacterBuilderLandingView content={content} />;
}
