import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../frontend/middleware';
import { buildLoginHref } from '../frontend/lib/auth-entry-href';
import { buildAuthCallbackRedirect } from '../frontend/app/(core)/login/_lib/login-helpers';
import { resolveInitialAuthLocale } from '../frontend/app/(core)/login/_lib/login-route-state';
import { createCoreLocaleResponse } from '../frontend/lib/middleware/routing-locale';

test('explicit auth language overrides stale Spanish cookies without localizing the login route', async () => {
  const href = buildLoginHref({ mode: 'signin', nextPath: '/app?from=home', locale: 'en' });
  assert.equal(href, '/login?mode=signin&next=%2Fapp%3Ffrom%3Dhome&lang=en');
  const response = await middleware(new NextRequest(`https://maxvideoai.com${href}`, {
    headers: { cookie: 'mvid_locale=es; NEXT_LOCALE=es', 'accept-language': 'es-ES', 'x-vercel-ip-country': 'ES' },
  }));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://maxvideoai.com/login?mode=signin&next=%2Fapp%3Ffrom%3Dhome');
  assert.equal(response.cookies.get('mvid_locale')?.value, 'en');
  assert.equal(response.cookies.get('NEXT_LOCALE')?.value, 'en');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('a document navigation from a public page carries its URL language into login and the workspace', async () => {
  for (const [referer, locale] of [
    ['https://maxvideoai.com/', 'en'],
    ['https://maxvideoai.com/fr/modeles/veo-3-1', 'fr'],
    ['https://maxvideoai.com/es/precios', 'es'],
  ]) {
    for (const path of ['/login?mode=signin&next=%2Fapp', '/app', '/billing?amount=2500']) {
      const url = `https://maxvideoai.com${path}`;
      const request = new NextRequest(url, {
        headers: { referer, cookie: 'mvid_locale=invalid', 'sec-fetch-dest': 'document' },
      });
      const response = createCoreLocaleResponse(request, request.nextUrl.pathname);
      assert.ok(response, `${referer} -> ${path}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.cookies.get('mvid_locale')?.value, locale);
      assert.match(response.headers.get('x-middleware-request-cookie') ?? '', new RegExp(`mvid_locale=${locale}`));
      assert.match(response.headers.get('cache-control') ?? '', /private, no-store/);
      assert.equal(resolveInitialAuthLocale(response.cookies.get('mvid_locale')?.value), locale);
    }
  }
});

test('real login middleware forwards the selected language to the first server render', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/login?mode=signin', {
    headers: { referer: 'https://maxvideoai.com/', cookie: 'mvid_locale=es; NEXT_LOCALE=es' },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get('mvid_locale')?.value, 'en');
  assert.match(response.headers.get('x-middleware-request-cookie') ?? '', /mvid_locale=en/);
});

test('locale persistence does not loop or take language from third parties, core pages or prefetch', async () => {
  for (const headers of [
    { referer: 'https://maxvideoai.com/', cookie: 'mvid_locale=en; NEXT_LOCALE=en' },
    { referer: 'https://external.example/fr', cookie: 'mvid_locale=es' },
    { referer: 'https://maxvideoai.com/app', cookie: 'mvid_locale=es' },
    { referer: 'https://maxvideoai.com/', cookie: 'mvid_locale=es', 'next-router-prefetch': '1' },
    { referer: 'https://maxvideoai.com/', cookie: 'mvid_locale=es', rsc: '1', 'next-router-prefetch': '1' },
    { cookie: 'mvid_locale=es', 'accept-language': 'fr', 'x-vercel-ip-country': 'FR' },
  ]) {
    const response = await middleware(new NextRequest('https://maxvideoai.com/login', { headers }));
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.cookies.get('mvid_locale'), undefined);
  }
});

test('client-side navigation carries language too, while speculative RSC prefetch stays read-only', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/login?mode=signin', {
    headers: { referer: 'https://maxvideoai.com/fr', cookie: 'mvid_locale=es', rsc: '1', 'sec-fetch-dest': 'empty' },
  }));
  assert.equal(response.cookies.get('mvid_locale')?.value, 'fr');
  assert.match(response.headers.get('x-middleware-request-cookie') ?? '', /mvid_locale=fr/);
});

test('Next.js may strip the RSC header before middleware sees a client navigation', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/login', {
    headers: { referer: 'https://maxvideoai.com/', cookie: 'mvid_locale=es', 'sec-fetch-dest': 'empty' },
  }));
  assert.equal(response.cookies.get('mvid_locale')?.value, 'en');
});

test('legacy localized login URLs preserve their language when the prefix is removed', async () => {
  const response = await middleware(new NextRequest('https://maxvideoai.com/fr/login?mode=signin&next=%2Fapp'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://maxvideoai.com/login?mode=signin&next=%2Fapp');
  assert.equal(response.cookies.get('mvid_locale')?.value, 'fr');
});

test('email, reset and OAuth callback URLs retain locale and exact continuation through middleware', async () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const callback = buildAuthCallbackRedirect('https://maxvideoai.com', '/billing?amount=2500&currency=EUR', locale);
    assert.ok(callback);
    const url = new URL(callback);
    assert.equal(url.searchParams.get('lang'), locale);
    url.searchParams.set('code', 'test-code');
    url.searchParams.set('state', 'test-state');
    const response = await middleware(new NextRequest(url));
    assert.equal(response.cookies.get('mvid_locale')?.value, locale);
    const redirect = new URL(response.headers.get('location')!);
    assert.equal(redirect.pathname, '/auth/callback');
    assert.equal(redirect.searchParams.get('lang'), null);
    assert.equal(redirect.searchParams.get('code'), 'test-code');
    assert.equal(redirect.searchParams.get('state'), 'test-state');
    assert.equal(redirect.searchParams.get('next'), '/billing?amount=2500&currency=EUR');
  }
});
