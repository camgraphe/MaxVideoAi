/* eslint-disable no-console */
import { localePathnames } from '@/i18n/locales';

type Locale = 'en' | 'fr' | 'es';

const BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const LOCALES: Locale[] = ['en', 'fr', 'es'];
const QA_PAGES = ['/', '/pricing', '/models', '/examples', '/blog', '/blog/compare-ai-video-engines'];
const EXPECTED_HREFLANGS = ['en', 'fr', 'es', 'x-default'];

function buildPath(locale: Locale, path: string) {
  if (locale === 'en') {
    return path === '/' ? '/' : path;
  }
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  if (path === '/') {
    return prefix || '/';
  }
  return `${prefix}${path}`.replace(/\/{2,}/g, '/');
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url, BASE_URL);
    const normalizedPath = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return url;
  }
}

function extractLinks(html: string, rel: 'canonical' | 'alternate') {
  const regex = /<link\s+[^>]*>/gi;
  const results: Array<{ rel: string; href?: string; hreflang?: string }> = [];
  let match;
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
      rel: relValue,
      href: hrefMatch?.[1],
      hreflang: hreflangMatch?.[1]?.toLowerCase(),
    });
  }
  return results;
}

async function checkPage(locale: Locale, path: string) {
  const localizedPath = buildPath(locale, path);
  const url = `${BASE_URL.replace(/\/+$/, '')}${localizedPath === '/' ? '/' : localizedPath}`;
  const response = await fetch(url, { headers: { 'Accept-Language': locale } });
  if (!response.ok) {
    throw new Error(`Failed to load ${url} -> ${response.status}`);
  }
  const html = await response.text();
  const canonicalLinks = extractLinks(html, 'canonical');
  const canonicalHref = canonicalLinks[0]?.href;
  const normalizedCanonical = canonicalHref ? normalizeUrl(canonicalHref) : null;
  const expectedCanonical = normalizeUrl(url);

  const alternateLinks = extractLinks(html, 'alternate');
  const alternatesByLang = Object.fromEntries(
    alternateLinks
      .filter((link) => link.hreflang && link.href)
      .map((link) => [link.hreflang as string, normalizeUrl(link.href as string)])
  );

  const missingHreflang = EXPECTED_HREFLANGS.filter((lang) => !alternatesByLang[lang]);

  const issues: string[] = [];
  if (!normalizedCanonical || normalizedCanonical !== expectedCanonical) {
    issues.push(`canonical mismatch (expected ${expectedCanonical}, found ${normalizedCanonical ?? 'none'})`);
  }
  if (missingHreflang.length > 0) {
    issues.push(`missing hreflang: ${missingHreflang.join(', ')}`);
  }
  return { url, issues };
}

async function main() {
  const results: Array<{ url: string; issues: string[] }> = [];
  for (const locale of LOCALES) {
    for (const page of QA_PAGES) {
      try {
        const result = await checkPage(locale, page);
        results.push(result);
        if (result.issues.length) {
          console.warn(`⚠ ${result.url}`);
          result.issues.forEach((issue) => console.warn(`  - ${issue}`));
        } else {
          console.log(`✓ ${result.url}`);
        }
      } catch (error) {
        console.error(`✗ ${buildPath(locale, page)} failed`, error);
        process.exitCode = 1;
      }
    }
  }

  if (results.some((result) => result.issues.length > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('hreflang check failed', error);
  process.exit(1);
});
