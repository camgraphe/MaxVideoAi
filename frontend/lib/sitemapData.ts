import { defaultLocale, type AppLocale } from '@/i18n/locales';
import modelRoster from '@/config/model-roster.json';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { HREFLANG_VARIANTS } from '@/lib/seo/alternateLocales';
import { getCanonicalPathEntries } from './sitemap/route-discovery';
import {
  formatLastModified,
  getLatestEntryDate,
  getManualSitemapLastModified,
  getModelLastModified,
  getModelsSitemapLastModified,
  getSitemapFileName,
  getVideoPagesSitemapLastModified,
  getVideoSitemapLastModified,
} from './sitemap/lastmod';
import { hasModelLocale } from './sitemap/model-locales';
import { LOCALES, LOCALE_SITEMAP_PATHS, type SitemapEntry } from './sitemap/types';
import { buildAbsoluteUrl, escapeXml } from './sitemap/xml';

export type { SitemapEntry };
export { escapeXml, LOCALES, LOCALE_SITEMAP_PATHS };

export async function getLocaleSitemapEntries(locale: AppLocale): Promise<SitemapEntry[]> {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  const canonicalEntries = await getCanonicalPathEntries();

  const addLocalizedPath = (
    englishPath: string,
    lastModified?: string,
    availableLocales?: AppLocale[],
    disableAlternates?: boolean
  ) => {
    if (availableLocales && !availableLocales.includes(locale)) {
      return;
    }
    const localizedPath = localizePathFromEnglish(locale, englishPath);
    const url = buildAbsoluteUrl(localizedPath);
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    entries.push({
      url,
      lastModified: formatLastModified(lastModified),
      englishPath,
      locales: availableLocales,
      disableAlternates,
    });
  };

  canonicalEntries.forEach((entry) => {
    addLocalizedPath(entry.englishPath, entry.lastModified, entry.locales, entry.disableAlternates);
  });

  return entries;
}

export async function buildLocaleSitemapXml(locale: AppLocale): Promise<string> {
  const entries = await getLocaleSitemapEntries(locale);
  const body = entries
    .map((entry) => {
      const lines = [`  <url>`, `    <loc>${escapeXml(entry.url)}</loc>`];
      if (entry.lastModified) {
        lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
      }
      if (!entry.disableAlternates) {
        const availableLocales = entry.locales?.length ? entry.locales : LOCALES;
        const hrefByLocale = new Map(
          availableLocales.map((availableLocale) => [
            availableLocale,
            buildAbsoluteUrl(localizePathFromEnglish(availableLocale, entry.englishPath)),
          ] as const)
        );
        const xDefaultHref =
          hrefByLocale.get(defaultLocale) ??
          hrefByLocale.get(locale) ??
          hrefByLocale.values().next().value ??
          buildAbsoluteUrl(entry.englishPath);
        const alternateLinks = HREFLANG_VARIANTS
          .filter((variant) => hrefByLocale.has(variant.locale))
          .map(
            (variant) =>
              `<xhtml:link rel="alternate" hreflang="${escapeXml(variant.hreflang)}" href="${escapeXml(
                hrefByLocale.get(variant.locale) as string
              )}" />`
          )
          .concat(
            xDefaultHref ? [`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultHref)}" />`] : []
          )
          .join('\n    ');
        lines.push(`    ${alternateLinks}`);
      }
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>`;
}

export async function buildSitemapIndexXml(): Promise<string> {
  const entries: Array<{ loc: string; lastModified?: string }> = [];

  for (const locale of LOCALES) {
    const localeEntries = await getLocaleSitemapEntries(locale);
    const sitemapPath = LOCALE_SITEMAP_PATHS[locale];
    const fileName = getSitemapFileName(sitemapPath);
    const computedLastMod = getLatestEntryDate(localeEntries);
    entries.push({
      loc: buildAbsoluteUrl(sitemapPath),
      lastModified: getManualSitemapLastModified(fileName) ?? computedLastMod,
    });
  }

  const modelsPath = '/sitemap-models.xml';
  const modelsFileName = getSitemapFileName(modelsPath);
  const modelsLastMod = getManualSitemapLastModified(modelsFileName) ?? getModelsSitemapLastModified();
  entries.push({
    loc: buildAbsoluteUrl(modelsPath),
    lastModified: modelsLastMod,
  });

  const videoPagesPath = '/sitemap-video-pages.xml';
  entries.push({
    loc: buildAbsoluteUrl(videoPagesPath),
    lastModified: await getVideoPagesSitemapLastModified(),
  });

  const videoPath = '/sitemap-video.xml';
  entries.push({
    loc: buildAbsoluteUrl(videoPath),
    lastModified: await getVideoSitemapLastModified(),
  });

  const body = entries
    .map(({ loc, lastModified }) => {
      const lastmodLine = lastModified ? `    <lastmod>${escapeXml(lastModified)}</lastmod>\n` : '';
      return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n${lastmodLine}  </sitemap>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export async function buildModelsSitemapXml(): Promise<string> {
  const entries: string[] = [];

  modelRoster.forEach((model) => {
    if (!model?.modelSlug || model?.surfaces?.modelPage?.includeInSitemap === false) {
      return;
    }
    const englishPath = `/models/${model.modelSlug}`;
    const lastModified = getModelLastModified(model.modelSlug);
    const localizedEntries = LOCALES.filter((locale) => hasModelLocale(model.modelSlug, locale)).map((locale) => ({
      locale,
      url: buildAbsoluteUrl(localizePathFromEnglish(locale, englishPath)),
    }));
    if (!localizedEntries.some((entry) => entry.locale === 'en')) {
      localizedEntries.push({ locale: 'en', url: buildAbsoluteUrl(englishPath) });
    }
    const xDefaultHref =
      localizedEntries.find((entry) => entry.locale === defaultLocale)?.url ?? localizedEntries[0]?.url ?? buildAbsoluteUrl(englishPath);
    localizedEntries.forEach((record) => {
      const hrefByLocale = new Map(localizedEntries.map((entry) => [entry.locale, entry.url] as const));
      const alternateLinks = HREFLANG_VARIANTS
        .filter((variant) => hrefByLocale.has(variant.locale))
        .map(
          (variant) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(variant.hreflang)}" href="${escapeXml(
              hrefByLocale.get(variant.locale) as string
            )}" />`
        )
        .concat(
          xDefaultHref ? [`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultHref)}" />`] : []
        )
        .join('\n    ');
      const lines = [`  <url>`, `    <loc>${escapeXml(record.url)}</loc>`];
      if (lastModified) {
        lines.push(`    <lastmod>${escapeXml(lastModified)}</lastmod>`);
      }
      lines.push(`    ${alternateLinks}`, '  </url>');
      entries.push(lines.join('\n'));
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join(
    '\n'
  )}\n</urlset>`;
}
