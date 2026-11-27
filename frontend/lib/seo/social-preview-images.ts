import config from '@/config/social-preview-images.json';
import type { AppLocale } from '@/i18n/locales';

export const BRAND_SOCIAL_IMAGE = `${config.directory}/brand.jpg`;

export const socialPreviewPages = [
  'home', 'models', 'models-image', 'models-video', 'compare',
  'pricing', 'payg', 'mcp', 'chatgpt', 'upscale',
] as const;

export function pageSocialImage(page: typeof socialPreviewPages[number], locale: AppLocale): string {
  return `${config.directory}/${locale}/${page}.jpg`;
}

const modelCards = new Set(config.modelCards);
const archiveCards = new Set(config.archiveCards);

export function modelSocialImage(slug: string, locale: AppLocale): string | undefined {
  if (modelCards.has(slug)) return `${config.directory}/models/${slug}.jpg`;
  if (archiveCards.has(slug)) return `${config.directory}/${locale}/archives/${slug}.jpg`;
  return undefined;
}
