import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';
import { resolveGenerateUserId } from '../frontend/app/api/generate/_lib/auth-idempotency';

test('video generation accepts the verified Bearer identity from canonical route auth', async () => {
  const request = new NextRequest('https://api.maxvideoai.com/api/generate', {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-access-token',
      cookie: 'sb-project-auth-token=cookie-session',
    },
  });
  let receivedRequest: NextRequest | undefined;
  let localAdminChecked = false;

  const userId = await resolveGenerateUserId(request, {
    getRouteAuthContextFn: async (req) => {
      receivedRequest = req;
      return { userId: 'bearer-user' };
    },
    resolveLocalAdminBypassUserIdFn: async () => {
      localAdminChecked = true;
      return 'local-admin';
    },
  });

  assert.equal(receivedRequest, request);
  assert.equal(userId, 'bearer-user');
  assert.equal(localAdminChecked, false);
});

test('video generation preserves cookie auth through canonical route auth', async () => {
  const request = new NextRequest('https://maxvideoai.com/api/generate', {
    method: 'POST',
    headers: { cookie: 'sb-project-auth-token=cookie-session' },
  });

  const userId = await resolveGenerateUserId(request, {
    getRouteAuthContextFn: async () => ({ userId: 'cookie-user' }),
    resolveLocalAdminBypassUserIdFn: async () => {
      throw new Error('local admin bypass must not run for an authenticated cookie session');
    },
  });

  assert.equal(userId, 'cookie-user');
});

test('video generation leaves malformed Bearer fallback semantics to canonical route auth', async () => {
  const request = new NextRequest('https://maxvideoai.com/api/generate', {
    method: 'POST',
    headers: {
      authorization: 'Basic malformed-for-this-route',
      cookie: 'sb-project-auth-token=cookie-session',
    },
  });

  const userId = await resolveGenerateUserId(request, {
    getRouteAuthContextFn: async (req) => {
      assert.equal(req, request);
      return { userId: 'cookie-user' };
    },
    resolveLocalAdminBypassUserIdFn: async () => {
      throw new Error('local admin bypass must not replace canonical cookie fallback');
    },
  });

  assert.equal(userId, 'cookie-user');
});

test('video generation uses local admin bypass only after canonical auth has no identity', async () => {
  const request = new NextRequest('http://localhost:3000/api/generate', { method: 'POST' });
  let receivedByBypass: NextRequest | undefined;

  const userId = await resolveGenerateUserId(request, {
    getRouteAuthContextFn: async () => ({ userId: null }),
    resolveLocalAdminBypassUserIdFn: async (req) => {
      receivedByBypass = req;
      return 'local-admin';
    },
  });

  assert.equal(receivedByBypass, request);
  assert.equal(userId, 'local-admin');
});

test('video generation keeps local admin bypass available when canonical auth errors', async () => {
  const request = new NextRequest('http://localhost:3000/api/generate', { method: 'POST' });

  const userId = await resolveGenerateUserId(request, {
    getRouteAuthContextFn: async () => {
      throw new Error('Supabase unavailable');
    },
    resolveLocalAdminBypassUserIdFn: async () => 'local-admin',
  });

  assert.equal(userId, 'local-admin');
});
