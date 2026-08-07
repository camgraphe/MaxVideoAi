import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
import { getBytePlusUnitPriceUsdPer1kTokens } from '../frontend/server/byteplus-accounting';
import {
  BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  buildSeedance25PricingDetails,
} from '../frontend/src/config/fal-engines/launch-config';

const slug = 'seedance-2-5';

test('Seedance 2.5 is an executable hidden engine with no public generation surface', () => {
  const model = getRuntimeModelById(slug);
  assert.ok(model);
  assert.notEqual(model.presentationOnly, true);
  assert.equal(resolveRuntimeEngineInput(slug)?.id, slug);
  assert.equal(model.publication.model.published, true);
  assert.equal(model.publication.model.indexable, false);
  assert.equal(model.publication.app.published, false);
  assert.equal(model.publication.pricing.published, false);
  assert.equal(model.publication.examples.published, false);
  assert.equal(model.publication.compare.published, false);
  assert.equal(model.publication.sitemap.published, false);

  assert.equal(getFalEngineById(slug)?.id, slug);
  assert.equal(getBaseEngineIncludingHidden(slug)?.id, slug);
  assert.equal(getBaseEngines().some((engine) => engine.id === slug), false);

  const engineCatalog = JSON.parse(
    readFileSync('frontend/config/engine-catalog.json', 'utf8'),
  ) as Array<{ engineId?: string }>;
  const modelRoster = JSON.parse(
    readFileSync('frontend/config/model-roster.json', 'utf8'),
  ) as Array<{ engineId?: string }>;
  assert.equal(engineCatalog.some((entry) => entry.engineId === slug), true);
  assert.equal(modelRoster.some((entry) => entry.engineId === slug), true);
});

test('Seedance 2.5 owns a dedicated fail-closed ModelArk profile', () => {
  const profile = requireBytePlusSeedanceProfile(slug);
  assert.equal(profile.modelConfigKey, 'seedance25ModelId');
  assert.equal(profile.pricingProfileKey, 'seedance25');
  assert.deepEqual(profile.supportedModes, ['t2v']);
  assert.deepEqual(profile.resolutions, ['480p', '720p']);
  assert.deepEqual(profile.aspectRatios, ['16:9']);
  assert.equal(profile.durationOptions[0], 4);
  assert.equal(profile.durationOptions.at(-1), 30);
  assert.equal(profile.defaultDurationSec, 4);
  assert.equal(profile.defaultResolution, '480p');
  assert.equal(profile.framesPerSecond, 24);
  assert.equal(profile.generatedAudio, false);
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
});

test('the generation route enforces the Seedance 2.5 kill switch before database and billing', () => {
  const source = readFileSync(
    'frontend/app/api/generate/_lib/route-context.ts',
    'utf8',
  );
  const gate = source.indexOf('assertBytePlusSeedanceSubmissionEnabled(engine.id)');
  const database = source.indexOf('isDatabaseConfigured()');
  const billing = source.indexOf('await ensureBillingSchema()');
  assert.ok(gate >= 0);
  assert.ok(database > gate);
  assert.ok(billing > gate);
});

test('the production handoff records the factual canary, controls, rollback, and verification', () => {
  const packet = readFileSync('docs/model-launch/seedance-2-5.md', 'utf8');
  const stub = readFileSync('docs/model-launch/seedance-2-5.engine.stub.ts', 'utf8');

  for (const required of [
    'dreamina-seedance-2-5-260628',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED',
    'SEEDANCE_2_5_PROVIDER',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
    'SEEDANCE_2_5_BYTEPLUS_MODES',
    '38,830',
    'paid_wallet',
    'one charge',
    'HTTP 206',
    'video/mp4',
    'BYTEPLUS_RESOLUTION_UNSUPPORTED',
    '2.5×',
    '480p',
    '720p',
    '4–30',
    'noindex, follow',
    'Rollback',
    'git diff --check',
  ]) {
    assert.match(packet, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(packet, /Provider task ID[^\n]*not stored/i);
  assert.match(packet, /public[^\n]*(?:disabled|closed)/i);
  assert.match(packet, /commercial use[^\n]*confirmed/i);
  assert.match(stub, /runtimeEntryAllowed:\s*true/);
  assert.match(stub, /documentationOnly:\s*true/);
});
