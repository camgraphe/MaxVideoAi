import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { resolveFalModelSlug } from '../frontend/src/lib/fal-model-helpers';
import { resolveEngineIdFromModelSlug, resolveFalModelId } from '../frontend/src/lib/fal-catalog';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { getPrivateRuntimeEngineById } from '../frontend/src/server/video-generation/private-engine-registry';
import { getConfiguredEngineIncludingHidden } from '../frontend/src/server/engines';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';

const req = new NextRequest('http://localhost/api/generate', { method: 'POST' });

const privateRuntimeBoundaries = {
  getConfiguredEngine: async () => undefined,
  getConfiguredEngineIncludingHidden: async (engineId: string) =>
    engineId === MINIMAX_H3_MAX_ENGINE.id ? MINIMAX_H3_MAX_ENGINE : undefined,
  isDatabaseConfigured: () => true,
  ensureBillingSchema: async () => undefined,
};

test('MiniMax H3 Max resolves through the private generation runtime without entering the public catalog', async () => {
  assert.equal(listFalEngines().some(({ id }) => id === 'minimax-h3-max'), false);
  assert.equal(getPrivateRuntimeEngineById('minimax-h3-max')?.id, 'minimax-h3-max');
  assert.equal((await getConfiguredEngineIncludingHidden('minimax-h3-max'))?.id, 'minimax-h3-max');

  const result = await resolveGenerateRouteContext({
    body: { engineId: 'minimax-h3-max', mode: 't2v', jobId: 'job_h3_max_private' },
    req,
    boundaryOverrides: privateRuntimeBoundaries,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.engine.id, 'minimax-h3-max');
  assert.equal(result.context.providerKey, 'fal');
  assert.deepEqual(result.context.providerRoutingPlan, {
    kind: 'fal_only',
    primaryProvider: 'fal',
    fallbackEnabled: false,
  });
});

test('MiniMax H3 Max media modes fail closed while live size and format limits are unverified', async () => {
  for (const mode of ['i2v', 'ref2v'] as const) {
    const result = await resolveGenerateRouteContext({
      body: { engineId: 'minimax-h3-max', mode, jobId: `job_h3_max_${mode}` },
      req,
      boundaryOverrides: privateRuntimeBoundaries,
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      body: { ok: false, error: 'Engine unavailable' },
    });
  }
});

test('MiniMax H3 Max private request options use the documented runtime defaults', () => {
  const result = buildGenerateRequestOptions({
    body: { prompt: 'A glass observatory turns slowly beneath the stars.' },
    engine: MINIMAX_H3_MAX_ENGINE,
    mode: 't2v',
    isBytePlusV1a: false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.options.durationSec, 5);
  assert.equal(result.options.effectiveResolution, '768P');
  assert.equal(result.options.aspectRatio, '16:9');
  assert.equal(result.options.supportsFps, false);
});

test('the production model resolver and Fal request dispatcher invoke the MiniMax H3 Max builder', async () => {
  const payload = {
    engineId: 'minimax-h3-max',
    mode: 't2v',
    prompt: 'An original explorer crosses a mirrored salt flat at dawn.',
    durationSec: 5,
    resolution: '768P',
    aspectRatio: '21:9',
    audio: true,
    extraInputValues: { prompt_expansion_mode: 'quality' },
  };

  assert.equal(
    resolveFalModelSlug(payload, 'fal-ai/video/minimax-h3-max'),
    'minimax/h3-max/text-to-video',
  );
  assert.equal(await resolveFalModelId('minimax-h3-max'), 'minimax/h3-max/text-to-video');
  assert.equal(
    await resolveEngineIdFromModelSlug('minimax/h3-max/text-to-video'),
    'minimax-h3-max',
  );
  assert.deepEqual(
    buildFalGenerationRequest(payload, 'fal-ai/video/minimax-h3-max'),
    {
      model: 'minimax/h3-max/text-to-video',
      requestBody: {
        prompt: 'An original explorer crosses a mirrored salt flat at dawn.',
        duration: 5,
        resolution: '768P',
        aspect_ratio: '21:9',
        prompt_expansion_mode: 'quality',
      },
    },
  );
});

test('the production request validator accepts private H3 Max text requests from its runtime schema', () => {
  assert.deepEqual(validateRequest(
    'minimax-h3-max',
    't2v',
    {
      prompt: 'A glass observatory turns slowly beneath the stars.',
      duration: 5,
      resolution: '768P',
      aspect_ratio: '16:9',
    },
    { inputSchema: MINIMAX_H3_MAX_ENGINE.inputSchema },
  ), { ok: true });
});
