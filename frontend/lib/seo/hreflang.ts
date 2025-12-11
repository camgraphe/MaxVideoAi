import type { AppLocale } from '@/i18n/locales';
import { getHreflangAlternates } from '@/lib/metadataUrls';

const HREFLANG_GROUP_PATHS = {
  home: '/',
  models: '/models',
  pricing: '/pricing',
  examples: '/examples',
  blog: '/blog',
  docs: '/docs',
  status: '/status',
  contact: '/contact',
  about: '/about',
  compare: '/ai-video-engines',
  workflows: '/workflows',
  changelog: '/changelog',
  legal: '/legal',
  legalTerms: '/legal/terms',
  legalPrivacy: '/legal/privacy',
  legalAcceptableUse: '/legal/acceptable-use',
  legalTakedown: '/legal/takedown',
  legalCookies: '/legal/cookies',
  legalCookiesList: '/legal/cookies-list',
  legalMentions: '/legal/mentions',
  legalSubprocessors: '/legal/subprocessors',
  legalReconsent: '/legal/reconsent',
} as const;

export type HreflangGroupKey = keyof typeof HREFLANG_GROUP_PATHS;

export function getHreflangEnglishPath(groupKey: HreflangGroupKey): string {
  return HREFLANG_GROUP_PATHS[groupKey];
}

export function getHreflangLinks(
  groupKey: HreflangGroupKey,
  options?: { availableLocales?: AppLocale[] }
) {
  const englishPath = getHreflangEnglishPath(groupKey);
  return getHreflangAlternates(englishPath, options).alternates;
}
