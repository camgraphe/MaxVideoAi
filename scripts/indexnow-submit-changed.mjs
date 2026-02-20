#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SITE = (process.env.SITE || 'https://maxvideoai.com').replace(/\/+$/, '');
const INDEXNOW_PROXY = process.env.INDEXNOW_PROXY || `${SITE}/api/indexnow`;
const BEFORE = process.env.GITHUB_EVENT_BEFORE || '';
const AFTER = process.env.GITHUB_SHA || 'HEAD';
const DRY_RUN = process.argv.includes('--dry-run');
const MAX_URLS = Number.parseInt(process.env.INDEXNOW_MAX_URLS || '200', 10);

const REPO_ROOT = process.cwd();
const COMPARE_CONFIG_PATH = path.join(REPO_ROOT, 'frontend/config/compare-config.json');
const COMPARE_HUB_PATH = path.join(REPO_ROOT, 'frontend/config/compare-hub.json');
const ENGINE_CATALOG_PATH = path.join(REPO_ROOT, 'frontend/config/engine-catalog.json');

function toAbsoluteUrl(pathname) {
  if (!pathname || pathname === '/') return SITE;
  return `${SITE}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function canonicalCompareSlug(slug) {
  if (typeof slug !== 'string' || !slug.includes('-vs-')) return null;
  const [left, right] = slug.split('-vs-');
  if (!left || !right) return null;
  const canonical = [left.trim(), right.trim()].sort((a, b) => a.localeCompare(b));
  return `${canonical[0]}-vs-${canonical[1]}`;
}

function canonicalCompareSlugFromPair(left, right) {
  if (!left || !right) return null;
  return canonicalCompareSlug(`${left}-vs-${right}`);
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeGitChangedFiles(before, after) {
  if (!before || /^0+$/.test(before)) {
    return execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  try {
    return execSync(`git diff --name-only ${before} ${after}`, { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return execSync(`git diff --name-only HEAD~1 ${after}`, { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

function collectAllComparisonSlugs() {
  const slugs = new Set();
  const compareConfig = readJson(COMPARE_CONFIG_PATH, {});
  const compareHub = readJson(COMPARE_HUB_PATH, {});

  const addSlug = (slug) => {
    const normalized = canonicalCompareSlug(slug);
    if (normalized) slugs.add(normalized);
  };

  const addPair = (left, right) => {
    const normalized = canonicalCompareSlugFromPair(left, right);
    if (normalized) slugs.add(normalized);
  };

  (compareConfig.trophyComparisons || []).forEach(addSlug);
  Object.keys(compareConfig.relatedComparisons || {}).forEach(addSlug);
  Object.values(compareConfig.relatedComparisons || {}).forEach((list) => (list || []).forEach(addSlug));
  Object.keys(compareConfig.showdowns || {}).forEach(addSlug);

  (compareHub.popularComparisons || []).forEach((entry) => addPair(entry?.left, entry?.right));
  (compareHub.useCaseBuckets || []).forEach((bucket) =>
    (bucket?.pairs || []).forEach((entry) => addPair(entry?.left, entry?.right))
  );

  return slugs;
}

function collectCatalogComparisonSlugsForModels(changedModelSlugs) {
  const slugs = new Set();
  const catalog = readJson(ENGINE_CATALOG_PATH, []);
  const excluded = new Set(['nano-banana', 'nano-banana-pro']);
  const eligibleStatuses = new Set(['live', 'early_access']);

  const eligibleModels = (Array.isArray(catalog) ? catalog : [])
    .filter((entry) => {
      const slug = entry?.modelSlug;
      const status = String(entry?.engine?.status || '').toLowerCase();
      return Boolean(slug) && !excluded.has(slug) && eligibleStatuses.has(status);
    })
    .map((entry) => entry.modelSlug);

  const eligibleSet = new Set(eligibleModels);
  const changedEligible = Array.from(changedModelSlugs).filter((slug) => eligibleSet.has(slug));

  changedEligible.forEach((changedSlug) => {
    eligibleModels.forEach((otherSlug) => {
      if (otherSlug === changedSlug) return;
      const canonical = canonicalCompareSlugFromPair(changedSlug, otherSlug);
      if (canonical) slugs.add(canonical);
    });
  });

  return slugs;
}

function addCompareUrlsForSlug(urls, comparisonSlug) {
  urls.add(toAbsoluteUrl(`/ai-video-engines/${comparisonSlug}`));
  urls.add(toAbsoluteUrl(`/fr/comparatif/${comparisonSlug}`));
  urls.add(toAbsoluteUrl(`/es/comparativa/${comparisonSlug}`));
}

function addModelUrl(urls, locale, slug) {
  if (locale === 'en') urls.add(toAbsoluteUrl(`/models/${slug}`));
  if (locale === 'fr') urls.add(toAbsoluteUrl(`/fr/modeles/${slug}`));
  if (locale === 'es') urls.add(toAbsoluteUrl(`/es/modelos/${slug}`));
}

function addBlogUrl(urls, locale, slug) {
  if (locale === 'en') urls.add(toAbsoluteUrl(`/blog/${slug}`));
  if (locale === 'fr') urls.add(toAbsoluteUrl(`/fr/blog/${slug}`));
  if (locale === 'es') urls.add(toAbsoluteUrl(`/es/blog/${slug}`));
}

function addDocsUrl(urls, locale, slug) {
  if (locale === 'en') urls.add(toAbsoluteUrl(`/docs/${slug}`));
  if (locale === 'fr') urls.add(toAbsoluteUrl(`/fr/docs/${slug}`));
  if (locale === 'es') urls.add(toAbsoluteUrl(`/es/docs/${slug}`));
}

function addBestForUrl(urls, locale, slug) {
  if (locale === 'en') urls.add(toAbsoluteUrl(`/ai-video-engines/best-for/${slug}`));
  if (locale === 'fr') urls.add(toAbsoluteUrl(`/fr/ai-video-engines/best-for/${slug}`));
  if (locale === 'es') urls.add(toAbsoluteUrl(`/es/ai-video-engines/best-for/${slug}`));
}

function collectUrlsFromChangedFiles(changedFiles) {
  const urls = new Set([
    toAbsoluteUrl('/sitemap.xml'),
    toAbsoluteUrl('/sitemap-video.xml'),
    toAbsoluteUrl('/sitemap-en.xml'),
    toAbsoluteUrl('/sitemap-fr.xml'),
    toAbsoluteUrl('/sitemap-es.xml'),
    toAbsoluteUrl('/sitemap-models.xml'),
  ]);

  const changedModelSlugs = new Set();
  let compareConfigTouched = false;

  changedFiles.forEach((filePath) => {
    const modelMatch = filePath.match(/^content\/models\/(en|fr|es)\/([a-z0-9-]+)\.json$/);
    if (modelMatch) {
      const [, locale, slug] = modelMatch;
      changedModelSlugs.add(slug);
      addModelUrl(urls, locale, slug);
      return;
    }

    const blogMatch = filePath.match(/^content\/(en|fr|es)\/blog\/([^/]+)\.mdx$/);
    if (blogMatch) {
      const [, locale, slug] = blogMatch;
      addBlogUrl(urls, locale, slug);
      return;
    }

    const docsRootMatch = filePath.match(/^content\/docs\/([^/]+)\.mdx$/);
    if (docsRootMatch) {
      const [, slug] = docsRootMatch;
      addDocsUrl(urls, 'en', slug);
      return;
    }

    const docsLocaleMatch = filePath.match(/^content\/(fr|es)\/docs\/([^/]+)\.mdx$/);
    if (docsLocaleMatch) {
      const [, locale, slug] = docsLocaleMatch;
      addDocsUrl(urls, locale, slug);
      return;
    }

    const bestForMatch = filePath.match(/^content\/(en|fr|es)\/best-for\/([^/]+)\.mdx$/);
    if (bestForMatch) {
      const [, locale, slug] = bestForMatch;
      addBestForUrl(urls, locale, slug);
      return;
    }

    if (filePath === 'frontend/config/compare-config.json' || filePath === 'frontend/config/compare-hub.json') {
      compareConfigTouched = true;
    }

    if (filePath.startsWith('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/')) {
      urls.add(toAbsoluteUrl('/ai-video-engines'));
      urls.add(toAbsoluteUrl('/fr/ai-video-engines'));
      urls.add(toAbsoluteUrl('/es/ai-video-engines'));
    }

    if (filePath.startsWith('frontend/app/(localized)/[locale]/(marketing)/models/')) {
      urls.add(toAbsoluteUrl('/models'));
      urls.add(toAbsoluteUrl('/fr/modeles'));
      urls.add(toAbsoluteUrl('/es/modelos'));
    }
  });

  const comparisonSlugs = collectAllComparisonSlugs();
  const catalogDerivedComparisonSlugs = collectCatalogComparisonSlugsForModels(changedModelSlugs);
  if (compareConfigTouched) {
    comparisonSlugs.forEach((slug) => addCompareUrlsForSlug(urls, slug));
  } else if (changedModelSlugs.size > 0) {
    const slugsToNotify =
      catalogDerivedComparisonSlugs.size > 0 ? catalogDerivedComparisonSlugs : comparisonSlugs;
    slugsToNotify.forEach((slug) => {
      const [left, right] = slug.split('-vs-');
      if (changedModelSlugs.has(left) || changedModelSlugs.has(right)) {
        addCompareUrlsForSlug(urls, slug);
      }
    });
  }

  return Array.from(urls).sort((a, b) => a.localeCompare(b));
}

async function submitUrls(urls) {
  let okCount = 0;
  let failCount = 0;

  for (const url of urls) {
    process.stdout.write(`[indexnow] submit ${url}\n`);
    const response = await fetch(INDEXNOW_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (response.ok) {
      okCount += 1;
      continue;
    }
    failCount += 1;
    const detail = (await response.text().catch(() => '')).trim();
    process.stderr.write(`[indexnow] failed ${response.status} ${url}${detail ? ` — ${detail}` : ''}\n`);
  }

  process.stdout.write(`[indexnow] completed ok=${okCount} failed=${failCount} total=${urls.length}\n`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const changedFiles = safeGitChangedFiles(BEFORE, AFTER);
  process.stdout.write(`[indexnow] changed_files=${changedFiles.length}\n`);

  const urls = collectUrlsFromChangedFiles(changedFiles);
  const limitedUrls = urls.slice(0, Number.isFinite(MAX_URLS) && MAX_URLS > 0 ? MAX_URLS : 200);
  if (urls.length > limitedUrls.length) {
    process.stdout.write(`[indexnow] truncating url list ${urls.length} -> ${limitedUrls.length}\n`);
  }

  if (DRY_RUN) {
    process.stdout.write(`[indexnow] dry-run urls=${limitedUrls.length}\n`);
    limitedUrls.forEach((url) => process.stdout.write(`${url}\n`));
    return;
  }

  await submitUrls(limitedUrls);
}

await main();
