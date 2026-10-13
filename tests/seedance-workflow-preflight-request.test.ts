import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';

test('HTTP Draft preflight retains reference identity and Auto options for verified media pricing', async () => {
  const keys = ['NODE_ENV', 'PRICING_SANDBOX', 'SEEDANCE_2_5_DRAFT_ENABLED'] as const;
  const previous = keys.map(key => process.env[key]);
  Object.assign(process.env, { NODE_ENV: 'development', PRICING_SANDBOX: '1', SEEDANCE_2_5_DRAFT_ENABLED: '1' });
  const inputs = [{ assetId: 'owned', kind: 'video', slotId: 'video_urls', url: 'https://cdn.example/video.mp4' }];
  let projected: any;
  const handler = createPreflightPostHandler({ getRouteAuthContextFn: async () => ({ userId: 'owner' } as never),
    resolveMediaAwarePreflightFn: async value => { projected = value; return { ok: true, total: 100, currency: 'USD' }; } });
  try {
    const response = await handler(new NextRequest('http://localhost/api/preflight', { method: 'POST', body: JSON.stringify({
      engine: 'seedance-2-5', mode: 'ref2v', durationSec: 5, durationOption: 'auto', resolution: '480p', aspectRatio: 'auto', fps: 24,
      inputs, extraInputValues: { output_format: 'mov', return_last_frame: true, watermark: true }, seedanceWorkflow: { step: 'draft' },
    }) }));
    assert.equal(response.status, 200);
    assert.deepEqual(projected.request.inputs, inputs);
    assert.equal(projected.request.durationOption, 'auto');
    assert.equal(projected.request.mode, 'ref2v');
    assert.equal(projected.trustedSeedanceWorkflow.workflow.step, 'draft');
  } finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }); }
});
