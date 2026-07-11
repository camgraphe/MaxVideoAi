import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json';
import modelRoster from '../frontend/config/model-roster.json';
import { getHubComparisonSlugsForSitemap } from '../frontend/lib/compare-hub/data.ts';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation.ts';
import * as indexNowSelection from '../scripts/indexnow-url-selection.mjs';

const {
  addComparisonHubUrls,
  addComparisonUrls,
  getPublishedComparisonSlugs,
  getPublishedComparisonSlugsForModels,
} = indexNowSelection;

test('IndexNow comparison slugs are exactly the sitemap publication set', () => {
  assert.deepEqual(getPublishedComparisonSlugs(engineCatalog), getHubComparisonSlugsForSitemap());
});

test('changed models only select published comparisons involving that model', () => {
  const fixtureCatalog = [
    {
      modelSlug: 'alpha',
      surfaces: { compare: { publishedPairs: ['beta'] } },
    },
    {
      modelSlug: 'beta',
      surfaces: { compare: { publishedPairs: ['alpha'] } },
    },
    {
      modelSlug: 'gamma',
      surfaces: { compare: { publishedPairs: [] } },
    },
  ];

  assert.deepEqual(
    getPublishedComparisonSlugsForModels(fixtureCatalog, new Set(['alpha'])),
    ['alpha-vs-beta'],
  );
  assert.deepEqual(getPublishedComparisonSlugsForModels(fixtureCatalog, new Set(['gamma'])), []);
});

test('localized comparison URLs omit selected locales while hub URLs remain unchanged', () => {
  const urls = new Set<string>();
  addComparisonHubUrls(urls, 'https://maxvideoai.com');
  addComparisonUrls(urls, 'https://maxvideoai.com', 'veo-3-1-lite-vs-ltx-2');

  assert.deepEqual(Array.from(urls).sort(), [
    'https://maxvideoai.com/ai-video-engines',
    'https://maxvideoai.com/ai-video-engines/ltx-2-vs-veo-3-1-lite',
    'https://maxvideoai.com/es/comparativa',
    'https://maxvideoai.com/es/comparativa/ltx-2-vs-veo-3-1-lite',
    'https://maxvideoai.com/fr/comparatif',
  ]);
  assert.ok(!urls.has('https://maxvideoai.com/fr/comparatif/ltx-2-vs-veo-3-1-lite'));
  assert.ok(!urls.has('https://maxvideoai.com/fr/ai-video-engines'));
  assert.ok(!urls.has('https://maxvideoai.com/es/ai-video-engines'));
});

test('IndexNow locale selection exactly matches the shared comparison indexation policy', () => {
  assert.equal(
    typeof indexNowSelection.getIndexableComparisonLocalesForIndexNow,
    'function',
    'IndexNow must export its comparison locale resolver',
  );
  const publishedSlugs = getPublishedComparisonSlugs(engineCatalog);

  for (const slug of publishedSlugs) {
    assert.deepEqual(
      indexNowSelection.getIndexableComparisonLocalesForIndexNow(slug),
      getIndexableComparisonLocales(slug),
      `IndexNow locale mismatch for ${slug}`,
    );
  }
});

test('IndexNow command delegates publication selection without synthesizing or truncating combinations', () => {
  const source = readFileSync('scripts/indexnow-submit-changed.mjs', 'utf8');

  assert.match(source, /getPublishedComparisonSlugsForModels/);
  assert.match(source, /getPublishedComparisonSlugs/);
  assert.match(source, /addComparisonHubUrls/);
  assert.match(source, /addComparisonUrls/);
  assert.doesNotMatch(source, /collectCatalogComparisonSlugsForModels/);
  assert.doesNotMatch(source, /MAX_URLS/);
  assert.doesNotMatch(source, /\/fr\/ai-video-engines/);
  assert.doesNotMatch(source, /\/es\/ai-video-engines/);
});

test('IndexNow dry run excludes private, parameterized, redirecting, and noindex URLs', () => {
  const result = spawnSync(process.execPath, ['scripts/indexnow-submit-changed.mjs', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_BEFORE: '',
      GITHUB_SHA: 'HEAD',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const urls = result.stdout
    .split('\n')
    .filter((line) => line.startsWith('https://'))
    .map((url) => new URL(url));
  const comparisonUrls = urls.filter(
    ({ pathname }) =>
      pathname.includes('-vs-') &&
      (pathname.startsWith('/ai-video-engines/') ||
        pathname.startsWith('/fr/comparatif/') ||
        pathname.startsWith('/es/comparativa/')),
  );

  const expectedComparisonUrlCount = getHubComparisonSlugsForSitemap().reduce(
    (count, slug) => count + getIndexableComparisonLocales(slug).length,
    0,
  );
  assert.equal(comparisonUrls.length, expectedComparisonUrlCount);
  urls.forEach(({ pathname, search }) => {
    assert.equal(search, '', `IndexNow must not submit parameterized URL ${pathname}${search}`);
    assert.ok(pathname !== '/app' && !pathname.startsWith('/app/'), `private app URL submitted: ${pathname}`);
    assert.ok(!pathname.startsWith('/video/job_'), `private render URL submitted: ${pathname}`);
    assert.ok(!pathname.startsWith('/fr/ai-video-engines'), `redirecting FR hub submitted: ${pathname}`);
    assert.ok(!pathname.startsWith('/es/ai-video-engines'), `redirecting ES hub submitted: ${pathname}`);
  });

  const sitemapModelSlugs = new Set(
    modelRoster
      .filter((entry) => entry.surfaces?.modelPage?.includeInSitemap !== false)
      .map((entry) => entry.modelSlug),
  );
  urls.forEach(({ pathname }) => {
    const modelMatch = pathname.match(/^\/(?:models|fr\/modeles|es\/modelos)\/([^/]+)$/);
    if (!modelMatch) return;
    assert.ok(sitemapModelSlugs.has(modelMatch[1]), `non-sitemap model submitted: ${pathname}`);
  });
});
