/* eslint-disable no-console */
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';

export const RAW_BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
export const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '') || 'http://localhost:3000';
export const EXPECTED_CANONICAL_BASE_URL =
  (process.env.QA_EXPECT_CANONICAL_BASE_URL ?? BASE_URL).replace(/\/+$/, '') || BASE_URL;
const BASE_ORIGIN = new URL(`${BASE_URL}/`).origin;
const EXPECTED_HREFLANGS = ['en', 'en-gb', 'fr-fr', 'es-419', 'x-default'] as const;

export type LocaleFixture = {
  englishPath: string;
  requiredTextByLocale?: Partial<Record<AppLocale, string[]>>;
  forbiddenTextByLocale?: Partial<Record<AppLocale, string[]>>;
  localizableInternalPaths?: string[];
  skipMetadataDiff?: boolean;
};

type ExtractedLink = {
  href?: string;
  hreflang?: string;
};

type PageAnalysis = {
  localizedPath: string;
  html: string;
  visibleHtml: string;
  hrefs: string[];
  title: string | null;
  description: string | null;
  canonicalHref: string | null;
  alternatesByLang: Record<string, string>;
};

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url, `${BASE_URL}/`);
    const normalizedPath = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return url;
  }
}

function buildAbsoluteUrl(pathname: string, baseUrl = BASE_URL) {
  if (!pathname || pathname === '/') {
    return `${baseUrl}/`;
  }
  return `${baseUrl}${pathname}`;
}

function stripNonVisibleMarkup(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function normalizeInternalHref(href: string) {
  try {
    const parsed = new URL(href, `${BASE_URL}/`);
    if (parsed.origin !== BASE_ORIGIN) {
      return null;
    }
    return parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function extractAnchorHrefs(html: string) {
  const hrefs: string[] = [];
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function extractLinks(html: string, rel: 'canonical' | 'alternate') {
  const regex = /<link\s+[^>]*>/gi;
  const results: ExtractedLink[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const relMatch = /rel=["']([^"']+)["']/i.exec(tag);
    if (!relMatch) continue;
    const relValue = relMatch[1].toLowerCase();
    if (rel === 'canonical' && relValue !== 'canonical') continue;
    if (rel === 'alternate' && !relValue.includes('alternate')) continue;
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    const hreflangMatch = /hreflang=["']([^"']+)["']/i.exec(tag);
    results.push({
      href: hrefMatch?.[1],
      hreflang: hreflangMatch?.[1]?.toLowerCase(),
    });
  }
  return results;
}

function extractTitle(html: string) {
  return /<title>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
}

function extractDescription(html: string) {
  return /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
}

async function fetchHtml(pathname: string, locale: AppLocale | 'en') {
  const response = await fetch(buildAbsoluteUrl(pathname), {
    headers: { 'Accept-Language': locale },
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${pathname}: ${response.status}`);
  }
  return response.text();
}

async function analyzeLocalizedPage(locale: AppLocale, englishPath: string): Promise<PageAnalysis> {
  const localizedPath = localizePathFromEnglish(locale, englishPath);
  const html = await fetchHtml(localizedPath, locale);
  const visibleHtml = stripNonVisibleMarkup(html);
  const hrefs = extractAnchorHrefs(visibleHtml)
    .map(normalizeInternalHref)
    .filter((href): href is string => Boolean(href));
  const canonicalHref = extractLinks(html, 'canonical')[0]?.href ?? null;
  const alternatesByLang = Object.fromEntries(
    extractLinks(html, 'alternate')
      .filter((link) => link.hreflang && link.href)
      .map((link) => [link.hreflang as string, normalizeUrl(link.href as string)])
  );

  return {
    localizedPath,
    html,
    visibleHtml,
    hrefs,
    title: extractTitle(html),
    description: extractDescription(html),
    canonicalHref,
    alternatesByLang,
  };
}

function checkCanonicalAndHreflang(page: PageAnalysis) {
  const issues: string[] = [];
  const expectedCanonical = normalizeUrl(buildAbsoluteUrl(page.localizedPath, EXPECTED_CANONICAL_BASE_URL));
  const canonicalHref = page.canonicalHref ? normalizeUrl(page.canonicalHref) : null;
  if (canonicalHref !== expectedCanonical) {
    issues.push(`canonical mismatch (expected ${expectedCanonical}, found ${canonicalHref ?? 'none'})`);
  }

  const missing = EXPECTED_HREFLANGS.filter((lang) => !page.alternatesByLang[lang]);
  if (missing.length > 0) {
    issues.push(`missing hreflang: ${missing.join(', ')}`);
  }
  return issues;
}

function checkInternalHrefs(locale: AppLocale, hrefs: string[], englishPaths: string[] = []) {
  const issues: string[] = [];
  for (const englishPath of englishPaths) {
    const localizedTarget = localizePathFromEnglish(locale, englishPath);
    if (localizedTarget === englishPath) {
      continue;
    }
    if (hrefs.includes(englishPath)) {
      issues.push(`found unlocalized internal href ${englishPath} (expected ${localizedTarget})`);
    }
  }
  return issues;
}

function checkVisibleText(
  locale: AppLocale,
  visibleHtml: string,
  required: LocaleFixture['requiredTextByLocale'],
  forbidden: LocaleFixture['forbiddenTextByLocale']
) {
  const issues: string[] = [];
  for (const snippet of required?.[locale] ?? []) {
    if (!visibleHtml.includes(snippet)) {
      issues.push(`missing expected localized text: ${JSON.stringify(snippet)}`);
    }
  }
  for (const snippet of forbidden?.[locale] ?? []) {
    if (visibleHtml.includes(snippet)) {
      issues.push(`found forbidden visible text: ${JSON.stringify(snippet)}`);
    }
  }
  return issues;
}

async function checkMetadataDiff(locale: AppLocale, englishPath: string, localizedPage: PageAnalysis) {
  if (locale === 'en') {
    return [];
  }

  const issues: string[] = [];
  const englishHtml = await fetchHtml(englishPath, 'en');
  const englishTitle = extractTitle(englishHtml);
  const englishDescription = extractDescription(englishHtml);

  if (localizedPage.title && englishTitle && localizedPage.title === englishTitle) {
    issues.push(`title matches EN exactly on localized page: ${JSON.stringify(localizedPage.title)}`);
  }
  if (localizedPage.description && englishDescription && localizedPage.description === englishDescription) {
    issues.push(`description matches EN exactly on localized page: ${JSON.stringify(localizedPage.description)}`);
  }

  return issues;
}

export async function runLocaleFixtureSet(familyName: string, fixtures: LocaleFixture[]) {
  let hasIssues = false;

  for (const locale of ['fr', 'es'] as AppLocale[]) {
    for (const fixture of fixtures) {
      try {
        const page = await analyzeLocalizedPage(locale, fixture.englishPath);
        const issues = [
          ...checkCanonicalAndHreflang(page),
          ...checkInternalHrefs(locale, page.hrefs, fixture.localizableInternalPaths),
          ...checkVisibleText(locale, page.visibleHtml, fixture.requiredTextByLocale, fixture.forbiddenTextByLocale),
          ...(fixture.skipMetadataDiff ? [] : await checkMetadataDiff(locale, fixture.englishPath, page)),
        ];

        if (issues.length === 0) {
          console.log(`✓ ${page.localizedPath}`);
          continue;
        }
        hasIssues = true;
        console.warn(`⚠ ${page.localizedPath}`);
        issues.forEach((issue) => console.warn(`  - ${issue}`));
      } catch (error) {
        hasIssues = true;
        console.error(`✗ ${familyName} ${locale} ${fixture.englishPath}`, error);
      }
    }
  }

  if (hasIssues) {
    process.exit(1);
  }
}
