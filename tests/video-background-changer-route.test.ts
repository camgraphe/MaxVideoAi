import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { buildMarketingLocaleSwitchHref } from '../frontend/lib/i18n/marketing-locale-switch.ts';
import { resolveLangParamRedirect } from '../frontend/lib/middleware/routing-locale.ts';
import { buildLoginHref } from '../frontend/lib/auth-entry-href.ts';
import { safeInternalReturnTarget } from '../frontend/lib/auth-return-target.ts';
import { middleware } from '../frontend/middleware.ts';

test('the English-only background changer sends language choices to real tools hubs without stale section anchors', () => {
  for (const [targetLocale, expected] of [['fr', '/fr/outils?utm_source=review&lang=fr'], ['es', '/es/herramientas?utm_source=review&lang=es']] as const) {
    assert.equal(buildMarketingLocaleSwitchHref({ pathname: '/tools/video-background-changer', targetLocale, search: '?utm_source=review&nolocale=1', hash: '#comparison' }), expected);
  }
  assert.equal(buildMarketingLocaleSwitchHref({ pathname: '/tools/video-background-changer', targetLocale: 'en', hash: '#comparison' }), '/tools/video-background-changer?lang=en#comparison');
});

test('signin and signup continuation retain the exact Wan Prime Modify request', () => {
  for (const mode of ['signin', 'signup'] as const) {
    const href = buildLoginHref({ mode, nextPath: '/app?engine=wan-3-prime&mode=v2v' });
    const target = new URL(href, 'https://maxvideoai.com').searchParams.get('next');
    assert.equal(safeInternalReturnTarget(target), '/app?engine=wan-3-prime&mode=v2v');
  }
});

test('an explicit language parameter uses the same fallback and preserves tracking', () => {
  for (const [locale, path] of [['fr', '/fr/outils'], ['es', '/es/herramientas']] as const) {
    const request = new NextRequest(`https://maxvideoai.com/tools/video-background-changer?lang=${locale}&utm_source=review`);
    const response = resolveLangParamRedirect(request, request.nextUrl.pathname);
    assert.equal(response?.status, 307);
    assert.equal(response?.headers.get('location'), `https://maxvideoai.com${path}?utm_source=review`);
  }
});

test('the prepared page metadata announces only its actual English URL and binds the approved public media identities', async () => {
  const owner = await import('../frontend/app/tools/video-background-changer/_lib/page-data.ts').catch(() => null);
  assert.ok(owner, 'the route data owner must exist');
  const metadata = owner.buildVideoBackgroundMetadata();
  assert.equal(metadata.alternates?.canonical, 'https://maxvideoai.com/tools/video-background-changer');
  assert.deepEqual(metadata.alternates?.languages, { en: 'https://maxvideoai.com/tools/video-background-changer', 'x-default': 'https://maxvideoai.com/tools/video-background-changer' });
  const media = owner.getPublishedVideoBackgroundMedia();
  assert.ok(media, 'activation requires the qualified public pair');
  assert.equal(media.source.src, 'https://media.maxvideoai.com/authored/video-background-changer/e1daf333b6df13b289c4bee1ab4cc4d9defefaa3eea4645021636aa5101c7092.mp4');
  assert.equal(media.result.src, 'https://media.maxvideoai.com/authored/video-background-changer/a1496fc2552f03e3cce7ddef72c161740f010dbbd4afca211fa29193d4eb7078.mp4');
  assert.equal(media.source.poster, 'https://media.maxvideoai.com/authored/video-background-changer/e0c5be8c1bedfa8e06c899254cf2417005513f13f5efcf4dd583bf2f09948e6a.webp');
  assert.equal(media.result.poster, 'https://media.maxvideoai.com/authored/video-background-changer/80f864726dafe8184adc8ba587193603bfa7a7e1828a36a38744a5db903c537a.webp');
  assert.equal(media.source.durationSec, 6);
  assert.equal(media.result.durationSec, 6.037007);
});


test('the English-only public page reaches its authored route for real visitors without an absent locale-prefixed rewrite', async () => {
  for (const [host, agent, cookie] of [
    ['maxvideoai.com', 'Mozilla/5.0 Chrome/130.0 Safari/537.36', 'NEXT_LOCALE=fr'],
    ['maxvideoai-j8g9fadgj-camgraphes-projects.vercel.app', 'Mozilla/5.0 Chrome/130.0 Safari/537.36', 'NEXT_LOCALE=es'],
    ['maxvideoai.com', 'Googlebot', ''],
    ['localhost:8792', 'Mozilla/5.0 Chrome/130.0 Safari/537.36', ''],
  ]) {
    const request = new NextRequest(`https://${host}/tools/video-background-changer`, {
      headers: { host, 'user-agent': agent, cookie },
    });
    const response = await middleware(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-middleware-rewrite'), null, `${host} must reach the actual English-only route`);
  }
  const existing = await middleware(new NextRequest('https://maxvideoai.com/tools/character-builder', {
    headers: { host: 'maxvideoai.com', 'user-agent': 'Mozilla/5.0 Chrome/130.0 Safari/537.36' },
  }));
  assert.equal(new URL(existing.headers.get('x-middleware-rewrite')!).pathname, '/en/tools/character-builder');
});
