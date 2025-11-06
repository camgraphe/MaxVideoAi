import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions, locales } from '@/i18n/locales';

export const SITE_BASE_URL = 'https://maxvideoai.com';

export type LocaleSlugMap = Record<AppLocale, string>;

export function buildMetadataUrls(locale: AppLocale, slugMap?: LocaleSlugMap) {
  const buildUrl = (target: AppLocale) => {
    const slug = slugMap?.[target];
    const suffix = slug ? `/${slug}` : '';
    return `${SITE_BASE_URL}/${localePathnames[target]}${suffix}`;
  };

  const urls = {
    en: buildUrl('en'),
    fr: buildUrl('fr'),
    es: buildUrl('es'),
  };

  const languages = {
    en: urls.en,
    fr: urls.fr,
    es: urls.es,
    'x-default': urls.en,
  };

  const ogLocale = localeRegions[locale].replace('-', '_');
  const alternateOg = locales.filter((code) => code !== locale).map((code) =>
    localeRegions[code].replace('-', '_')
  );

  return {
    urls,
    languages,
    canonical: urls[locale],
    ogLocale,
    alternateOg,
  };
}
