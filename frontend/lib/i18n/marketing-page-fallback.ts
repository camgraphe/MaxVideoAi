import type { Locale } from './types';

/** English-only use-case pages return language choices to an existing destination. */
export function marketingPageFallback(englishPath: string, targetLocale: Locale): string | null {
  return englishPath.replace(/\/$/, '') === '/tools/video-background-changer' && targetLocale !== 'en'
    ? '/tools'
    : null;
}
