import type { AppLocale } from '@/i18n/locales';
import { getModelLastModified } from './lastmod';
import { hasModelLocale } from './model-locales';
import { LOCALES, type CanonicalPathEntry } from './types';

export type ModelSitemapRosterEntry = {
  modelSlug?: string | null;
  surfaces?: {
    modelPage?: {
      indexable?: boolean;
      includeInSitemap?: boolean;
    };
  };
};

export type ModelRouteProjectionOptions = {
  getLastModified?: (slug: string) => string | undefined;
  hasLocale?: (slug: string, locale: AppLocale) => boolean;
};

export function isModelRosterEntryInSitemap(model: ModelSitemapRosterEntry): boolean {
  return Boolean(
    model.modelSlug &&
      model.surfaces?.modelPage?.indexable === true &&
      model.surfaces.modelPage.includeInSitemap === true,
  );
}

export function buildModelRouteEntriesFromRoster(
  roster: readonly ModelSitemapRosterEntry[],
  options: ModelRouteProjectionOptions = {},
): CanonicalPathEntry[] {
  const getLastModified = options.getLastModified ?? getModelLastModified;
  const localeExists = options.hasLocale ?? hasModelLocale;

  return roster.filter(isModelRosterEntryInSitemap).map((model) => {
    const slug = model.modelSlug as string;
    return {
      englishPath: `/models/${slug}`,
      lastModified: getLastModified(slug),
      locales: LOCALES.filter((locale) => localeExists(slug, locale)),
    };
  });
}
