import assert from 'node:assert/strict';
import test from 'node:test';

import { getBaseEngines, getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { buildEngineSettingsSeedPayload, projectSeededEngineSettings } from '../frontend/src/server/engine-settings-defaults';
import { getReadOnlyConfiguredEngine, getReadOnlyConfiguredEngineIncludingHidden, getReadOnlyConfiguredEngineIncludingRuntimePrivate } from '../frontend/src/server/agent-api/read-only-engine-catalog';
import type { EngineSettingsRecord } from '../frontend/src/server/engine-configuration-read';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import type { LaunchCanaryRequestContext } from '../frontend/src/server/model-launch-canary-request';
import type { EngineCaps } from '../frontend/types/engines';

const base = getBaseEngines().find((engine) => engine.id === 'sora-2')!;
const stale: EngineSettingsRecord = {
  engine_id: base.id,
  options: { maxDurationSec: 1 },
  pricing: { currency: 'USD', perSecondCents: { default: 1 } },
  updated_by: null,
  updated_at: '2026-01-01T00:00:00Z',
};

test('system defaults preserve admin ownership and legacy pricing fallback without mutating inputs', () => {
  const original = structuredClone({ base, stale });
  const payload = buildEngineSettingsSeedPayload(base, stale);
  assert.equal(payload?.options.maxDurationSec, base.maxDurationSec);
  assert.deepEqual(payload?.pricing, JSON.parse(JSON.stringify(base.pricingDetails)));
  assert.equal(Object.hasOwn(payload?.pricing ?? {}, 'byMode'), false, 'omit undefined values just like stored JSON');
  assert.equal(buildEngineSettingsSeedPayload(base, { ...stale, updated_by: 'admin' }), null);
  assert.equal(buildEngineSettingsSeedPayload(base, stale, 'operator')?.updated_by, 'operator');
  const legacyBase = { ...base, pricingDetails: undefined, pricing: { unit: 'sec' as const, currency: 'USD', base: 0.125 } };
  assert.deepEqual(buildEngineSettingsSeedPayload(legacyBase)?.pricing, {
    currency: 'USD', perSecondCents: { default: 13 }, maxDurationSec: base.maxDurationSec,
  });
  assert.deepEqual(buildEngineSettingsSeedPayload({ ...base, pricingDetails: undefined, pricing: undefined }, stale)?.pricing, stale.pricing);
  const settings = new Map([[base.id, stale]]);
  const effective = projectSeededEngineSettings([base], settings);
  assert.notEqual(effective, settings);
  assert.equal(effective.get(base.id)?.updated_at, stale.updated_at);
  assert.deepEqual({ base, stale }, original);
  assert.equal(settings.get(base.id), stale);
});

test('private-capable preflight refreshes only the seeded public population, not hidden/image or existing MCP readers', async () => {
  const image = getBaseEnginesByCategory('image')[0];
  assert.ok(image);
  assert.ok(!getBaseEngines().some((engine) => engine.id === image.id));
  const settings = new Map([[base.id, stale], [image.id, { ...stale, engine_id: image.id }]]);
  let settingsReads = 0;
  let overrideReads = 0;
  const dependencies = {
    databaseConfigured: () => true,
    fetchSettings: async () => { settingsReads += 1; return settings; },
    fetchOverrides: async () => { overrideReads += 1; return new Map(); },
  };
  const publicEngine = await getReadOnlyConfiguredEngine(base.id, false, dependencies);
  assert.equal(publicEngine?.maxDurationSec, base.maxDurationSec);
  assert.deepEqual(await getReadOnlyConfiguredEngineIncludingRuntimePrivate(base.id, false, dependencies), publicEngine);
  assert.equal((await getReadOnlyConfiguredEngineIncludingRuntimePrivate(image.id, false, dependencies))?.maxDurationSec, 1);
  assert.equal((await getReadOnlyConfiguredEngineIncludingHidden(base.id, false, dependencies))?.maxDurationSec, 1);
  assert.equal(settingsReads, 4);
  assert.equal(overrideReads, 4);
  assert.equal(settings.get(base.id), stale);
});

test('database-free preflight keeps the existing base-only resolution without configuration reads', async () => {
  const dependencies = {
    databaseConfigured: () => false,
    fetchSettings: async () => { throw new Error('unexpected settings read'); },
    fetchOverrides: async () => { throw new Error('unexpected overrides read'); },
  };
  const engine = await getReadOnlyConfiguredEngine(base.id, false, dependencies);
  assert.deepEqual(engine, base);
  assert.notEqual(engine, base);
  assert.deepEqual(await getReadOnlyConfiguredEngineIncludingRuntimePrivate(base.id, false, dependencies), base);
});

test('effective private-capable projection remains behind both canary access and mode executability', async () => {
  const engineId = 'kling-3-turbo-standard';
  const canary: LaunchCanaryRequestContext = {
    principal: { userId: 'canary-user', clientId: null, emailVerified: true, authMethod: 'oauth' },
    access: { allowedModelIds: new Set([engineId]) },
    generationEnvironment: { bytePlusEnabled: false, bytePlusApiKey: undefined, falApiKey: 'test-key', providerEnv: {} },
  };
  const settings = new Map([[engineId, { ...stale, engine_id: engineId }]]);
  for (const [context, expectedLookups, expectedResolved] of [
    [null, 0, false],
    [{ ...canary, access: { allowedModelIds: new Set<string>() } }, 0, false],
    [{ ...canary, generationEnvironment: { ...canary.generationEnvironment, falApiKey: undefined } }, 1, false],
    [canary, 1, true],
  ] as const) {
    let privateLookups = 0;
    let resolved: EngineCaps | undefined;
    await resolveMediaAwarePreflight({
      request: { engine: engineId, mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24 },
      launchCanaryContext: context,
    }, {
      getConfiguredEngineFn: async () => undefined,
      getConfiguredEngineIncludingHiddenFn: async (id) => {
        privateLookups += 1;
        return getReadOnlyConfiguredEngineIncludingRuntimePrivate(id, false, {
          databaseConfigured: () => true,
          fetchSettings: async () => settings,
          fetchOverrides: async () => new Map(),
        });
      },
      computeConfiguredPreflightFn: async (_request, options) => {
        assert.equal(options?.bootstrap, false);
        resolved = options?.resolvedEngine;
        return { ok: false, messages: ['pricing boundary reached'] };
      },
    });
    assert.equal(privateLookups, expectedLookups);
    assert.equal(Boolean(resolved), expectedResolved);
    if (resolved) assert.equal(resolved.maxDurationSec, getBaseEngines().find((engine) => engine.id === engineId)?.maxDurationSec);
  }
});
