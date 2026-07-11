import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { sanitizeNextPath } from '../frontend/app/(core)/login/_lib/login-helpers';
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
  const formPath = join(
    process.cwd(),
    'frontend/app/(core)/oauth/consent/_components/OAuthConsentForm.tsx'
  );
  const decisionPath = join(process.cwd(), 'frontend/app/api/oauth/decision/route.ts');
  const operationsPath = join(process.cwd(), 'docs/operations/mcp-oauth-configuration.md');

  for (const path of [pagePath, formPath, decisionPath, operationsPath]) {
    assert.equal(existsSync(path), true, path);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const formSource = readFileSync(formPath, 'utf8');
  const decisionSource = readFileSync(decisionPath, 'utf8');

  assert.doesNotMatch(pageSource, /['"]use client['"]/);
  assert.match(pageSource, /oauth\.getAuthorizationDetails/);
  assert.match(pageSource, /buildConsentLoginPath/);
  assert.match(formSource, /action="\/api\/oauth\/decision"/);
  assert.match(formSource, /value="approve"/);
  assert.match(formSource, /value="deny"/);
  assert.match(decisionSource, /isSameOriginConsentRequest/);
  assert.match(decisionSource, /oauth\.approveAuthorization/);
  assert.match(decisionSource, /oauth\.denyAuthorization/);
  assert.match(decisionSource, /skipBrowserRedirect:\s*true/);
  assert.doesNotMatch(decisionSource, /form.*redirect|redirect.*form/i);
});
