/* eslint-disable no-console */
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AppLocale } from '@/i18n/locales';

const RAW_BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '') || 'http://localhost:3000';
const LOCALES: AppLocale[] = ['fr', 'es'];
const LOCALIZABLE_INTERNAL_PATHS = [
  '/',
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
  forbiddenTextByLocale?: Partial<Record<AppLocale, string[]>>;
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
  { englishPath: '/company' },
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
  if (!response.ok) {
    throw new Error(`Failed to load ${localizedPath}: ${response.status}`);
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

  return { path: localizedPath, issues };
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

  if (hasIssues) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('locale surface check failed', error);
  process.exit(1);
});
