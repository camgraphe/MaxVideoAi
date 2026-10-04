import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { seedanceWorkflowEnabled } from '../frontend/server/seedance-workflow-request';
import { createSeedanceWorkflowGetHandler } from '../frontend/server/seedance-workflow-handler';

test('production Draft availability requires the explicit server flag and never bypasses account authentication', async () => {
  const keys = ['NODE_ENV', 'PRICING_SANDBOX', 'SEEDANCE_2_5_DRAFT_ENABLED'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const set = (environment: string, sandbox: string | undefined, flag: string | undefined) => {
    for (const [key, value] of Object.entries({ NODE_ENV: environment, PRICING_SANDBOX: sandbox, SEEDANCE_2_5_DRAFT_ENABLED: flag })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  const production = 'https://maxvideoai.com/api/jobs/draft/seedance-workflow';
  try {
    for (const flag of [undefined, '0', 'true']) {
      set('production', undefined, flag);
      assert.equal(seedanceWorkflowEnabled(production), false);
    }
    set('production', undefined, '1');
    assert.equal(seedanceWorkflowEnabled(production), true);
    assert.equal(seedanceWorkflowEnabled('https://api.maxvideoai.com/api/preflight'), true);
    let authCalls = 0;
    const handler = createSeedanceWorkflowGetHandler({
      seedanceWorkflowEnabled,
      getRouteAuthContext: async () => { authCalls++; return { userId: null }; },
      readOwnedSeedanceWorkflowView: async () => { throw new Error('unauthenticated requests must not read a Draft'); },
    });
    const response = await handler(new NextRequest(production), { params: Promise.resolve({ jobId: 'draft' }) });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(authCalls, 1);
    set('production', '1', '1');
    assert.equal(seedanceWorkflowEnabled(production), false, 'a sandbox cannot enable the production workflow');
    assert.equal((await handler(new NextRequest(production), { params: Promise.resolve({ jobId: 'draft' }) })).status, 404);
    assert.equal(authCalls, 1);
    set('development', '1', '1');
    for (const host of ['localhost:3106', '127.0.0.1:3106', '[::1]:3106']) {
      assert.equal(seedanceWorkflowEnabled(`http://${host}/api/preflight`), true);
    }
    assert.equal(seedanceWorkflowEnabled(production), false);
    set('development', undefined, '1');
    assert.equal(seedanceWorkflowEnabled('http://localhost/api/preflight'), false);
    set('test', '1', '1');
    assert.equal(seedanceWorkflowEnabled('http://localhost/api/preflight'), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
