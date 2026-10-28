import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { buildMarketingLocaleSwitchHref } from '../frontend/lib/i18n/marketing-locale-switch.ts';
import { resolveLangParamRedirect } from '../frontend/lib/middleware/routing-locale.ts';

test('the English-only background changer sends language choices to real tools hubs without stale section anchors', () => {
  for (const [targetLocale, expected] of [['fr', '/fr/outils?utm_source=review&lang=fr'], ['es', '/es/herramientas?utm_source=review&lang=es']] as const) {
    assert.equal(buildMarketingLocaleSwitchHref({ pathname: '/tools/video-background-changer', targetLocale, search: '?utm_source=review&nolocale=1', hash: '#comparison' }), expected);
  }
  assert.equal(buildMarketingLocaleSwitchHref({ pathname: '/tools/video-background-changer', targetLocale: 'en', hash: '#comparison' }), '/tools/video-background-changer?lang=en#comparison');
});

test('an explicit language parameter uses the same fallback and preserves tracking', () => {
  for (const [locale, path] of [['fr', '/fr/outils'], ['es', '/es/herramientas']] as const) {
    const request = new NextRequest(`https://maxvideoai.com/tools/video-background-changer?lang=${locale}&utm_source=review`);
    const response = resolveLangParamRedirect(request, request.nextUrl.pathname);
    assert.equal(response?.status, 307);
    assert.equal(response?.headers.get('location'), `https://maxvideoai.com${path}?utm_source=review`);
  }
});

test('the prepared page metadata announces only its actual English URL and keeps unpublished media unavailable', async () => {
  const owner = await import('../frontend/app/tools/video-background-changer/_lib/page-data.ts').catch(() => null);
  assert.ok(owner, 'the route data owner must exist');
  const metadata = owner.buildVideoBackgroundMetadata();
  assert.equal(metadata.alternates?.canonical, 'https://maxvideoai.com/tools/video-background-changer');
  assert.deepEqual(metadata.alternates?.languages, { en: 'https://maxvideoai.com/tools/video-background-changer', 'x-default': 'https://maxvideoai.com/tools/video-background-changer' });
  assert.equal(owner.getPublishedVideoBackgroundMedia(), null);
});
