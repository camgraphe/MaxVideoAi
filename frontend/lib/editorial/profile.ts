import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

export const DEFAULT_EDITORIAL_PROFILE_ID = 'adrien-millot' as const;

export type ResolvedEditorialProfile = {
  id: typeof DEFAULT_EDITORIAL_PROFILE_ID;
  name: string;
  jobTitle: string;
  location: string;
  bio: string;
  aboutHref: string;
};

const BIOS: Record<AppLocale, string> = {
  en: 'Adrien Millot is the founder and product lead of MaxVideoAI. He builds the product, evaluates model behavior, and maintains its practical guides and benchmark methodology.',
  fr: 'Adrien Millot est le fondateur et responsable produit de MaxVideoAI. Il développe le produit, évalue le comportement des modèles et maintient ses guides pratiques ainsi que sa méthodologie de benchmark.',
  es: 'Adrien Millot es el fundador y responsable de producto de MaxVideoAI. Desarrolla el producto, evalúa el comportamiento de los modelos y mantiene sus guías prácticas y su metodología de benchmarks.',
};

export function getEditorialProfile(
  locale: AppLocale,
  id: string = DEFAULT_EDITORIAL_PROFILE_ID,
): ResolvedEditorialProfile {
  const resolvedId = id === DEFAULT_EDITORIAL_PROFILE_ID ? id : DEFAULT_EDITORIAL_PROFILE_ID;
  return {
    id: resolvedId,
    name: 'Adrien Millot',
    jobTitle: 'Founder & Product Lead',
    location: 'France',
    bio: BIOS[locale] ?? BIOS.en,
    aboutHref: `${localizePathFromEnglish(locale, '/about')}#${resolvedId}`,
  };
}

export function getEditorialProfileAbsoluteUrl(profile: Pick<ResolvedEditorialProfile, 'aboutHref'>): string {
  return `${SITE_BASE_URL}${profile.aboutHref}`;
}
