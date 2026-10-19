import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { CREATOR_TOOL_IDS, isCreatorToolPublic, getReleasedCreatorToolIds, isCreatorPublicPathAvailable } from '../frontend/src/lib/toolbox/creator-availability';
import { getCreatorMarketingCopy } from '../frontend/src/components/tools/creator-marketing/creator-copy';
import { buildCreatorToolMetadata } from '../frontend/src/components/tools/creator-marketing/creator-marketing-routing';
import { localizePathFromEnglish, englishPathFromLocale } from '../frontend/lib/i18n/paths';
import { routing } from '../frontend/i18n/routing';

// Catches publication via a route/link/sitemap while execution is still unqualified.
test('creator publication stays closed and rejects unknown identities without hiding unrelated tools', () => {
  assert.deepEqual(getReleasedCreatorToolIds(), []);
  for (const id of CREATOR_TOOL_IDS) {
    assert.equal(isCreatorToolPublic(id), false);
    assert.equal(isCreatorPublicPathAvailable(`/tools/${id}`), false);
  }
  assert.equal(isCreatorToolPublic('invented'), false);
  assert.equal(isCreatorPublicPathAvailable('/tools/upscale'), true);
  assert.equal(isCreatorPublicPathAvailable('/tools'), true);
});

test('all creator pages retain exact localized canonical and reciprocal language routes', () => {
  for (const id of CREATOR_TOOL_IDS) {
    const en = `/tools/${id}`;
    const paths = { en, fr: `/fr/outils/${id}`, es: `/es/herramientas/${id}` };
    for (const locale of ['en', 'fr', 'es'] as const) {
      const metadata = buildCreatorToolMetadata(id, locale);
      assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${paths[locale]}`);
      assert.equal(localizePathFromEnglish(locale, en), paths[locale]);
      assert.equal(englishPathFromLocale(locale, paths[locale]), en);
      assert.equal(routing.pathnames[en as keyof typeof routing.pathnames][locale], paths[locale].replace(/^\/(fr|es)/, ''));
      assert.ok(getCreatorMarketingCopy(locale, id).limits.length >= 2);
      assert.ok(String(metadata.description).trim().length > 40);
      const languages = metadata.alternates?.languages as Record<string, string>;
      assert.equal(languages.en, `https://maxvideoai.com${en}`);
      assert.equal(languages.fr, `https://maxvideoai.com${paths.fr}`);
      assert.equal(languages.es, `https://maxvideoai.com${paths.es}`);
    }
  }
});

test('unreleased creator routes are absent from the actual discovered sitemap', async () => {
  const react = createRequire(new URL('../frontend/package.json', import.meta.url))('react');
  react.cache ??= (fn: unknown) => fn;
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const { getCanonicalPathEntries } = await import('../frontend/lib/sitemap/route-discovery');
    const entries = await getCanonicalPathEntries();
    assert.ok(entries.some(entry => entry.englishPath === '/tools/upscale'));
    for (const id of CREATOR_TOOL_IDS) assert.ok(!entries.some(entry => entry.englishPath === `/tools/${id}`));
  } finally {
    if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
  }
});

test('unreleased route rendering and metadata stop at the same not-found gate', async () => {
  for (const id of CREATOR_TOOL_IDS) {
    const route = await import(`../frontend/app/(localized)/[locale]/(marketing)/tools/${id}/page.tsx`);
    const props = { params: Promise.resolve({ locale: 'fr' }) };
    await assert.rejects(route.default(props), /NEXT_HTTP_ERROR_FALLBACK;404/);
    await assert.rejects(route.generateMetadata(props), /NEXT_HTTP_ERROR_FALLBACK;404/);
  }
});

test('unreleased creators do not leak into public hub or marketing navigation', async () => {
  const { CreatorToolsCollection } = await import('../frontend/src/components/tools/creator-marketing/CreatorToolsCollection');
  const { MARKETING_NAV_TOOLS } = await import('../frontend/config/navigation');
  assert.equal(CreatorToolsCollection({ locale: 'en' }), null);
  for (const id of CREATOR_TOOL_IDS) assert.ok(!MARKETING_NAV_TOOLS.some(item => item.key === id));
});
