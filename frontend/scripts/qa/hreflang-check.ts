/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { localizedSlugs, type LocalizedSlugKey } from '@/lib/i18nSlugs';

type Locale = AppLocale;

const RAW_BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '') || 'http://localhost:3000';
const LOCALES: Locale[] = ['en', 'fr', 'es'];
const EXPECTED_HREFLANGS = ['en', 'en-gb', 'fr-fr', 'es-es', 'x-default'] as const;

type PageConfig =
  | { kind: 'home'; label: string }
  | { kind: 'slug'; slugKey: LocalizedSlugKey; label: string }
  | { kind: 'blog-post'; canonicalSlug: string; label: string };

const QA_PAGES: PageConfig[] = [
  { kind: 'home', label: '/' },
  { kind: 'slug', slugKey: 'pricing', label: '/pricing' },
  { kind: 'slug', slugKey: 'models', label: '/models' },
  { kind: 'slug', slugKey: 'gallery', label: '/examples' },
  { kind: 'slug', slugKey: 'blog', label: '/blog' },
  { kind: 'blog-post', canonicalSlug: 'compare-ai-video-engines', label: '/blog/compare-ai-video-engines' },
];

const BLOG_ROOT = path.resolve(process.cwd(), '..', 'content');
const BLOG_CACHE = new Map<Locale, Record<string, string>>();

function normalizeSegment(segment?: string | null) {
  if (!segment) return '';
  return segment.replace(/^\/+|\/+$/g, '');
}

function buildPath(prefix?: string, slug?: string) {
  const parts = [normalizeSegment(prefix), normalizeSegment(slug)].filter(Boolean);
  if (!parts.length) {
    return '/';
  }
  return `/${parts.join('/')}`;
}

function buildAbsoluteUrl(pathname: string) {
  if (!pathname || pathname === '/') {
    return `${BASE_URL}/`;
  }
  return `${BASE_URL}${pathname}`;
}

function loadBlogSlugMap(locale: Locale) {
  if (BLOG_CACHE.has(locale)) {
    return BLOG_CACHE.get(locale)!;
  }
  const dir = path.join(BLOG_ROOT, locale, 'blog');
  const map: Record<string, string> = {};
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) {
        continue;
      }
      const fullPath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const { data } = matter(raw);
        const slug = typeof data.slug === 'string' ? data.slug : file.replace(/\.(md|mdx)$/i, '');
        const canonical = typeof data.canonicalSlug === 'string' ? data.canonicalSlug : slug;
        if (canonical) {
          map[canonical] = slug;
        }
      } catch {
        // ignore malformed files for QA
      }
    }
  }
  BLOG_CACHE.set(locale, map);
  return map;
}

function resolveBlogSlug(locale: Locale, canonicalSlug: string) {
  if (locale === 'en') {
    return canonicalSlug;
  }
  const map = loadBlogSlugMap(locale);
  return map[canonicalSlug] ?? canonicalSlug;
}

function getRequestLocaleSegment(locale: Locale) {
  const configured = normalizeSegment(localePathnames[locale]);
  if (configured) {
    return configured;
  }
  return '';
}

function resolvePaths(locale: Locale, page: PageConfig) {
  const canonicalPrefix = normalizeSegment(localePathnames[locale]);
  const requestPrefix = getRequestLocaleSegment(locale);

  if (page.kind === 'home') {
    return {
      label: page.label,
      canonicalPath: buildPath(canonicalPrefix),
      requestPath: buildPath(requestPrefix),
    };
  }

  if (page.kind === 'slug') {
    const slug = localizedSlugs[locale][page.slugKey];
    return {
      label: page.label,
      canonicalPath: buildPath(canonicalPrefix, slug),
      requestPath: buildPath(requestPrefix, slug),
    };
  }

  // blog post
  const localizedSlug = resolveBlogSlug(locale, page.canonicalSlug);
  const blogPath = `blog/${localizedSlug}`;
  return {
    label: page.label,
    canonicalPath: buildPath(canonicalPrefix, blogPath),
    requestPath: buildPath(requestPrefix, blogPath),
  };
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url, `${BASE_URL}/`);
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

async function checkPage(locale: Locale, page: PageConfig) {
  const resolved = resolvePaths(locale, page);
  const url = buildAbsoluteUrl(resolved.requestPath);
  const response = await fetch(url, { headers: { 'Accept-Language': locale } });
  if (!response.ok) {
    throw new Error(`Failed to load ${url} -> ${response.status}`);
  }
  const html = await response.text();
  const canonicalLinks = extractLinks(html, 'canonical');
  const canonicalHref = canonicalLinks[0]?.href;
  const normalizedCanonical = canonicalHref ? normalizeUrl(canonicalHref) : null;
  const expectedCanonical = normalizeUrl(resolved.canonicalPath);

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
  return { url, issues, label: resolved.label };
}

async function main() {
  const results: Array<{ url: string; issues: string[]; label: string }> = [];
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
        const resolved = resolvePaths(locale, page);
        console.error(`✗ ${resolved.requestPath} failed`, error);
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
