import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import test from 'node:test';
import { NextRequest } from 'next/server';

import {
  getRuntimeModelById,
  resolveRuntimeEngineInput,
} from '../frontend/config/model-runtime';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import {
  getBaseEngineIncludingHidden,
  getBaseEngines,
} from '../frontend/src/lib/engines';
import { ENV } from '../frontend/src/lib/env';
import {
  BYTEPLUS_SEEDANCE_2_5_DEFAULT_MODEL_ID,
  assertBytePlusSeedanceSubmissionEnabled,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceSubmissionEnabled,
  requireBytePlusSeedanceProfile,
} from '../frontend/src/server/video-providers/byteplus-modelark';
import {
  BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO,
  BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES,
  BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES,
  BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS,
} from '../frontend/src/server/video-providers/byteplus-modelark-constants';
import { getBytePlusUnitPriceUsdPer1kTokens } from '../frontend/server/byteplus-accounting';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import {
  BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  buildSeedance25PricingDetails,
} from '../frontend/src/config/fal-engines/launch-config';
import { resolveSeedance2Dimensions } from '../frontend/src/lib/seedance-2-pricing';

const slug = 'seedance-2-5';
const supportedAspectRatios = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];

test('Seedance 2.5 is the public flagship across every product surface', () => {
  const model = getRuntimeModelById(slug);
  assert.ok(model);
  assert.notEqual(model.presentationOnly, true);
  assert.equal(resolveRuntimeEngineInput(slug)?.id, slug);
  assert.equal(model.publication.model.published, true);
  assert.equal(model.publication.model.indexable, true);
  assert.equal(model.publication.examples.published, true);
  assert.equal(model.publication.examples.includeInFamilyCopy, true);
  assert.equal(model.publication.examples.current, true);
  assert.equal(model.publication.compare.published, true);
  assert.equal(model.publication.compare.indexed, true);
  assert.equal(model.publication.app.published, true);
  assert.equal(model.publication.pricing.published, true);
  assert.equal(model.publication.sitemap.published, true);
  assert.equal(model.publication.app.launchBadge, 'new');

  assert.equal(model.publication.examples.familyRank, 0);
  assert.deepEqual(model.publication.compare.suggestedOpponentIds, [
    'seedance-2-0',
    'kling-3-pro',
    'veo-3-1',
  ]);
  assert.deepEqual(model.publication.compare.publishedPairIds, [
    'seedance-2-0',
    'kling-3-pro',
    'minimax-h3',
    'veo-3-1',
  ]);
  assert.equal(model.publication.app.discoveryRank, -3);
  assert.equal(model.publication.app.variantGroup, 'seedance-2-0');
  assert.equal(model.publication.app.variantLabel, '2.5');
  assert.equal(model.publication.pricing.featuredScenario, 'seedance-2-family');

  const publicEngine = getFalEngineById(slug);
  assert.equal(publicEngine?.id, slug);
  assert.equal(publicEngine?.availability, 'available');
  assert.equal(publicEngine?.engine.availability, 'available');
  assert.equal(getBaseEngineIncludingHidden(slug)?.id, slug);
  assert.equal(getBaseEngines().some((engine) => engine.id === slug), true);

  const engineCatalog = JSON.parse(
    readFileSync('frontend/config/engine-catalog.json', 'utf8'),
  ) as Array<{ engineId?: string }>;
  const modelRoster = JSON.parse(
    readFileSync('frontend/config/model-roster.json', 'utf8'),
  ) as Array<{ engineId?: string }>;
  assert.equal(engineCatalog.some((entry) => entry.engineId === slug), true);
  assert.equal(modelRoster.some((entry) => entry.engineId === slug), true);
});

test('Seedance publication ranks and reciprocal flagship comparison pairs stay exact', () => {
  const expectedRanks = new Map([
    ['seedance-2-5', 0],
    ['seedance-2-0', 1],
    ['seedance-2-0-fast', 2],
    ['seedance-2-0-mini', 3],
  ]);
  for (const [modelId, expectedRank] of expectedRanks) {
    assert.equal(getRuntimeModelById(modelId)?.publication.examples.familyRank, expectedRank, modelId);
  }

  const standard = getRuntimeModelById('seedance-2-0');
  assert.ok(standard);
  assert.deepEqual(standard.publication.compare.suggestedOpponentIds, [
    'veo-3-1',
    'kling-3-pro',
    'sora-2',
  ]);
  for (const opponentId of ['seedance-2-0', 'kling-3-pro', 'veo-3-1']) {
    assert.equal(
      getRuntimeModelById(opponentId)?.publication.compare.publishedPairIds.includes(slug),
      true,
      opponentId,
    );
  }
});

test('Seedance 2.5 exposes one unified five-mode engine schema', () => {
  const entry = getFalEngineById(slug);
  assert.ok(entry);
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(entry.modes.map(({ mode }) => mode), ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(entry.engine.aspectRatios, supportedAspectRatios);
  assert.deepEqual(
    entry.modes.map(({ ui }) => ui.aspectRatio),
    [supportedAspectRatios, undefined, supportedAspectRatios, supportedAspectRatios, supportedAspectRatios],
  );
  assert.equal(entry.engine.inputSchema?.referenceBudget?.maxTotal, 50);
  assert.deepEqual(entry.engine.inputSchema?.referenceBudget?.fieldIds, [
    'image_url',
    'end_image_url',
    'image_urls',
    'video_url',
    'video_urls',
    'extension_source_videos',
    'audio_urls',
  ]);

  const fields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ];
  assert.equal(fields.find((field) => field.id === 'image_urls')?.maxCount, 30);
  assert.equal(fields.find((field) => field.id === 'video_urls')?.maxCount, 10);
  assert.equal(fields.find((field) => field.id === 'extension_source_videos')?.maxCount, 3);
  assert.equal(fields.find((field) => field.id === 'audio_urls')?.maxCount, 10);
  assert.deepEqual(fields.find((field) => field.id === 'aspect_ratio')?.values, supportedAspectRatios);
  assert.deepEqual(fields.find((field) => field.id === 'aspect_ratio')?.modes, [
    't2v',
    'ref2v',
    'v2v',
    'extend',
  ]);
});

test('Seedance 2.5 owns a dedicated fail-closed ModelArk profile', () => {
  const profile = requireBytePlusSeedanceProfile(slug);
  assert.equal(profile.modelConfigKey, 'seedance25ModelId');
  assert.equal(profile.pricingProfileKey, 'seedance25');
  assert.deepEqual(profile.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(profile.resolutions, ['480p', '720p', '1080p']);
  assert.deepEqual(profile.aspectRatios, supportedAspectRatios);
  assert.deepEqual(profile.durationOptions, Array.from({ length: 27 }, (_, index) => index + 4));
  assert.equal(profile.defaultDurationSec, 4);
  assert.equal(profile.defaultResolution, '480p');
  assert.equal(profile.framesPerSecond, 24);
  assert.equal(profile.generatedAudio, true);
  assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES, 50);
  assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES, 30);
  assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS, 10);
  assert.equal(BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO, 10);
  assert.equal(getFalEngineById(slug)?.engine.audio, true);
  assert.equal(profile.routing.enabledKey, 'SEEDANCE_2_5_BYTEPLUS_ENABLED');
  assert.equal(profile.routing.providerOverrideKey, 'SEEDANCE_2_5_PROVIDER');
  assert.equal(profile.routing.adminOnlyKey, 'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY');
  assert.equal(profile.routing.allowedModesKey, 'SEEDANCE_2_5_BYTEPLUS_MODES');
  assert.equal(BYTEPLUS_SEEDANCE_2_5_DEFAULT_MODEL_ID, 'dreamina-seedance-2-5-260628');
  assert.equal(BYTEPLUS_SEEDANCE_2_5_MODEL_ID, BYTEPLUS_SEEDANCE_2_5_DEFAULT_MODEL_ID);

  const original = {
    enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    provider: ENV.SEEDANCE_2_5_PROVIDER,
    adminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
  };
  try {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
    ENV.SEEDANCE_2_5_PROVIDER = 'disabled';
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'true';
    assert.equal(isBytePlusSeedanceSubmissionEnabled(slug), false);
    assert.equal(isBytePlusSeedanceAdminOnly(slug), true);
    assert.throws(
      () => assertBytePlusSeedanceSubmissionEnabled(slug),
      (error: unknown) =>
        error instanceof Error &&
        (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_DISABLED',
    );

    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
    ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
    assert.equal(isBytePlusSeedanceSubmissionEnabled(slug), true);
  } finally {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.adminOnly;
  }
});

test('Seedance 2.5 pricing uses its factual ModelArk rates and approved 2.5x policy', () => {
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens(slug, 'no_video_input'), 0.0107);
  assert.equal(getBytePlusUnitPriceUsdPer1kTokens(slug, 'video_input'), 0.0064);

  const tokenPricing = buildSeedance25PricingDetails().tokenPricing;
  assert.ok(tokenPricing);
  assert.equal(tokenPricing.pricingSource, 'byteplus_seedance_2_5_260628_approved_2_5x');
  assert.equal(tokenPricing.defaultAspectRatio, '16:9');
  assert.equal(tokenPricing.framesPerSecond, 24);

  const expectedDimensions = {
    '480p': {
      '21:9': [1120, 480],
      '16:9': [854, 480],
      '4:3': [640, 480],
      '1:1': [480, 480],
      '3:4': [480, 640],
      '9:16': [480, 854],
    },
    '720p': {
      '21:9': [1680, 720],
      '16:9': [1280, 720],
      '4:3': [960, 720],
      '1:1': [720, 720],
      '3:4': [720, 960],
      '9:16': [720, 1280],
    },
  } as const;
  const pricingDetails = buildSeedance25PricingDetails();
  assert.ok(pricingDetails.tokenPricing);
  for (const resolution of ['480p', '720p'] as const) {
    for (const aspectRatio of supportedAspectRatios) {
      const dimensions = resolveSeedance2Dimensions(
        { ...pricingDetails, tokenPricing: pricingDetails.tokenPricing },
        resolution,
        aspectRatio,
      );
      assert.deepEqual(
        [dimensions.width, dimensions.height],
        expectedDimensions[resolution][aspectRatio as keyof typeof expectedDimensions[typeof resolution]],
        `${resolution} ${aspectRatio}`,
      );
      assert.equal(dimensions.aspectRatio, aspectRatio);
    }
  }
});

test('disabled Seedance 2.5 returns before configured-engine database access', { concurrency: false }, async () => {
  let databaseConnections = 0;
  const databaseBoundary = createServer((socket) => {
    databaseConnections += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => databaseBoundary.listen(0, '127.0.0.1', resolve));
  const address = databaseBoundary.address();
  assert.ok(address && typeof address !== 'string');

  const original = {
    databaseUrl: process.env.DATABASE_URL,
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  process.env.DATABASE_URL = `postgres://test:test@127.0.0.1:${address.port}/maxvideoai`;
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';

  try {
    const result = await resolveGenerateRouteContext({
      body: { engineId: slug, mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
    });
    assert.deepEqual(result, {
      ok: false,
      status: 404,
      body: { ok: false, error: 'Engine unavailable' },
    });
    assert.equal(databaseConnections, 0);
  } finally {
    if (original.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original.databaseUrl;
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    await new Promise<void>((resolve, reject) =>
      databaseBoundary.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('public configured Seedance 2.5 resolves without admin or hidden-engine access', { concurrency: false }, async () => {
  const engine = getFalEngineById(slug)?.engine;
  assert.ok(engine);
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    arkApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    modelId: ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    seedance25AdminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
  };
  const boundaryCalls: string[] = [];
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.BYTEPLUS_ARK_API_KEY = 'ark-test-key';
  ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = BYTEPLUS_SEEDANCE_2_5_DEFAULT_MODEL_ID;
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'false';

  try {
    const result = await resolveGenerateRouteContext({
      body: { engineId: slug, mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
      boundaryOverrides: {
        getConfiguredEngine: async () => {
          boundaryCalls.push('getConfiguredEngine');
          return engine;
        },
        getConfiguredEngineIncludingHidden: async () => {
          boundaryCalls.push('getConfiguredEngineIncludingHidden');
          throw new Error('public Seedance 2.5 must not use the hidden fallback');
        },
        isDatabaseConfigured: () => true,
        ensureBillingSchema: async () => undefined,
        requireAdmin: async () => {
          boundaryCalls.push('requireAdmin');
          throw new Error('public Seedance 2.5 must not require an administrator');
        },
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail('public configured Seedance 2.5 should resolve');
    assert.equal(result.context.engine.id, slug);
    assert.equal(result.context.providerKey, 'byteplus_modelark');
    assert.equal(result.context.isBytePlusV1a, true);
    assert.deepEqual(boundaryCalls, ['getConfiguredEngine']);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_API_KEY = original.arkApiKey;
    ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = original.modelId;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25AdminOnly;
  }
});

test('Seedance 2.5 never falls back to hidden configured-engine resolution', { concurrency: false }, async () => {
  const hiddenEngine = getFalEngineById(slug)?.engine;
  assert.ok(hiddenEngine);
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    modelId: ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    seedance25AdminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
  };
  let hiddenFallbackCalls = 0;
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = BYTEPLUS_SEEDANCE_2_5_DEFAULT_MODEL_ID;
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'false';

  try {
    const result = await resolveGenerateRouteContext({
      body: { engineId: slug, mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
      boundaryOverrides: {
        getConfiguredEngine: async () => undefined,
        getConfiguredEngineIncludingHidden: async () => {
          hiddenFallbackCalls += 1;
          return hiddenEngine;
        },
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: { ok: false, error: 'Unknown engine' },
    });
    assert.equal(hiddenFallbackCalls, 0);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = original.modelId;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25AdminOnly;
  }
});

test('the production handoff records the public flagship matrix, safe local defaults, and rollback', () => {
  const packet = readFileSync('docs/model-launch/seedance-2-5.md', 'utf8');
  const stub = readFileSync('docs/model-launch/seedance-2-5.engine.stub.ts', 'utf8');
  const localEnvironment = readFileSync('frontend/.env.local.example', 'utf8');

  for (const required of [
    'dreamina-seedance-2-5-260628',
    'BYTEPLUS_ARK_ENABLED=true',
    'BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED=true',
    'SEEDANCE_2_5_PROVIDER=byteplus_modelark',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false',
    'SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,extend',
    'SEEDANCE_2_5_LAS_ENABLED=false',
    'kill switch',
    'no automated retry',
    'rollback',
    'wallet',
    'refund',
    'City',
    'Train',
    'indexable',
    'sitemap',
  ]) {
    assert.match(packet, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  for (const required of [
    'BYTEPLUS_ARK_ENABLED=false',
    'BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID=dreamina-seedance-2-5-260628',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED=false',
    'SEEDANCE_2_5_PROVIDER=disabled',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=true',
    'SEEDANCE_2_5_BYTEPLUS_MODES=t2v',
    'SEEDANCE_2_5_LAS_ENABLED=false',
  ]) {
    assert.match(localEnvironment, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(packet, /City[\s\S]*Train[\s\S]*Dialogue[\s\S]*private/i);
  assert.match(packet, /public flagship launch/i);
  assert.match(packet, /no additional pre-launch paid generation/i);
  assert.match(packet, /ModelArk text, image, reference, and extension execution is the current proven direct route/i);
  assert.match(packet, /LAS V2V execution is pending exact pricing\/accounting/i);
  assert.match(packet, /BYTEPLUS_ARK_ENABLED=true[\s\S]*existing jobs[\s\S]*(?:poll|reconcil)/i);
  assert.match(packet, /publication\.app\.published=false/);
  assert.match(packet, /publication\.pricing\.published=false/);
  assert.match(packet, /stored charged amounts/i);
  assert.match(packet, /without redirecting or deleting the route/i);
  assert.match(packet, /\.\/seedance-2-5-linkedin-launch\.md/);

  for (const requiredSmokeEvidence of [
    '/models/seedance-2-5',
    '/fr/modeles/seedance-2-5',
    '/es/modelos/seedance-2-5',
    'engine=seedance-2-5',
    'T2V, I2V, Ref2V, and Extend are executable',
    'V2V remains gated',
    'self-canonical metadata',
    'all three comparison pages',
    'Benchmark Lab',
    'media ranges for City and Train',
  ]) {
    assert.match(
      packet,
      new RegExp(requiredSmokeEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    );
  }

  assert.match(stub, /runtimeEntryAllowed:\s*true/);
  assert.match(stub, /documentationOnly:\s*true/);
  assert.match(stub, /currentPhase:\s*'modelark_reference_modes_operational_las_v2v_gated'/);
  assert.match(stub, /nextRequiredPhase:\s*'las_pricing_and_canary'/);
  assert.match(stub, /publicGenerationAllowed:\s*true/);
  assert.match(stub, /publicMarketingPageAllowed:\s*true/);
  assert.match(stub, /publicDiscoveryAllowed:\s*true/);
  assert.match(stub, /targetModes:\s*\['t2v', 'i2v', 'ref2v', 'v2v', 'extend'\]/);
  assert.match(stub, /executableModes:\s*\['t2v', 'i2v', 'ref2v', 'extend'\]/);
  assert.match(stub, /references:\s*true/);
  assert.match(stub, /editing:\s*false/);
  assert.match(stub, /extension:\s*true/);
});

test('the LinkedIn launch package confines approved Seedance 2.5 copy to City and Train', () => {
  const launchPackage = readFileSync('docs/model-launch/seedance-2-5-linkedin-launch.md', 'utf8');

  for (const required of [
    'https://maxvideoai.com/models/seedance-2-5',
    'https://maxvideoai.com/app?engine=seedance-2-5',
    'The city in the suitcase',
    'The glass lightning train',
    'Announcement post',
    'City creative post',
    'Train movement and structure post',
    'utm_source=linkedin&utm_medium=social&utm_campaign=seedance_2_5_launch&utm_content=announcement',
    'utm_source=linkedin&utm_medium=social&utm_campaign=seedance_2_5_launch&utm_content=city',
    'utm_source=linkedin&utm_medium=social&utm_campaign=seedance_2_5_launch&utm_content=train',
    'Do not publish automatically.',
    'explicit product-owner approval',
    'outside repository deployment',
    'Alt text — City',
    'Alt text — Train',
    'opens a suitcase on a railway platform',
    'coastal city with water and buildings',
  ]) {
    assert.match(launchPackage, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(launchPackage, /Dialogue[\s\S]*private/i);
  assert.doesNotMatch(launchPackage, /carries a suitcase/i);
  assert.doesNotMatch(launchPackage, /(?:lip[ -]?sync|ModelArk|provider|USD|\$)/i);
});
