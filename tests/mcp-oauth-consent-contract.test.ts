import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { sanitizeNextPath } from '../frontend/app/(core)/login/_lib/login-helpers';
import { middleware } from '../frontend/middleware';
import { shouldHandleLocale } from '../frontend/lib/middleware/routing-locale';
import {
  buildConsentLoginPath,
  isSameOriginConsentRequest,
  isValidAuthorizationId,
  resolveOAuthRedirectUrl,
} from '../frontend/src/server/mcp/oauth-consent';

test('OAuth authorization ids are bounded and safe for the consent flow', () => {
  assert.equal(isValidAuthorizationId('authz_1234567890.ABC-def'), true);
  assert.equal(isValidAuthorizationId('short'), false);
  assert.equal(isValidAuthorizationId('../oauth/consent'), false);
  assert.equal(isValidAuthorizationId('x'.repeat(513)), false);
});

test('OAuth login return preserves only the authorization id', () => {
  assert.equal(
    buildConsentLoginPath('authz_1234567890'),
    '/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dauthz_1234567890'
  );
  assert.equal(
    sanitizeNextPath('/oauth/consent?authorization_id=authz_1234567890'),
    '/oauth/consent?authorization_id=authz_1234567890'
  );
  assert.equal(sanitizeNextPath('/api/oauth/decision'), '/generate');
});

test('OAuth consent is a non-localized application route', () => {
  assert.equal(shouldHandleLocale('/oauth/consent'), false);
  assert.equal(shouldHandleLocale('/mcp'), true);
});

test('OAuth consent is private and excluded from search at the edge', async () => {
  const response = await middleware(
    new NextRequest('https://maxvideoai.com/oauth/consent?authorization_id=authz_1234567890')
  );
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('OAuth decision accepts only same-origin form submissions', () => {
  assert.equal(
    isSameOriginConsentRequest(
      new Request('https://maxvideoai.com/api/oauth/decision', {
        method: 'POST',
        headers: { origin: 'https://maxvideoai.com' },
      })
    ),
    true
  );
  assert.equal(
    isSameOriginConsentRequest(
      new Request('https://maxvideoai.com/api/oauth/decision', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      })
    ),
    false
  );
  assert.equal(
    isSameOriginConsentRequest(
      new Request('http://localhost:3100/api/oauth/decision', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: 'http://127.0.0.1:3100',
        },
      })
    ),
    true
  );
});

test('OAuth redirect accepts HTTPS and loopback HTTP only', () => {
  assert.equal(
    resolveOAuthRedirectUrl('https://chat.example/callback?code=abc'),
    'https://chat.example/callback?code=abc'
  );
  assert.equal(
    resolveOAuthRedirectUrl('http://127.0.0.1:43123/callback?code=abc'),
    'http://127.0.0.1:43123/callback?code=abc'
  );
  assert.throws(() => resolveOAuthRedirectUrl('http://evil.example/callback'), /redirect/i);
  assert.throws(() => resolveOAuthRedirectUrl('javascript:alert(1)'), /redirect/i);
});

test('OAuth consent page and decision route use server-side Supabase OAuth methods', () => {
  const pagePath = join(process.cwd(), 'frontend/app/(core)/oauth/consent/page.tsx');
  const layoutPath = join(process.cwd(), 'frontend/app/(core)/oauth/consent/layout.tsx');
  const formPath = join(
    process.cwd(),
    'frontend/app/(core)/oauth/consent/_components/OAuthConsentForm.tsx'
  );
  const decisionPath = join(process.cwd(), 'frontend/app/api/oauth/decision/route.ts');
  const nextConfigPath = join(process.cwd(), 'frontend/next.config.js');
  const operationsPath = join(process.cwd(), 'docs/operations/mcp-oauth-configuration.md');

  for (const path of [pagePath, layoutPath, formPath, decisionPath, nextConfigPath, operationsPath]) {
    assert.equal(existsSync(path), true, path);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const layoutSource = readFileSync(layoutPath, 'utf8');
  const formSource = readFileSync(formPath, 'utf8');
  const decisionSource = readFileSync(decisionPath, 'utf8');
  const nextConfigSource = readFileSync(nextConfigPath, 'utf8');

  assert.doesNotMatch(pageSource, /['"]use client['"]/);
  assert.match(pageSource, /oauth\.getAuthorizationDetails/);
  assert.match(layoutSource, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(pageSource, /buildConsentLoginPath/);
  assert.match(pageSource, /getMcpRequestHost\(requestHeaders\)/);
  assert.match(pageSource, /isMcpFoundationFeatureEnabled\('oauth', process\.env, requestHost\)/);
  assert.match(formSource, /action="\/api\/oauth\/decision"/);
  assert.match(formSource, /value="approve"/);
  assert.match(formSource, /value="deny"/);
  assert.match(decisionSource, /isSameOriginConsentRequest/);
  assert.match(decisionSource, /getMcpRequestHost\(request\.headers\)/);
  assert.match(decisionSource, /isMcpFoundationFeatureEnabled\('oauth', process\.env, requestHost\)/);
  assert.match(decisionSource, /oauth\.approveAuthorization/);
  assert.match(decisionSource, /oauth\.denyAuthorization/);
  assert.match(decisionSource, /skipBrowserRedirect:\s*true/);
  assert.doesNotMatch(decisionSource, /form.*redirect|redirect.*form/i);
  assert.match(nextConfigSource, /source:\s*['"]\/oauth\/consent['"][\s\S]*?X-Robots-Tag[\s\S]*?noindex, nofollow/);
});
