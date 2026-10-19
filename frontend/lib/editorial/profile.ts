import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

export const DEFAULT_EDITORIAL_PROFILE_ID = 'maxvideoai' as const;

export type ResolvedEditorialProfile = {
  id: typeof DEFAULT_EDITORIAL_PROFILE_ID;
  name: string;
  bio: string;
  aboutHref: string;
};

const BIOS: Record<AppLocale, string> = {
  en: 'MaxVideoAI publishes practical guides, model comparisons, and production examples. Its editorial standards distinguish provider specifications, observed measurements, and editorial judgments.',
  fr: 'MaxVideoAI publie des guides pratiques, des comparatifs de modèles et des exemples de production. Ses normes éditoriales distinguent les spécifications fournisseurs, les mesures observées et les appréciations éditoriales.',
  es: 'MaxVideoAI publica guías prácticas, comparativas de modelos y ejemplos de producción. Sus estándares editoriales distinguen las especificaciones de proveedores, las mediciones observadas y los juicios editoriales.',
};

export function getEditorialProfile(
  locale: AppLocale,
  id: string = DEFAULT_EDITORIAL_PROFILE_ID,
): ResolvedEditorialProfile {
  const resolvedId = id === DEFAULT_EDITORIAL_PROFILE_ID ? id : DEFAULT_EDITORIAL_PROFILE_ID;
  return {
    id: resolvedId,
    name: 'MaxVideoAI',
    bio: BIOS[locale] ?? BIOS.en,
    aboutHref: `${localizePathFromEnglish(locale, '/about')}#${resolvedId}`,
  };
}

export function getEditorialProfileAbsoluteUrl(profile: Pick<ResolvedEditorialProfile, 'aboutHref'>): string {
  return `${SITE_BASE_URL}${profile.aboutHref}`;
}
