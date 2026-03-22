import type { Metadata } from 'next';
import { AngleLandingPage } from '@/components/tools/AngleLandingPage';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildSeoMetadata({
  locale: 'en',
  title: 'Change Camera Angle with AI | Generate New Views from One Image',
  description:
    'Upload one image, change camera angle, and generate new perspectives with AI. Build better first frames for image-to-video, storyboards, ads, and product shots.',
  englishPath: '/tools/angle',
  availableLocales: ['en'],
  keywords: [
    'change camera angle ai',
    'change image perspective ai',
    'ai perspective generator',
    'photo angle editor ai',
    'camera angle control ai',
    'ai camera angle generator',
    'multiple angles from one image',
    'first frame for ai video',
    'image to video first frame',
  ],
  image:
    'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp',
  imageAlt: 'AI-generated alternate camera angles from one source image.',
});

export default function AngleToolPage() {
  return <AngleLandingPage />;
}
