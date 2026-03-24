import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLocalizedFallbackSeo } from '../frontend/lib/seo/localizedFallback';

test('localized fallback SEO noindexes untranslated localized pages and points canonical to EN', () => {
  const result = resolveLocalizedFallbackSeo({
    locale: 'es',
    hasLocalizedVersion: false,
    englishPath: '/docs/get-started',
    availableLocales: ['en', 'fr'],
  });

  assert.deepEqual(result.availableLocales, ['en', 'fr']);
  assert.deepEqual(result.robots, { index: false, follow: true });
  assert.equal(result.canonicalOverride, 'https://maxvideoai.com/docs/get-started');
});

test('localized fallback SEO keeps localized canonicals when the translation exists', () => {
  const result = resolveLocalizedFallbackSeo({
    locale: 'fr',
    hasLocalizedVersion: true,
    englishPath: '/ai-video-engines/best-for/cinematic-realism',
    availableLocales: ['en', 'fr', 'es'],
  });

  assert.deepEqual(result.availableLocales, ['en', 'fr', 'es']);
  assert.equal(result.robots, undefined);
  assert.equal(result.canonicalOverride, undefined);
});
