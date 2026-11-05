import { Suspense } from 'react';
import CharacterBuilderWorkspace from '@/components/tools/CharacterBuilderWorkspace';
import { CharacterStudioPublicFilms } from '@/components/tools/character-builder/landing/CharacterStudioPublicFilms';

export default function AppCharacterBuilderPage() {
  return <CharacterBuilderWorkspace recastExamples={<Suspense fallback={null}><CharacterStudioPublicFilms /></Suspense>} />;
}
