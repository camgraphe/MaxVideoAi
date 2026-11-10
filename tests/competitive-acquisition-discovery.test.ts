import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { NextRequest } from 'next/server';
import robotsParser from 'robots-parser';
import { routing } from '../frontend/i18n/routing';
import { localizePathFromEnglish } from '../frontend/lib/i18n/paths';
import { buildAnalyticsPageContext } from '../frontend/lib/analytics/page-context';
import { normalizePublicQueryParams, shouldMarkTrackingNoindex } from '../frontend/lib/middleware/routing-query';
import { buildRobotsText } from '../frontend/lib/seo/robots-text';
import { projectAttemptBudget } from '../frontend/lib/marketing/project-cost-example';

const origin = 'https://maxvideoai.com';
const pages = [
  ['/openart-alternative', '/fr/openart-alternative', '/es/openart-alternative'],
  ['/blog/compare-ai-video-platforms', '/fr/blog/comparer-plateformes-video-ia', '/es/blog/comparar-plataformas-video-ia'],
  ['/blog/ai-video-project-cost', '/fr/blog/cout-projet-video-ia', '/es/blog/coste-proyecto-video-ia'],
] as const;
const locales = ['en', 'fr', 'es'] as const;

test('acquisition pages resolve to their own translated canonical paths', () => {
  assert.deepEqual(routing.pathnames['/openart-alternative'], { en: '/openart-alternative', fr: '/openart-alternative', es: '/openart-alternative' });
  for (const row of pages) for (const [index, locale] of locales.entries()) {
    assert.equal(localizePathFromEnglish(locale, row[0]), row[index]);
  }
});

test('OpenArt campaign URLs keep approved attribution without exposing arbitrary query data', () => {
  for (const path of pages[0]) {
    const request = new NextRequest(`${origin}${path}?utm_source=reddit&private_prompt=secret`);
    assert.equal(shouldMarkTrackingNoindex(request, path, false), true);
    assert.equal(normalizePublicQueryParams(request, path)?.headers.get('location'), `${origin}${path}?utm_source=reddit`);
    const context = buildAnalyticsPageContext(request.url);
    assert.equal(context?.page_location, `${origin}${path}`);
    assert.ok(!JSON.stringify(context).includes('secret'));
  }
});

test('new campaign pages preserve exact training-crawl boundaries and public search access', () => {
  const rules = robotsParser(`${origin}/robots.txt`, buildRobotsText());
  for (const path of pages.flat()) {
    for (const agent of ['GPTBot', 'ClaudeBot', 'OAI-SearchBot']) assert.equal(rules.isAllowed(`${origin}${path}`, agent), true, `${agent}: ${path}`);
    assert.equal(rules.isAllowed(`${origin}${path}?utm_source=reddit`, 'GPTBot'), false);
  }
  assert.equal(rules.isAllowed(`${origin}/app`, 'OAI-SearchBot'), false);
});

test('the worked budget separates funding, consumed attempts and unused balance', () => {
  assert.deepEqual([1, 3, 6].map(count => projectAttemptBudget(count as 1 | 3 | 6)), [
    { attempts: 1, spentCents: 156, remainingCents: 844 },
    { attempts: 3, spentCents: 468, remainingCents: 532 },
    { attempts: 6, spentCents: 936, remainingCents: 64 },
  ]);
  assert.throws(() => projectAttemptBudget(7 as 1), RangeError);
});

test('sitemaps expose each new canonical URL once with reciprocal languages', async () => {
  const require = createRequire(new URL('../frontend/package.json', import.meta.url));
  const react = require('react') as { cache?: (fn: unknown) => unknown };
  react.cache ??= fn => fn;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const { buildLocaleSitemapXml } = await import('../frontend/lib/sitemapData');
    for (const [index, locale] of locales.entries()) {
      const xml = await buildLocaleSitemapXml(locale);
      for (const row of pages) {
        const entries = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].filter(([entry]) => entry.includes(`<loc>${origin}${row[index]}</loc>`));
        assert.equal(entries.length, 1, row[index]);
        locales.forEach((other, otherIndex) => assert.ok(entries[0][0].includes(`hreflang="${other}" href="${origin}${row[otherIndex]}"`), `${row[index]} → ${other}`));
      }
    }
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
