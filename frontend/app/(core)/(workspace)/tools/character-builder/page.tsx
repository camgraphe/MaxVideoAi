import type { Metadata } from 'next';
import { CharacterBuilderLandingPage } from '@/components/tools/CharacterBuilderLandingPage';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildSeoMetadata({
  locale: 'en',
  title: 'Consistent Character AI Tool | Build Character Sheets for Image & Video',
  description:
    'Create reusable AI character references and 3-view character sheets from one image. Keep the same character consistent across scenes, prompts, and image-to-video workflows.',
  englishPath: '/tools/character-builder',
  availableLocales: ['en'],
  keywords: [
    'consistent character ai',
    'ai character consistency',
    'consistent character generator',
    'ai consistent character',
    'consistent ai characters',
    'character sheet ai',
    'ai character sheet generator',
    'character reference ai',
    'character reference sheet ai',
    'character turnaround ai',
  ],
  image:
    'https://v3b.fal.media/files/b/0a933bb7/R64-QF4-arWq1SzqnpC3r_DPAtirIT.png',
  imageAlt: 'Consistent AI character sheet preview generated with MaxVideoAI.',
});

export default function CharacterBuilderToolPage() {
  return <CharacterBuilderLandingPage />;
}
