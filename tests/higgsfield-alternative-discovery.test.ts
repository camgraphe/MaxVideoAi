import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { NextRequest } from 'next/server';
import robotsParser from 'robots-parser';
import mcpPublication from '../frontend/config/mcp-publication.json' with { type: 'json' };
import { routing } from '../frontend/i18n/routing';
import { localizeMarketingHref } from '../frontend/lib/i18n/marketing-locale-switch';
import { normalizePublicQueryParams, shouldMarkTrackingNoindex } from '../frontend/lib/middleware/routing-query';
import { buildLlmsText } from '../frontend/lib/seo/llms-text';
import { buildRobotsText } from '../frontend/lib/seo/robots-text';
import { middleware } from '../frontend/middleware';

const origin = 'https://maxvideoai.com';
const path = '/higgsfield-alternative';
const localizedPaths = { en: path, fr: `/fr${path}`, es: `/es${path}` } as const;
const locales = ['en', 'fr', 'es'] as const;

test('Higgsfield alternative uses the same slug in all three marketing locales', () => {
  assert.deepEqual(routing.pathnames[path], { en: path, fr: path, es: path });
  for (const locale of locales) {
    assert.equal(localizeMarketingHref(path, locale), localizedPaths[locale]);
  }
});

test('Higgsfield alternative keeps campaign tracking and avoids indexing query variants', () => {
  for (const locale of locales) {
    const canonical = `${origin}${localizedPaths[locale]}`;
    const tracked = new NextRequest(`${canonical}?utm_source=reddit&unused=1`);
    assert.equal(shouldMarkTrackingNoindex(tracked, tracked.nextUrl.pathname, false), true);
    const normalized = normalizePublicQueryParams(tracked, tracked.nextUrl.pathname);
    assert.equal(normalized?.headers.get('location'), `${canonical}?utm_source=reddit`);
  }
});

test('comparison downloads keep format and locale at the root handler', async () => {
  const download = new NextRequest(`${origin}${path}/comparison?format=png&locale=fr`, {
    headers: { host: 'maxvideoai.com', 'user-agent': 'Mozilla/5.0' },
  });
  const response = await middleware(download);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
});

test('llms.txt lists the English Higgsfield comparison once', () => {
  const text = buildLlmsText(mcpPublication);
  assert.equal(text.split(`](${origin}${path})`).length - 1, 1);
});

test('training crawlers can fetch the exact comparison paths without opening variants', () => {
  const rules = robotsParser(`${origin}/robots.txt`, buildRobotsText());
  for (const agent of ['GPTBot', 'ClaudeBot']) {
    for (const path of Object.values(localizedPaths)) {
      assert.equal(rules.isAllowed(`${origin}${path}`, agent), true);
      assert.equal(rules.isAllowed(`${origin}${path}?utm_source=reddit`, agent), false);
      assert.equal(rules.isAllowed(`${origin}${path}/comparison`, agent), false);
    }
  }
});

test('localized sitemaps expose one canonical Higgsfield comparison and reciprocal alternates', async () => {
  const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
  const react = frontendRequire('react') as { cache?: (fn: unknown) => unknown };
  react.cache ??= (fn) => fn;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const { buildLocaleSitemapXml } = await import('../frontend/lib/sitemapData');
    for (const locale of locales) {
      const xml = await buildLocaleSitemapXml(locale);
      const loc = `<loc>${origin}${localizedPaths[locale]}</loc>`;
      const matching = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].filter(([entry]) => entry.includes(loc));
      assert.equal(matching.length, 1, locale);
      const [entry] = matching[0];
      for (const alternate of locales) {
        assert.ok(entry.includes(`hreflang="${alternate}" href="${origin}${localizedPaths[alternate]}"`), alternate);
      }
      assert.ok(entry.includes(`hreflang="x-default" href="${origin}${path}"`));
    }
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
