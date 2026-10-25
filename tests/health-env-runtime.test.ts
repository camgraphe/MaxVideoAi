import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/health/env/route';

test('runtime health diagnostics require the operations token and cannot be cached', async (t) => {
  const previous = { HEALTHCHECK_TOKEN: process.env.HEALTHCHECK_TOKEN, VERCEL: process.env.VERCEL };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.VERCEL = '1';
  delete process.env.HEALTHCHECK_TOKEN;
  const missingConfiguration = await GET(new NextRequest('https://example.test/api/health/env'));
  assert.equal(missingConfiguration.status, 503);
  assert.equal(missingConfiguration.headers.get('x-runtime-node-version'), null);

  process.env.HEALTHCHECK_TOKEN = 'health-runtime-test-token';
  for (const headers of [{}, { authorization: 'Bearer wrong-token' }]) {
    const denied = await GET(new NextRequest('https://example.test/api/health/env', { headers }));
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('x-runtime-node-version'), null);
  }

  const response = await GET(new NextRequest('https://example.test/api/health/env', {
    headers: { authorization: 'Bearer health-runtime-test-token' },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-runtime-node-version'), process.versions.node);
  assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
  const body = await response.json();
  assert.ok(Object.values(body).every((value) => typeof value === 'boolean'));
  assert.equal(JSON.stringify(body).includes('health-runtime-test-token'), false);
});
