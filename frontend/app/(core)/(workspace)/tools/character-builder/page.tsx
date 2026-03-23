import type { Metadata } from 'next';
import { CharacterBuilderLandingPage } from '@/components/tools/CharacterBuilderLandingPage';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildSeoMetadata({
  locale: 'en',
  title: 'Consistent Character AI Tool | Reusable Character References for Image & Video',
  description:
    'Create reusable portrait anchors and 8-panel AI character sheets from one photo, optional outfit reference, or scratch. Reuse the same character across scenes, edits, and still-reference video workflows.',
  englishPath: '/tools/character-builder',
  availableLocales: ['en'],
  keywords: [
    'consistent character ai',
    'ai character consistency',
    'consistent character generator',
    'ai consistent character',
    'consistent ai characters',
    'consistent character for video',
    'character sheet ai',
    'ai character sheet generator',
    'character reference ai',
    'character reference sheet ai',
    'character turnaround ai',
    'keep same character across scenes',
    'same face same outfit ai',
    'image to video character consistency',
  ],
  image:
    'https://v3b.fal.media/files/b/0a935305/aYrWen8QnYME2LcBPZ33t_w1WcVklb.png',
  imageAlt: 'Reusable AI character sheet preview generated with MaxVideoAI Character Builder.',
});

export default function CharacterBuilderToolPage() {
  return <CharacterBuilderLandingPage />;
}
