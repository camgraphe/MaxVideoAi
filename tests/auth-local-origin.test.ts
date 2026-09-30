import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { middleware } from '../frontend/middleware';
import { GET } from '../frontend/app/auth/callback/route';

test('development disables the framework redirect rewrite while production retains its routing policy', () => {
  const readConfig = (nodeEnv: string) => JSON.parse(execFileSync(process.execPath, ['-e',
    "console.log(JSON.stringify(require('./frontend/next.config.js').skipMiddlewareUrlNormalize ?? false))",
  ], { env: { ...process.env, NODE_ENV: nodeEnv }, encoding: 'utf8' }).trim());
  assert.equal(readConfig('development'), true);
  assert.equal(readConfig('production'), false);
});

test('OAuth language cleanup keeps the loopback origin that owns the PKCE cookie', async () => {
  for (const locale of ['en', 'fr', 'es']) {
    const request = new NextRequest(
      `http://127.0.0.1:3210/auth/callback?next=%2Fadmin%2Fplaylists&lang=${locale}&code=test-code`,
      { headers: { host: '127.0.0.1:3210' } }
    );
    const response = await middleware(request);
    assert.equal(response.headers.get('location'),
      'http://127.0.0.1:3210/auth/callback?next=%2Fadmin%2Fplaylists&code=test-code');
    assert.equal(response.cookies.get('mvid_locale')?.value, locale);
  }
});

test('callback completion keeps the loopback origin and exact admin continuation', async () => {
  const response = await GET(new NextRequest(
    'http://127.0.0.1:3210/auth/callback?next=%2Fadmin%2Fplaylists',
    { headers: { host: '127.0.0.1:3210' } }
  ));
  assert.equal(response.headers.get('location'), 'http://127.0.0.1:3210/admin/playlists');
  assert.match(response.headers.get('cache-control') ?? '', /private, no-store/);
});

test('provider errors stay on the same local login instead of losing their origin', async () => {
  const response = await GET(new NextRequest(
    'http://127.0.0.1:3210/auth/callback?next=%2Fadmin%2Fplaylists&error=access_denied',
    { headers: { host: '127.0.0.1:3210' } }
  ));
  assert.equal(response.headers.get('location'),
    'http://127.0.0.1:3210/login?mode=signin&next=%2Fadmin%2Fplaylists&authError=oauth_callback_failed');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('IPv6 loopback callbacks preserve their browser origin too', async () => {
  const response = await GET(new NextRequest(
    'http://[::1]:3210/auth/callback?next=%2Fadmin%2Fplaylists',
    { headers: { host: '[::1]:3210' } }
  ));
  assert.equal(response.headers.get('location'), 'http://[::1]:3210/admin/playlists');
});

test('public callback origins cannot be replaced by Host or forwarded headers', async () => {
  const response = await GET(new NextRequest(
    'https://maxvideoai.com/auth/callback?next=%2Fadmin%2Fplaylists',
    { headers: { host: '127.0.0.1:3210', 'x-forwarded-host': 'evil.example' } }
  ));
  assert.equal(response.headers.get('location'), 'https://maxvideoai.com/admin/playlists');
});

test('loopback origin restoration rejects other ports, external hosts and malformed authorities', async () => {
  for (const host of ['127.0.0.1:9999', 'evil.example:3210', 'localhost:3210@evil.example', '127.0.0.1:3210/evil', '127.0.0.1:3210,evil.example']) {
    const response = await GET(new NextRequest(
      'http://localhost:3210/auth/callback?next=%2Fadmin%2Fplaylists',
      { headers: { host, 'x-forwarded-host': '127.0.0.1:3210' } }
    ));
    assert.equal(response.headers.get('location'), 'http://localhost:3210/admin/playlists', host);
  }
});
