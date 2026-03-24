/* eslint-disable no-console */
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AppLocale } from '@/i18n/locales';

const RAW_BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '') || 'http://localhost:3000';
const LOCALES: AppLocale[] = ['fr', 'es'];
const LOCALIZABLE_INTERNAL_PATHS = [
  '/',
  '/models',
  '/status',
  '/company',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies-list',
  '/legal/acceptable-use',
  '/legal/takedown',
  '/legal/mentions',
  '/legal/subprocessors',
];

type Fixture = {
  englishPath: string;
  expectedStatus?: number;
  forbiddenTextByLocale?: Partial<Record<AppLocale, string[]>>;
  requiredTextByLocale?: Partial<Record<AppLocale, string[]>>;
};

type LegacyRedirectFixture = {
  legacyPath: string;
  expectedLocation: string;
};

const FIXTURES: Fixture[] = [
  {
    englishPath: '/status',
    forbiddenTextByLocale: {
      fr: ['Status checks refresh continuously', 'Quick references', 'Operational', 'Degraded', 'Resolved'],
      es: ['Status checks refresh continuously', 'Quick references', 'Operational', 'Degraded', 'Resolved'],
    },
  },
  {
    englishPath: '/legal/privacy',
    forbiddenTextByLocale: {
      fr: ['Version:', 'Effective '],
      es: ['Version:', 'Effective '],
    },
  },
  {
    englishPath: '/legal/terms',
    forbiddenTextByLocale: {
      fr: ['Version:', 'Effective '],
      es: ['Version:', 'Effective '],
    },
  },
  { englishPath: '/legal' },
  { englishPath: '/legal/mentions' },
  { englishPath: '/legal/acceptable-use' },
  { englishPath: '/about' },
  { englishPath: '/company' },
  {
    englishPath: '/docs/does-not-exist',
    expectedStatus: 404,
    requiredTextByLocale: {
      fr: ['Page introuvable'],
      es: ['Pagina no encontrada'],
    },
    forbiddenTextByLocale: {
      fr: ['Page not found', 'Back to homepage', 'Browse video models'],
      es: ['Page not found', 'Back to homepage', 'Browse video models'],
    },
  },
];

const LEGACY_REDIRECTS: LegacyRedirectFixture[] = [
  { legacyPath: '/fr/about', expectedLocation: '/fr/a-propos' },
  { legacyPath: '/es/about', expectedLocation: '/es/acerca-de' },
  { legacyPath: '/fr/company', expectedLocation: '/fr/entreprise' },
  { legacyPath: '/es/company', expectedLocation: '/es/empresa' },
  { legacyPath: '/fr/status', expectedLocation: '/fr/statut' },
  { legacyPath: '/es/status', expectedLocation: '/es/estado' },
];

function buildAbsoluteUrl(pathname: string) {
  return pathname === '/' ? `${BASE_URL}/` : `${BASE_URL}${pathname}`;
}

function stripNonVisibleMarkup(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function normalizeAnchorHref(href: string) {
  try {
    const url = new URL(href, `${BASE_URL}/`);
    if (url.origin !== new URL(`${BASE_URL}/`).origin) {
      return null;
    }
    return url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeResponseLocation(location: string | null) {
  if (!location) return null;
  try {
    const url = new URL(location, `${BASE_URL}/`);
    return url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  } catch {
    return location;
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

async function checkFixture(locale: AppLocale, fixture: Fixture) {
  const localizedPath = localizePathFromEnglish(locale, fixture.englishPath);
  const response = await fetch(buildAbsoluteUrl(localizedPath), {
    headers: { 'Accept-Language': locale },
  });
  const expectedStatus = fixture.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    throw new Error(`Unexpected status for ${localizedPath}: ${response.status} (expected ${expectedStatus})`);
  }

  const html = await response.text();
  const visibleHtml = stripNonVisibleMarkup(html);
  const hrefs = extractAnchorHrefs(visibleHtml)
    .map(normalizeAnchorHref)
    .filter((href): href is string => Boolean(href));
  const issues: string[] = [];

  for (const englishPath of LOCALIZABLE_INTERNAL_PATHS) {
    const localizedTarget = localizePathFromEnglish(locale, englishPath);
    if (localizedTarget === englishPath) {
      continue;
    }
    if (hrefs.includes(englishPath)) {
      issues.push(`found unlocalized internal href ${englishPath} (expected ${localizedTarget})`);
    }
  }

  for (const snippet of fixture.forbiddenTextByLocale?.[locale] ?? []) {
    if (visibleHtml.includes(snippet)) {
      issues.push(`found forbidden visible text: ${JSON.stringify(snippet)}`);
    }
  }
  for (const snippet of fixture.requiredTextByLocale?.[locale] ?? []) {
    if (!visibleHtml.includes(snippet)) {
      issues.push(`missing expected localized text: ${JSON.stringify(snippet)}`);
    }
  }

  return { path: localizedPath, issues };
}

async function checkLegacyRedirect(fixture: LegacyRedirectFixture) {
  const response = await fetch(buildAbsoluteUrl(fixture.legacyPath), {
    headers: { 'Accept-Language': fixture.legacyPath.startsWith('/fr/') ? 'fr' : 'es' },
    redirect: 'manual',
  });
  if (response.status !== 301) {
    throw new Error(`Unexpected status for ${fixture.legacyPath}: ${response.status} (expected 301)`);
  }
  const location = response.headers.get('location');
  const normalizedLocation = normalizeResponseLocation(location);
  if (normalizedLocation !== fixture.expectedLocation) {
    throw new Error(
      `Unexpected redirect for ${fixture.legacyPath}: ${location ?? 'none'} (expected ${fixture.expectedLocation})`
    );
  }
  return fixture.legacyPath;
}

async function main() {
  let hasIssues = false;

  for (const locale of LOCALES) {
    for (const fixture of FIXTURES) {
      try {
        const result = await checkFixture(locale, fixture);
        if (result.issues.length === 0) {
          console.log(`✓ ${result.path}`);
          continue;
        }
        hasIssues = true;
        console.warn(`⚠ ${result.path}`);
        result.issues.forEach((issue) => console.warn(`  - ${issue}`));
      } catch (error) {
        hasIssues = true;
        console.error(`✗ ${locale} ${fixture.englishPath}`, error);
      }
    }
  }

  for (const fixture of LEGACY_REDIRECTS) {
    try {
      const path = await checkLegacyRedirect(fixture);
      console.log(`✓ ${path} -> ${fixture.expectedLocation}`);
    } catch (error) {
      hasIssues = true;
      console.error(`✗ redirect ${fixture.legacyPath}`, error);
    }
  }

  if (hasIssues) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('locale surface check failed', error);
  process.exit(1);
});
