import type { Locale } from './types';

/** English-only authored routes bypass the locale-prefixed route tree. */
export function isEnglishOnlyMarketingPath(englishPath: string): boolean {
  return englishPath.replace(/\/$/, '') === '/tools/video-background-changer';
}

/** English-only use-case pages return language choices to an existing destination. */
export function marketingPageFallback(englishPath: string, targetLocale: Locale): string | null {
  return isEnglishOnlyMarketingPath(englishPath) && targetLocale !== 'en'
    ? '/tools'
    : null;
}
