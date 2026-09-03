import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { buildFalRequestParts } from '../frontend/app/api/generate/_lib/fal-request';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { getFalEngineById, listFalEngines } from '../frontend/src/config/falEngines';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import type { GenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import type { EngineCaps, Mode, PreflightRequest } from '../frontend/types/engines';

const STAGING_URL = 'https://maxvideoai-mcp-staging.vercel.app';
function publicEngine(engineId: string): EngineCaps {
  const engine = listFalEngines().find((entry) => entry.id === engineId)?.engine;
  assert.ok(engine, `Missing public engine ${engineId}`);
  return engine;
}

async function resolveModeAtGenerateBoundary(input: {
  engine: EngineCaps;
  modePresent: boolean;
  mode?: unknown;
}) {
  let databaseChecks = 0;
  let billingChecks = 0;
  const body: Record<string, unknown> = { engineId: input.engine.id };
  if (input.modePresent) body.mode = input.mode;
  const result = await resolveGenerateRouteContext({
    req: new NextRequest(`${STAGING_URL}/api/generate`, { method: 'POST' }),
    body,
    boundaryOverrides: {
      resolveLaunchCanaryRequestContext: async () => null,
      getConfiguredEngine: async () => input.engine,
      getConfiguredEngineIncludingHidden: async () => undefined,
      isDatabaseConfigured: () => {
        databaseChecks += 1;
        return true;
      },
      ensureBillingSchema: async () => {
        billingChecks += 1;
      },
    },
  });
  return { result, databaseChecks, billingChecks };
}

test('generate defaults only a truly absent mode and keeps normalized public mode compatibility', async () => {
  const publicPika = getFalEngineById('pika-text-to-video')?.engine;
  assert.ok(publicPika);

  for (const fixture of [
    { engine: KLING_3_TURBO_STANDARD_ENGINE },
    { engine: publicPika },
  ]) {
    const omitted = await resolveModeAtGenerateBoundary({
      ...fixture,
      modePresent: false,
    });
    assert.equal(omitted.result.ok, true);
    if (omitted.result.ok) assert.equal(omitted.result.context.mode, 't2v');
    assert.equal(omitted.databaseChecks, 1);
    assert.equal(omitted.billingChecks, 1);
  }

  const normalizedPublic = await resolveModeAtGenerateBoundary({
    engine: publicPika,
    modePresent: true,
    mode: '  T2V  ',
  });
  assert.equal(normalizedPublic.result.ok, true);
  if (normalizedPublic.result.ok) assert.equal(normalizedPublic.result.context.mode, 't2v');
});

test('generate rejects every explicitly invalid mode before database and billing work', async (context) => {
  const publicPika = getFalEngineById('pika-text-to-video')?.engine;
  assert.ok(publicPika);
  const invalidModes: Array<{ label: string; value: unknown }> = [
    { label: 'empty string', value: '' },
    { label: 'whitespace string', value: '   ' },
    { label: 'null', value: null },
    { label: 'undefined property', value: undefined },
    { label: 'number', value: 7 },
    { label: 'object', value: { value: 't2v' } },
    { label: 'unknown string', value: 'bogus' },
  ];

  for (const fixture of [
    { label: 'P1 public', engine: KLING_3_TURBO_STANDARD_ENGINE },
    { label: 'established public', engine: publicPika },
  ]) {
    for (const invalid of invalidModes) {
      await context.test(`${fixture.label}: ${invalid.label}`, async () => {
        const resolved = await resolveModeAtGenerateBoundary({
          ...fixture,
          modePresent: true,
          mode: invalid.value,
        });
        assert.deepEqual(resolved.result, {
          ok: false,
          status: 400,
          body: { ok: false, error: 'Invalid mode' },
        });
        assert.equal(resolved.databaseChecks, 0);
        assert.equal(resolved.billingChecks, 0);
      });
    }
  }
});

function buildOmittedGenerateOptions(engine: EngineCaps, mode: Mode): GenerateRequestOptions {
  const result = buildGenerateRequestOptions({
    body: { prompt: 'A controlled omitted-resolution parity test.' },
    engine,
    mode,
    isBytePlusV1a: false,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Generation option normalization unexpectedly failed.');
  return result.options;
}

async function computeFinalPrice(
  engine: EngineCaps,
  mode: Mode,
  options: GenerateRequestOptions,
) {
  return computeCanonicalPublicSnapshot({
    engine,
    durationSec: options.durationSec,
    resolution: options.pricingResolution,
    aspectRatio: options.aspectRatio,
    mode,
    membershipTier: 'Member',
  });
}

async function computeOmittedPreflight(
  engine: EngineCaps,
  mode: Mode,
  durationSec: number,
) {
  const request: PreflightRequest = {
    engine: engine.id,
    mode,
    durationSec,
    fps: engine.fps[0] ?? 24,
    user: { memberTier: 'Member' },
  };
  return computeConfiguredPreflight(request, { resolvedEngine: engine });
}

test('H3 Max omitted-resolution preflight uses the same 768P setting and 52-cent price as generation', async () => {
  const generate = buildOmittedGenerateOptions(MINIMAX_H3_MAX_ENGINE, 't2v');
  assert.deepEqual({
    supportsResolution: generate.supportsResolution,
    requestedResolution: generate.requestedResolution,
    pricingResolution: generate.pricingResolution,
    effectiveResolution: generate.effectiveResolution,
  }, {
    supportsResolution: true,
    requestedResolution: '768P',
    pricingResolution: '768P',
    effectiveResolution: '768P',
  });

  const finalPrice = await computeFinalPrice(MINIMAX_H3_MAX_ENGINE, 't2v', generate);
  const preflight = await computeOmittedPreflight(
    MINIMAX_H3_MAX_ENGINE,
    't2v',
    generate.durationSec,
  );
  assert.equal(finalPrice.totalCents, 52);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.total, 52);
  assert.equal(preflight.total, finalPrice.totalCents);
  assert.equal(
    (preflight.pricing?.meta?.cost_breakdown_usd as { resolution?: unknown } | undefined)?.resolution,
    '768P',
  );
});

test('Kling Turbo i2v keeps resolution unset for dispatch while omitted preflight matches its 73-cent price', async () => {
  const engine = KLING_3_TURBO_STANDARD_ENGINE;
  const generate = buildOmittedGenerateOptions(engine, 'i2v');
  assert.equal(generate.supportsResolution, false);
  assert.equal(generate.pricingResolution, '720p');

  const falRequest = buildFalRequestParts({
    attachments: [],
    engineId: engine.id,
    prompt: 'Animate the verified first frame.',
    mode: 'i2v',
    apiKey: undefined,
    jobId: 'job_round4_kling',
    localKey: null,
    needsImage: true,
    needsFirstLastFrames: false,
    initialImageUrl: 'https://cdn.maxvideoai.com/round4-start.png',
    resolvedFirstFrameUrl: 'https://cdn.maxvideoai.com/round4-start.png',
    lastFrameUrl: undefined,
    resolvedAudioUrl: undefined,
    normalizedReferenceImages: [],
    videoUrls: [],
    audioUrls: [],
    soraRequest: null,
    isLumaRay2: false,
    loop: false,
    multiPrompt: null,
    shotType: 'customize',
    seed: null,
    cameraFixed: null,
    safetyChecker: null,
    voiceIds: [],
    elements: null,
    endImageUrl: null,
    extraInputValues: {},
    supportsDuration: generate.supportsDuration,
    durationSec: generate.durationSec,
    durationOption: generate.rawDurationOption,
    numFrames: generate.numFrames,
    supportsAspectRatio: generate.supportsAspectRatio,
    aspectRatio: generate.aspectRatio,
    supportsResolution: generate.supportsResolution,
    resolution: generate.effectiveResolution,
    audioEnabled: generate.audioEnabled,
    supportsFps: generate.supportsFps,
    fps: undefined,
    cfgScale: undefined,
  });
  assert.equal(Object.hasOwn(falRequest.falPayload, 'resolution'), false);

  const finalPrice = await computeFinalPrice(engine, 'i2v', generate);
  const preflight = await computeOmittedPreflight(engine, 'i2v', generate.durationSec);
  assert.equal(finalPrice.totalCents, 73);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.total, 73);
  assert.equal(preflight.total, finalPrice.totalCents);
});

test('public omitted-resolution preflight preserves generation defaults when schema order differs', async () => {
  const engine = publicEngine('wan-3');
  const resolutionField = [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ].find((field) => field.id === 'resolution' && field.modes?.includes('t2v'));
  assert.equal(engine.resolutions[0], '480p');
  assert.equal(resolutionField?.default, '1080p');

  const generate = buildOmittedGenerateOptions(engine, 't2v');
  assert.equal(generate.requestedResolution, '480p');
  assert.equal(generate.pricingResolution, '480p');

  const finalPrice = await computeFinalPrice(engine, 't2v', generate);
  const preflight = await computeOmittedPreflight(engine, 't2v', generate.durationSec);
  assert.equal(finalPrice.totalCents, 26);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.total, 26);
  assert.equal(preflight.total, finalPrice.totalCents);
});
