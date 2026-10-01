import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import * as handler from '../frontend/server/seedance-workflow-handler';

test('workflow route authenticates before owned reads and keeps every response private', async () => {
  let reads = 0, authCalls = 0;
  const req = new NextRequest('http://localhost:3106/api/jobs/draft/seedance-workflow', { headers: { Authorization: 'Bearer fixture' } });
  const props = { params: Promise.resolve({ jobId: 'draft' }) };
  const create = (settings: { enabled?: boolean; owner?: string | null; authError?: boolean; readError?: boolean } = {}) => handler.createSeedanceWorkflowGetHandler({
    localSeedanceWorkflowEnabled: () => settings.enabled ?? true,
    getRouteAuthContext: async (request: NextRequest) => { authCalls++; assert.equal(request.headers.get('authorization'), 'Bearer fixture'); if (settings.authError) throw new Error('auth down'); return { userId: settings.owner ?? null }; },
    readOwnedSeedanceWorkflowView: async (owner: string, jobId: string) => { reads++; assert.equal(owner, 'owner'); assert.equal(jobId, 'draft'); if (settings.readError) throw new Error('DB down'); return null; },
  });
  assert.equal(typeof handler.createSeedanceWorkflowGetHandler, 'function');
  for (const [settings, status] of [[{ enabled: false }, 404], [{}, 401], [{ authError: true }, 401], [{ owner: 'owner' }, 404], [{ owner: 'owner', readError: true }, 503]] as const) {
    const response = await create(settings)(req, props);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(reads, 2);
  assert.equal(authCalls, 4, 'disabled modes do not invoke authentication or data readers');
});
