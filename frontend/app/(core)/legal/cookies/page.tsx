import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const COOKIES_LIST_PATH: Record<AppLocale, string> = {
  en: '/legal/cookies-list',
  fr: '/fr/legal/cookies-list',
  es: '/es/legal/cookies-list',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  return buildSeoMetadata({
    locale,
    title: 'Cookie Policy',
    description: 'Overview of cookies and similar technologies used by MaxVideoAI.',
    hreflangGroup: 'legalCookies',
    englishPath: '/legal/cookies',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: 'Cookie Policy',
    robots: {
      index: false,
      follow: true,
    },
  });
}

export default async function CookiePolicyPage() {
  const locale = (await resolveLocale()) as AppLocale;
  permanentRedirect(COOKIES_LIST_PATH[locale] ?? COOKIES_LIST_PATH.en);
}
