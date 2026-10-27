import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveGenerateRouteContext, resolveTrustedPaidGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { resolveAgentGenerationModeExecutability, resolveAgentGenerationRequestExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { generateVideo } from '../frontend/src/lib/fal';
import { withClosedKlingV4Release } from './helpers/kling-v4-release-profile';

test('closed V4 profile cannot reach configuration, pricing, billing, canary or providers', async () => withClosedKlingV4Release(async () => {
  const forbidden = async (): Promise<never> => { throw new Error('Side effect reached while release is closed'); };
  const engine = getFalEngineById('kling-v4')!.engine;
  for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v'] as const) {
    const request = { engineId: engine.id, mode, prompt: 'A night train arrives.', durationSec: 5, resolution: '1080p' };
    const result = await resolveGenerateRouteContext({ body: request, req: new NextRequest('https://example.test/api/generate', { method: 'POST' }),
      boundaryOverrides: { getConfiguredEngine: forbidden, getConfiguredEngineIncludingHidden: forbidden,
        ensureBillingSchema: forbidden, requireAdmin: forbidden, resolveLaunchCanaryRequestContext: forbidden } });
    assert.deepEqual(result, { ok: false, status: 503, body: { ok: false, error: 'KLING_V4_NOT_QUALIFIED' } });
    assert.deepEqual(resolveTrustedPaidGenerateRouteContext({ body: request, engine, mode, jobId: 'old-approved-quote',
      providerEnv: { KLING_DIRECT_ENABLED: 'true', KLING_DIRECT_ADMIN_ONLY: 'false', KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true' } }), result);
    assert.deepEqual(resolveAgentGenerationModeExecutability(engine, mode, { bytePlusEnabled: false, bytePlusApiKey: undefined, falApiKey: 'test-only',
      providerEnv: { KLING_DIRECT_ENABLED: 'true', KLING_ACCESS_KEY: 'test-only', KLING_SECRET_KEY: 'test-only' } }), { executable: false, reason: 'provider_disabled' });
    const preflight = await resolveMediaAwarePreflight({ request: { engine: engine.id, mode, durationSec: 5, resolution: '1080p' } },
      { getConfiguredEngineFn: forbidden, getConfiguredEngineIncludingHiddenFn: forbidden, computeConfiguredPreflightFn: forbidden });
    assert.equal(preflight.ok, false);
    assert.equal(preflight.error?.code, 'ENGINE_UNAVAILABLE');
    await assert.rejects(generateVideo(request), /KLING_V4_NOT_QUALIFIED/);
  }
}));

test('closed V4 profile also refuses restored requests with configured offline credentials', async () => withClosedKlingV4Release(() => {
  const engine = getFalEngineById('kling-v4')!.engine;
  for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v'] as const) {
    assert.deepEqual(resolveAgentGenerationRequestExecutability({surface:'video',engineId:'kling-v4',mode,prompt:'Offline',settings:{},references:[]}, engine, [], {bytePlusEnabled:false,falApiKey:'offline-only'}), {executable:false,reason:'provider_disabled'});
  }
}));
