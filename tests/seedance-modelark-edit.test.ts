import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { assertBytePlusTransportConfigured, resolveBytePlusTransport, resolveBytePlusPollTransport } from '../frontend/src/server/video-providers/byteplus-modelark';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark-payload';
import { BytePlusModelArkError } from '../frontend/src/server/video-providers/byteplus-modelark-error';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { resolveAgentGenerationModeExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { createGenerateMetricLogger } from '../frontend/app/api/generate/_lib/metric-logger';
import type { GenerateMetricInput } from '../frontend/server/generate-metrics';

async function withEditConfig(action: (flags: Record<string, unknown>) => void | Promise<void>) {
  const flags = ENV as unknown as Record<string, unknown>;
  const keys = ['SEEDANCE_2_5_EDIT_TRANSPORT', 'SEEDANCE_2_5_MODELARK_EDIT_ENABLED',
    'BYTEPLUS_ARK_API_KEY', 'BYTEPLUS_LAS_API_KEY', 'SEEDANCE_2_5_LAS_ENABLED'];
  const before = new Map(keys.map(key => [key, flags[key]]));
  Object.assign(flags, { SEEDANCE_2_5_EDIT_TRANSPORT: 'modelark', SEEDANCE_2_5_MODELARK_EDIT_ENABLED: 'true',
    BYTEPLUS_ARK_API_KEY: 'fixture-modelark-key', BYTEPLUS_LAS_API_KEY: undefined, SEEDANCE_2_5_LAS_ENABLED: 'false' });
  try { await action(flags); }
  finally { for (const key of keys) { const value = before.get(key); if (value === undefined) delete flags[key]; else flags[key] = value; } }
}

test('qualified ModelArk Edit uses the existing credential without LAS and retains stored LAS polling', { concurrency: false }, async () => {
  await withEditConfig(() => {
    assert.equal(assertBytePlusTransportConfigured('seedance-2-5', 'v2v'), 'modelark');
    assert.equal(resolveBytePlusTransport('seedance-2-5', 'v2v'), 'modelark');
    for (const mode of ['t2v', 'i2v', 'ref2v', 'extend']) {
      assert.equal(resolveBytePlusTransport('seedance-2-5', mode), 'modelark');
    }
    assert.equal(resolveBytePlusPollTransport({ providerJobId: 'lsd-existing', settingsSnapshot: { byteplusTransport: 'las' } }), 'las');
    assert.equal(resolveBytePlusPollTransport({ providerJobId: 'cgt-existing', settingsSnapshot: { byteplusTransport: 'modelark' } }), 'modelark');
  });
});

test('choosing ModelArk alone cannot open Edit or borrow the LAS gate', { concurrency: false }, async () => {
  await withEditConfig(flags => {
    flags.SEEDANCE_2_5_MODELARK_EDIT_ENABLED = 'false';
    flags.SEEDANCE_2_5_LAS_ENABLED = 'true';
    flags.BYTEPLUS_LAS_API_KEY = 'fixture-las-key';
    assert.throws(() => assertBytePlusTransportConfigured('seedance-2-5', 'v2v'),
      (error: unknown) => error instanceof BytePlusModelArkError && error.code === 'BYTEPLUS_MODELARK_EDIT_EXECUTION_DISABLED');
    assert.equal(assertBytePlusTransportConfigured('seedance-2-5', 't2v'), 'modelark');
  });
});

test('an invalid explicit Edit transport refuses submission instead of silently choosing another service', { concurrency: false }, async () => {
  await withEditConfig(flags => {
    flags.SEEDANCE_2_5_EDIT_TRANSPORT = 'unrecognized-service';
    assert.throws(() => assertBytePlusTransportConfigured('seedance-2-5', 'v2v'),
      (error: unknown) => error instanceof BytePlusModelArkError && error.code === 'BYTEPLUS_EDIT_TRANSPORT_UNSUPPORTED');
    assert.equal(assertBytePlusTransportConfigured('seedance-2-5', 'i2v'), 'modelark');
  });
});

test('ModelArk Edit catalog availability honors its own gate without requiring a LAS credential', { concurrency: false }, async () => {
  await withEditConfig(flags => {
    const original = { enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED, provider: ENV.SEEDANCE_2_5_PROVIDER,
      adminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY, modes: ENV.SEEDANCE_2_5_BYTEPLUS_MODES };
    Object.assign(ENV, { SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
      SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend' });
    try {
      const engine = getBaseEnginesByCategory('video').find(engine => engine.id === 'seedance-2-5')!;
      const environment = { bytePlusEnabled: true, bytePlusApiKey: 'fixture-ark', bytePlusLasEnabled: false,
        bytePlusLasApiKey: undefined, bytePlusModelArkEditEnabled: false };
      flags.SEEDANCE_2_5_MODELARK_EDIT_ENABLED = 'false';
      assert.deepEqual(resolveAgentGenerationModeExecutability(engine, 'v2v', environment),
        { executable: false, reason: 'provider_disabled' });
      for (const mode of ['t2v', 'i2v', 'ref2v', 'extend'] as const) {
        assert.deepEqual(resolveAgentGenerationModeExecutability(engine, mode, environment), { executable: true, reason: 'available' });
      }
      flags.SEEDANCE_2_5_MODELARK_EDIT_ENABLED = 'true';
      assert.deepEqual(resolveAgentGenerationModeExecutability(engine, 'v2v', { ...environment, bytePlusModelArkEditEnabled: true }),
        { executable: true, reason: 'available' });
    } finally {
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.enabled; ENV.SEEDANCE_2_5_PROVIDER = original.provider;
      ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.adminOnly; ENV.SEEDANCE_2_5_BYTEPLUS_MODES = original.modes;
    }
  });
});

test('early ModelArk Edit and invalid transport refusals preserve safe runtime and metric evidence', { concurrency: false }, async t => {
  const traces: unknown[] = [];
  t.mock.method(console, 'warn', (...args: unknown[]) => { traces.push(args); });
  await withEditConfig(async flags => {
    for (const [error, selection, transport] of [
      ['BYTEPLUS_MODELARK_EDIT_EXECUTION_DISABLED', 'modelark', 'modelark'],
      ['BYTEPLUS_EDIT_TRANSPORT_UNSUPPORTED', 'private-invalid-selection', null],
    ] as const) {
      flags.SEEDANCE_2_5_EDIT_TRANSPORT = selection;
      const records: GenerateMetricInput[] = [];
      const logger = createGenerateMetricLogger({ requestStartedAt: 1, now: () => 2,
        recordMetric: input => { records.push(input); } });
      await logger.logPreflightRejection({ engineId: 'seedance-2-5', mode: 'v2v',
        prompt: 'private', jobId: 'private-job', apiKey: 'private-key' },
      { ok: false, status: 503, body: { error } });
      assert.equal(records.length, 1);
      assert.equal(records[0].errorCode, error);
      assert.equal(records[0].meta?.transport, transport);
      assert.equal(records[0].jobId, null);
      assert.equal(records[0].userId, null);
      assert.doesNotMatch(JSON.stringify(records), /private/);
    }
    assert.equal(traces.length, 2);
    assert.doesNotMatch(JSON.stringify(traces), /private/);
  });
});

test('ModelArk Edit sends explicit editing intent and inherits source framing and duration', () => {
  const input = { modelId: 'dreamina-seedance-2-5-260628', mode: 'v2v' as const,
    transport: 'modelark' as const, prompt: 'Change the red square to yellow in Video 1.',
    durationSec: 4, allowedDurationOptions: [4, 5, 30], resolution: '480p', ratio: '16:9', generateAudio: false,
    referenceVideoUrls: ['https://media.example.test/owned-original.mp4'] };
  const payload = buildBytePlusSeedancePayload(input);
  assert.equal(payload.omni_reference_task_type, 'edit');
  assert.equal(payload.ratio, 'adaptive');
  assert.equal(payload.duration, -1);
  assert.equal(payload.resolution, '480p');
  assert.deepEqual(payload.content.filter(item => item.type === 'video_url'), [
    { type: 'video_url', video_url: { url: 'https://media.example.test/owned-original.mp4' }, role: 'reference_video' },
  ]);
  assert.match(payload.content[0].type === 'text' ? payload.content[0].text : '', /(?:edit|change)/i);
  assert.equal(payload.generate_audio, false);
});

test('the ModelArk Edit payload adaptation does not change older video editing models', () => {
  const input = { modelId: 'dreamina-seedance-2-0-260128', mode: 'v2v' as const,
    transport: 'modelark' as const, prompt: 'Change the light.', durationSec: 5,
    resolution: '480p', ratio: '9:16', referenceVideoUrls: ['https://media.example.test/source.mp4'] };
  const payload = buildBytePlusSeedancePayload(input);
  assert.equal(payload.duration, 5);
  assert.equal(payload.ratio, '9:16');
  assert.equal(payload.omni_reference_task_type, undefined);
});
