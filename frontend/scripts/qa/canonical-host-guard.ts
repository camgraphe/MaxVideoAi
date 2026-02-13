/* eslint-disable no-console */
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { CANONICAL_PRODUCTION_ORIGIN } from '@/lib/siteOrigin';

const RAW_BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '') || 'http://localhost:3000';
const EXPECTED_HOST =
  (process.env.QA_EXPECT_CANONICAL_HOST ?? new URL(CANONICAL_PRODUCTION_ORIGIN).hostname).toLowerCase();

const HOME_PATHS = ['/', '/fr', '/es'] as const;

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function extractLinkTag(html: string, rel: 'canonical' | 'alternate', hreflang?: string): string | null {
  const tags = html.match(/<link\s+[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const relMatch = /rel=["']([^"']+)["']/i.exec(tag);
    if (!relMatch) continue;
    const relValue = relMatch[1].toLowerCase();
    if (rel === 'canonical' && relValue !== 'canonical') continue;
    if (rel === 'alternate' && !relValue.includes('alternate')) continue;
    if (hreflang) {
      const hreflangMatch = /hreflang=["']([^"']+)["']/i.exec(tag);
      if (!hreflangMatch || hreflangMatch[1].toLowerCase() !== hreflang.toLowerCase()) {
        continue;
      }
    }
    return tag;
  }
  return null;
}

function extractHref(linkTag: string | null): string | null {
  if (!linkTag) return null;
  const hrefMatch = /href=["']([^"']+)["']/i.exec(linkTag);
  return hrefMatch?.[1] ?? null;
}

function parseUrl(candidate: string | null): URL | null {
  if (!candidate) return null;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

async function checkPath(pathname: (typeof HOME_PATHS)[number]) {
  const response = await fetch(`${BASE_URL}${pathname}`, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pathname}: ${response.status}`);
  }
  const html = await response.text();
  const canonicalHref = extractHref(extractLinkTag(html, 'canonical'));
  const xDefaultHref = extractHref(extractLinkTag(html, 'alternate', 'x-default'));
  const canonicalUrl = parseUrl(canonicalHref);
  const xDefaultUrl = parseUrl(xDefaultHref);

  const issues: string[] = [];
  if (!canonicalUrl) {
    issues.push('missing canonical link');
  } else {
    if (normalizeHost(canonicalUrl.hostname) !== normalizeHost(EXPECTED_HOST)) {
      issues.push(`canonical host must be ${EXPECTED_HOST}, found ${canonicalUrl.hostname}`);
    }
    if (normalizePathname(canonicalUrl.pathname) !== normalizePathname(pathname)) {
      issues.push(`canonical path mismatch (expected ${pathname}, found ${canonicalUrl.pathname})`);
    }
  }

  if (!xDefaultUrl) {
    issues.push('missing x-default hreflang link');
  } else {
    if (normalizeHost(xDefaultUrl.hostname) !== normalizeHost(EXPECTED_HOST)) {
      issues.push(`x-default host must be ${EXPECTED_HOST}, found ${xDefaultUrl.hostname}`);
    }
    if (normalizePathname(xDefaultUrl.pathname) !== '/') {
      issues.push(`x-default path must be /, found ${xDefaultUrl.pathname}`);
    }
  }

  return issues;
}

async function main() {
  const metaBaseHost = normalizeHost(new URL(SITE_BASE_URL).hostname);
  const expectedHostNormalized = normalizeHost(EXPECTED_HOST);

  if (process.env.NODE_ENV === 'production' && metaBaseHost !== expectedHostNormalized) {
    console.error(
      `metadataBase guard failed in production: SITE_BASE_URL host is ${metaBaseHost}, expected ${expectedHostNormalized}`
    );
    process.exit(1);
  }

  let hasIssues = false;
  for (const path of HOME_PATHS) {
    try {
      const issues = await checkPath(path);
      if (issues.length === 0) {
        console.log(`✓ ${path}`);
        continue;
      }
      hasIssues = true;
      console.warn(`⚠ ${path}`);
      issues.forEach((issue) => console.warn(`  - ${issue}`));
    } catch (error) {
      hasIssues = true;
      console.error(`✗ ${path}`, error);
    }
  }

  if (hasIssues) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('canonical host guard failed', error);
  process.exit(1);
});
