import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { requireBytePlusSeedanceProfile } from '../frontend/src/server/video-providers/byteplus-modelark-profiles';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark-payload';
import { buildSeedance25FinalRequest } from '../frontend/src/server/video-providers/byteplus-modelark-draft';
import { estimateBytePlusBillableTokens } from '../frontend/server/byteplus-accounting';
import { getBytePlusVideoListRate } from '../frontend/server/byteplus-list-tariff';
import { prepareSeedance25CommercialTariffs } from '../frontend/server/pricing/seedance25-commercial-tariffs';
import { prepareSeedanceAdminBatches } from '../frontend/server/pricing-admin/tariff-batches/seedance';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { resolveSeedanceWorkflowRequest } from '../frontend/server/seedance-workflow-request';
import { resolveAgentSeedanceWorkflow } from '../frontend/src/server/agent-api/seedance-workflow';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import minimums from './fixtures/seedance-25-4k-minimums-2026-11-17.json';

const at = '2026-11-17T12:00:00Z';
const deps = {
  getOwnedReadyFn: async () => ({ draftJobId: 'draft-owned', providerTaskId: 'private-task', providerModelId: 'owned-model', expiresAt: '2026-12-01T00:00:00Z' }),
  readParentFn: async () => ({ prompt: 'Original shot', durationSec: 5, aspectRatio: '16:9', audio: false,
    settings: { inputMode: 't2v', core: { resolution: '480p', iterationCount: 1 }, seedanceWorkflow: { step: 'draft' } } }),
};

test('Seedance 2.5 exposes 4K and sends it unchanged to ModelArk; Flash remains 720p', () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const profile = requireBytePlusSeedanceProfile(engine.id);
  assert.ok(engine.resolutions.includes('4k'));
  assert.ok(profile.resolutions.includes('4k'));
  const payload = buildBytePlusSeedancePayload({ modelId: 'dreamina-seedance-2-5-260628', prompt: 'A landscape',
    durationSec: 5, mode: 't2v', resolution: '4k', aspectRatio: '16:9', allowedResolutions: profile.resolutions });
  assert.equal(payload.resolution, '4k');
  assert.equal(getFalEngineById('seedance-2-5-flash')!.engine.resolutions.includes('4k'), false);
});

test('4K supplier estimates use published rasters and both input rates', () => {
  const samples = [ ['16:9', 3840, 2160, 972000], ['9:16', 2160, 3840, 972000],
    ['1:1', 2880, 2880, 972000], ['4:3', 3326, 2494, 972075.46875],
    ['3:4', 2494, 3326, 972075.46875], ['21:9', 4398, 1886, 972026.71875] ] as const;
  for (const [aspectRatio, width, height, tokenCount] of samples) {
    const estimate = estimateBytePlusBillableTokens({ engineId: 'seedance-2-5', resolution: '4k', durationSec: 5, aspectRatio, billingInputType: 'no_video_input' });
    assert.ok(estimate);
    assert.equal(estimate.width, width); assert.equal(estimate.height, height); assert.equal(estimate.tokenCount, tokenCount);
  }
  assert.equal(getBytePlusVideoListRate({ profile: 'seedance25', resolution: '4k', billingInputType: 'no_video_input' }).unitPriceUsdPer1kTokens, 0.0047);
  assert.equal(getBytePlusVideoListRate({ profile: 'seedance25', resolution: '4k', billingInputType: 'video_input' }).unitPriceUsdPer1kTokens, 0.0029);
});

test('4K direct and Final use separate canonical ×2 tariffs and missing Final never falls back', async () => {
  const plan = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5', at, standardEditTransport: 'modelark' });
  const rows = plan.scenarios.filter(row => row.context.resolution === '4k' && row.context.mode === 't2v'
    && row.context.aspectRatio === '16:9' && row.context.durationSec === 5);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const quote = await computeCanonicalBillingSnapshot(row.context, {
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
      loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1, databaseCells: [row.cell], versionedCells: [] }),
    });
    assert.equal(quote.totalCents, 914);
    assert.equal(quote.base.amountCents, 456.84);
  }
  const direct = rows.find(row => !row.context.workflowStep)!;
  const final = rows.find(row => row.context.workflowStep === 'final')!;
  await assert.rejects(computeCanonicalBillingSnapshot(direct.context, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 1, databaseCells: [], versionedCells: [] }),
  }), /tariff/i, 'new 4K requests cannot fall back to legacy percentage pricing');
  await assert.rejects(computeCanonicalBillingSnapshot(final.context, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1, databaseCells: [direct.cell], versionedCells: [] }),
  }), /tariff/i);
  const batches = prepareSeedanceAdminBatches('seedance-2-5');
  const fourK = batches.filter(batch => batch.intent !== 'rollback' && batch.selections.some(s => s.selector.resolution === '4k'));
  assert.ok(fourK.length);
  assert.ok(fourK.every(batch => batch.intent === 'create_missing' && batch.selections.every(s => s.selector.resolution === '4k')));
});

test('4K video-input estimates match every published minimum over all supported durations and aspects', () => {
  assert.equal(minimums.groups.reduce((count, group) => count + group.minimumTokens.length, 0), 108);
  for (const group of minimums.groups) for (const aspectRatio of group.aspects) {
    assert.equal(group.minimumTokens.length, 27);
    group.minimumTokens.forEach((tokens, index) => {
      const estimate = estimateBytePlusBillableTokens({ engineId: 'seedance-2-5', resolution: '4k', durationSec: index + 4,
        aspectRatio, billingInputType: 'video_input', inputVideoDurationSec: 2 });
      assert.equal(estimate?.minimumTokens, tokens, `${aspectRatio}/${index + 4}s`);
      assert.equal(estimate?.tokenCount, tokens);
    });
  }
});

test('web and agent Final retain selected 4K while inheriting owned creative facts', async () => {
  const body = { mode: 't2v', resolution: '4k', prompt: 'tampered', durationSec: 30, seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned' } };
  const final = await resolveSeedanceWorkflowRequest({ body, engineId: 'seedance-2-5', userId: 'owner', enabled: true }, deps);
  assert.equal(final?.body.resolution, '4k');
  assert.equal(final?.body.prompt, 'Original shot'); assert.equal(final?.body.durationSec, 5);
  const request = normalizeGenerationRequest({ surface: 'video', engineId: 'seedance-2-5', mode: 't2v',
    seedanceWorkflow: body.seedanceWorkflow, settings: { resolution: '4k' } });
  const agent = await resolveAgentSeedanceWorkflow(request, 'owner', { ...deps, enabled: true });
  assert.equal(agent.request.settings.resolution, '4k');
  assert.deepEqual(buildSeedance25FinalRequest({ modelId: 'owned-model', draftProviderTaskId: 'private-task', resolution: '4k' }), {
    model: 'owned-model', content: [{ type: 'draft_task', draft_task: { id: 'private-task' } }], resolution: '4k', watermark: false,
  });
  for (const resolution of ['480p', '720p', '8k', null]) await assert.rejects(resolveSeedanceWorkflowRequest({
    body: { ...body, resolution }, engineId: 'seedance-2-5', userId: 'owner', enabled: true }, deps), /resolution|workflow/i);
});
