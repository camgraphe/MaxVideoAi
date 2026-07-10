#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  addComparisonHubUrls,
  addComparisonUrls,
  getPublishedComparisonSlugs,
  getPublishedComparisonSlugsForModels,
} from './indexnow-url-selection.mjs';

const SITE = (process.env.SITE || 'https://maxvideoai.com').replace(/\/+$/, '');
const INDEXNOW_PROXY = process.env.INDEXNOW_PROXY || `${SITE}/api/indexnow`;
const BEFORE = process.env.GITHUB_EVENT_BEFORE || '';
const AFTER = process.env.GITHUB_SHA || 'HEAD';
const DRY_RUN = process.argv.includes('--dry-run');

const REPO_ROOT = process.cwd();
const ENGINE_CATALOG_PATH = path.join(REPO_ROOT, 'frontend/config/engine-catalog.json');
const MODEL_ROSTER_PATH = path.join(REPO_ROOT, 'frontend/config/model-roster.json');

function toAbsoluteUrl(pathname) {
  if (!pathname || pathname === '/') return SITE;
  return `${SITE}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
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

function addBestForHubUrls(urls) {
  urls.add(toAbsoluteUrl('/ai-video-engines/best-for'));
  urls.add(toAbsoluteUrl('/fr/comparatif/best-for'));
  urls.add(toAbsoluteUrl('/es/comparativa/best-for'));
}

function addBestForUrl(urls, locale, slug) {
  if (locale === 'en') urls.add(toAbsoluteUrl(`/ai-video-engines/best-for/${slug}`));
  if (locale === 'fr') urls.add(toAbsoluteUrl(`/fr/comparatif/best-for/${slug}`));
  if (locale === 'es') urls.add(toAbsoluteUrl(`/es/comparativa/best-for/${slug}`));
}

function collectUrlsFromChangedFiles(changedFiles) {
  const urls = new Set([
    toAbsoluteUrl('/sitemap.xml'),
    toAbsoluteUrl('/sitemap-video-pages.xml'),
    toAbsoluteUrl('/sitemap-video.xml'),
    toAbsoluteUrl('/sitemap-en.xml'),
    toAbsoluteUrl('/sitemap-fr.xml'),
    toAbsoluteUrl('/sitemap-es.xml'),
    toAbsoluteUrl('/sitemap-models.xml'),
  ]);

  const changedModelSlugs = new Set();
  const indexableModelSlugs = new Set(
    readJson(MODEL_ROSTER_PATH, [])
      .filter((entry) => entry?.modelSlug && entry?.surfaces?.modelPage?.includeInSitemap !== false)
      .map((entry) => entry.modelSlug)
  );
  let comparisonPublicationTouched = false;

  changedFiles.forEach((filePath) => {
    const modelMatch = filePath.match(/^content\/models\/(en|fr|es)\/([a-z0-9-]+)\.json$/);
    if (modelMatch) {
      const [, locale, slug] = modelMatch;
      changedModelSlugs.add(slug);
      if (indexableModelSlugs.has(slug)) {
        addModelUrl(urls, locale, slug);
      }
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
      addBestForHubUrls(urls);
      addBestForUrl(urls, locale, slug);
      return;
    }

    if (
      filePath === 'frontend/config/engine-catalog.json' ||
      filePath === 'frontend/config/compare-config.json' ||
      filePath === 'frontend/config/compare-hub.json'
    ) {
      comparisonPublicationTouched = true;
    }

    if (filePath.startsWith('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/')) {
      addComparisonHubUrls(urls, SITE);
    }

    if (
      filePath.startsWith('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/') ||
      filePath.startsWith('frontend/app/ai-video-engines/best-for/')
    ) {
      addBestForHubUrls(urls);
    }

    if (filePath.startsWith('frontend/app/(localized)/[locale]/(marketing)/models/')) {
      urls.add(toAbsoluteUrl('/models'));
      urls.add(toAbsoluteUrl('/fr/modeles'));
      urls.add(toAbsoluteUrl('/es/modelos'));
    }
  });

  const engineCatalog = readJson(ENGINE_CATALOG_PATH, []);
  if (comparisonPublicationTouched) {
    addBestForHubUrls(urls);
    getPublishedComparisonSlugs(engineCatalog).forEach((slug) => addComparisonUrls(urls, SITE, slug));
  } else if (changedModelSlugs.size > 0) {
    getPublishedComparisonSlugsForModels(engineCatalog, changedModelSlugs).forEach((slug) =>
      addComparisonUrls(urls, SITE, slug)
    );
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

  if (DRY_RUN) {
    process.stdout.write(`[indexnow] dry-run urls=${urls.length}\n`);
    urls.forEach((url) => process.stdout.write(`${url}\n`));
    return;
  }

  await submitUrls(urls);
}

await main();
