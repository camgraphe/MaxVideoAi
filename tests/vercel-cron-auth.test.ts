import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeCronRequest } from '../frontend/src/server/vercel-cron.ts';

function createHeaders(values: Record<string, string | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

test('vercel cron requires CRON_SECRET when configured', () => {
  const result = authorizeCronRequest(
    createHeaders({
      'user-agent': 'vercel-cron/1.0',
      'x-vercel-cron': '*/5 * * * *',
    }),
    {
      cronSecret: 'super-secret',
      vercelEnv: '1',
    }
  );

  assert.deepEqual(result, { ok: false, reason: 'missing-cron-secret' });
});

test('vercel cron accepts Authorization Bearer CRON_SECRET', () => {
  const result = authorizeCronRequest(
    createHeaders({
      authorization: 'Bearer super-secret',
      'user-agent': 'vercel-cron/1.0',
      'x-vercel-cron': '*/5 * * * *',
    }),
    {
      cronSecret: 'super-secret',
      vercelEnv: '1',
    }
  );

  assert.deepEqual(result, { ok: true, mode: 'vercel-secret' });
});

test('vercel cron rejects deployment mismatch when header is present', () => {
  const result = authorizeCronRequest(
    createHeaders({
      authorization: 'Bearer super-secret',
      'x-vercel-deployment-id': 'other',
    }),
    {
      cronSecret: 'super-secret',
      deploymentId: 'current',
      vercelEnv: '1',
    }
  );

  assert.deepEqual(result, { ok: false, reason: 'deployment-mismatch' });
});

test('local cron can use a route-specific debug token', () => {
  const result = authorizeCronRequest(
    createHeaders({
      'x-fal-poll-token': 'local-poll-secret',
    }),
    {
      localTokens: ['local-poll-secret'],
      overrideHeaderName: 'x-fal-poll-token',
      vercelEnv: '',
    }
  );

  assert.deepEqual(result, { ok: true, mode: 'local-token' });
});
