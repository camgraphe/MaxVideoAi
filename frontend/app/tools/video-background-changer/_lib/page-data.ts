import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PUBLISHED_VIDEO_BACKGROUND_MEDIA } from './media';

export const VIDEO_BACKGROUND_PATH = '/tools/video-background-changer';
export const VIDEO_BACKGROUND_CTA = '/app?engine=wan-3-prime&mode=v2v';

export function buildVideoBackgroundMetadata() {
  return buildSeoMetadata({
    locale: 'en',
    englishPath: VIDEO_BACKGROUND_PATH,
    availableLocales: ['en'],
    title: 'AI Video Background Changer | MaxVideoAI',
    description: 'Change the setting of an existing video with AI. Compare an original clip and its Wan 3 Prime edit, understand the limits, then review your own quote.',
  });
}

export function getPublishedVideoBackgroundMedia() {
  return PUBLISHED_VIDEO_BACKGROUND_MEDIA;
}
