import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { projectSeedance25ModeAvailability } from '../frontend/server/engine-mode-availability';
import { resolveWorkspaceWorkflow, resolveWorkspaceComposerFacts } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { mapLegacyJobRowToOutputs } from '../frontend/server/media-library-records';
import { bytePlusCompletedOutputRow } from '../frontend/server/byteplus-output-persistence';
import { quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import type { PreflightRequest } from '../frontend/types/engines';

async function withModelArk(work: () => Promise<void>) {
  const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'fixture-existing-ark',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false',
    SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend', SEEDANCE_2_5_EDIT_TRANSPORT: 'modelark',
    SEEDANCE_2_5_MODELARK_EDIT_ENABLED: 'true', SEEDANCE_2_5_LAS_ENABLED: 'false', BYTEPLUS_LAS_API_KEY: '' };
  const env = ENV as unknown as Record<string, unknown>;
  const before = Object.fromEntries(Object.keys(flags).map(key => [key, env[key]]));
  Object.assign(env, flags);
  try { await work(); } finally { Object.assign(env, before); }
}
const engine = () => getFalEngineById('seedance-2-5')!.engine;
async function preflight(durationSec: number | null, width: number | null = 1280, height: number | null = 720) {
  let calculated: PreflightRequest | undefined;
  let options: unknown;
  const result = await resolveMediaAwarePreflight({ userId: 'owner', request: {
    engine: 'seedance-2-5', mode: 'v2v', durationSec: 9, resolution: '480p', aspectRatio: '9:16', fps: 24,
    inputs: [{ kind: 'video', assetId: 'owned', slotId: 'video_url', url: 'https://media.example.test/exact-original.mp4' }],
  } }, {
    getConfiguredEngineFn: async () => engine(),
    processAttachmentsFn: async () => ({ ok: true, attachments: [], trustedDurationSecByField: { video_url: durationSec === null ? [] : [durationSec] },
      trustedMediaReferences: [{ kind: 'video', url: 'https://media.example.test/exact-original.mp4', width, height, durationSec }],
      references: { normalizedReferenceImages: [], videoUrls: ['https://media.example.test/exact-original.mp4'] } }) as never,
    computeConfiguredPreflightFn: async (request, facts) => { calculated = request; options = facts; return { ok: true, messages: [] }; },
  });
  return { result, calculated, options };
}

test('trusted ModelArk Edit source replaces independent duration and framing with a disclosed literal tariff class',
  { concurrency: false }, async () => withModelArk(async () => {
    const { result, calculated, options } = await preflight(4.25);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(calculated?.durationSec, 5);
    assert.equal(calculated?.aspectRatio, '16:9');
    assert.deepEqual((options as { trustedMediaPricingFacts: Record<string, unknown> }).trustedMediaPricingFacts.seedanceEditSource,
      { durationSec: 4.25, width: 1280, height: 720, billedDurationSec: 5, pricingAspectRatio: '16:9', outputDuration: 'source', outputAspectRatio: 'source' });
    for (const duration of [4, 4.000001, 29.999999, 30]) {
      const response = await preflight(duration);
      assert.equal(response.result.ok, true);
      assert.equal(response.calculated?.durationSec, Math.ceil(duration));
    }
  }));

test('public ModelArk Edit examples quote inherited source timing instead of an independent output request',
  { concurrency: false }, async () => withModelArk(async () => {
    let duration: number | undefined;
    const quote = await quotePublicModelScenario({ modelId: 'seedance-2-5', mode: 'v2v', durationSec: 9,
      resolution: '480p', aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 4.25 }, async scenario => {
      duration = scenario.context.durationSec;
      return { totalCents: 84, currency: 'USD' } as never;
    });
    assert.equal(duration, 5);
    assert.equal(quote.status, 'exact');
    if (quote.status === 'exact') assert.match(quote.scenarioLabel, /4\.25s source.*5s price bracket/);
  }));

test('Edit library output timing keeps the exact inherited duration separately from its integer tariff class', () => {
  const job = { engine_id: 'seedance-2-5', duration_sec: 5, settings_snapshot: { inputMode: 'v2v', byteplusTransport: 'modelark',
    seedanceEditSource: { durationSec: 4.25 } } } as never;
  const row = bytePlusCompletedOutputRow(job, 'https://media.example.test/output.mp4', 'https://media.example.test/poster.jpg');
  assert.equal(row.duration_sec, 4.25);
  assert.equal(mapLegacyJobRowToOutputs(row)[0].durationSec, 4.25, 'The actual Library projection must preserve fractional timing');
});

test('unverified or unsupported inherited source facts fail before a quote can be computed',
  { concurrency: false }, async () => withModelArk(async () => {
    for (const duration of [null, 3.999999, 30.000001]) {
      const response = await preflight(duration);
      assert.equal(response.result.ok, false, String(duration));
      assert.equal(response.calculated, undefined);
    }
    const missingDimensions = await preflight(4, null, null);
    assert.equal(missingDimensions.result.ok, false);
    assert.equal(missingDimensions.calculated, undefined);
  }));

test('workspace projection follows replacement and removal of the inherited source without independent output controls',
  { concurrency: false }, async () => withModelArk(async () => {
    const projected = projectSeedance25ModeAvailability(engine());
    assert.equal((projected.modeAvailability?.v2v as unknown as { inheritsSourceVideo?: boolean }).inheritsSourceVideo, true);
    const form = { engineId: projected.id, mode: 'v2v' as const, durationSec: 9, resolution: '480p', aspectRatio: '9:16',
      fps: 24, iterations: 1, audio: false, extraInputValues: {} };
    const source = { id: 'source', fieldId: 'video_url', kind: 'video' as const, name: 'source.mp4', type: 'video/mp4',
      size: 1000, status: 'ready' as const, previewUrl: 'https://media.example.test/preview.jpg',
      url: 'https://media.example.test/exact-original.mp4', width: 1280, height: 720, durationSec: 4.25 };
    for (const durationSec of [4.25, 7.125]) {
      const workflow = resolveWorkspaceWorkflow({ engine: projected, form, inputAssets: { video_url: [{ ...source, durationSec }] }, klingElements: [] });
      const facts = resolveWorkspaceComposerFacts({ engine: projected, form, workflow, prompt: 'Edit the light.',
        multiPromptEnabled: false, multiPromptScenes: [], voiceIdsInput: '' });
      assert.equal(facts.effectiveDurationSec, Math.ceil(durationSec));
    }
    const empty = resolveWorkspaceWorkflow({ engine: projected, form, inputAssets: {}, klingElements: [] });
    assert.equal(empty.primaryVideoDurationSec, null);
  }));
