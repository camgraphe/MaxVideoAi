import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeVideoOperation, resolveVideoOperationEngine, type VideoOperation } from '../frontend/lib/video-operation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { createAgentModelCatalogDeps, listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import { resolveAgentGenerationRequestExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { createPrepareGenerationForActorService } from '../frontend/src/server/agent-api/prepare-generation';
import { resolveGenerationReferencesForActor } from '../frontend/src/server/agent-api/resolve-generation-references';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { priceCanonicalGenerationWithBilling } from '../frontend/src/server/agent-api/generation-pricing';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { compileCurrentContinuousTariffPrice } from '../frontend/server/pricing/compile-current-continuous-tariff';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { videoOperationTariffContexts } from '../frontend/lib/pricing-audit/video-operation-tariff-inventory';
import { inspectOwnedFluxLtxSource } from '../frontend/server/video-excerpts/flux-ltx-source';
import { withVideoExcerptSlot } from '../frontend/server/video-excerpts/media';
import { qualifyFluxDraftPair } from '../frontend/server/flux-draft-cache';
import type { VideoExcerptFacts } from '../frontend/server/video-excerpts/media';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import type { StoredMediaMetadataRow } from '../frontend/app/api/generate/_lib/generation-media-constraints';

const owner = 'source-seam-owner', assetId = 'ma_' + '1'.repeat(32), imageId = 'ma_' + '2'.repeat(32);
const url = 'https://media.maxvideoai.com/user-assets/source.mp4';
const actor = { userId: owner, projectId: 'project', authMethod: 'studio-session' as const, clientId: null };
const environment = { falApiKey: 'test-no-network', bytePlusEnabled: false, bytePlusApiKey: undefined, providerEnv: {} };
const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: .3, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD' }] };
const cases = [
  ['kling-o3-standard', 'v2v', 'kling-edit', '720p'],
  ['kling-o3-pro', 'v2v', 'kling-edit', '1080p'],
  ['kling-o3-4k', 'v2v', 'kling-edit', '4k'],
  ['flux-3', 'v2v', 'flux-fast-edit', '720p'],
  ['ltx-2-3', 'reframe', 'ltx23-reframe', '720p'],
  ['ltx-2-3', 'reframe', undefined, '720p'],
] as const;
type Case = typeof cases[number];
function measured(durationSec: number): VideoExcerptFacts {
  return { kind: 'video', width: 1280, height: 720, durationSec, fps: 24, hasAudio: true,
    sizeBytes: 1000, mimeType: 'video/mp4', containerFormat: 'mov,mp4', containerMajorBrand: 'isom',
    videoCodec: 'h264', audioCodec: 'aac' };
}
function fixture(c: Case, seconds = 5.558333, stored: number | null = c[2] === 'kling-edit' ? seconds : 6) {
  const [engineId, mode, operation, resolution] = c;
  const base = getFalEngineById(engineId)!.engine;
  const engine = resolveVideoOperationEngine(base, mode, operation);
  const row: StoredMediaMetadataRow = { asset_id: assetId, url, origin_url: null, original_name: 'source.mp4',
    mime_type: 'video/mp4', size_bytes: 1000, duration_sec: stored, width: 1280, height: 720 };
  const input = { assetId, kind: 'video' as const, slotId: 'video_url', url };
  const attachment = { ...input, name: 'source.mp4', type: 'video/mp4', size: 1000, durationSec: 6 };
  const inspect: typeof inspectOwnedFluxLtxSource = (sourceUrl, selectedOperation, userId) =>
    inspectOwnedFluxLtxSource(sourceUrl, selectedOperation, userId, {
      createReadUrl: async params => { assert.equal(params.userId, owner); assert.equal(params.url, url); return 'read-only'; },
      download: async () => ({ bytes: Buffer.from('unchanged original'), mimeType: 'video/mp4' }),
      inspect: async () => measured(seconds),
    });
  const mediaDeps = { queryFn: async <T>(sql: string, params?: readonly unknown[]) => {
    assert.match(sql, /WHERE user_id = \$1/); return (params?.[0] === owner ? [row] : []) as T[];
  }, inspectFluxLtxSourceFn: inspect };
  const request = normalizeGenerationRequest({ surface: 'video', engineId, mode, operation,
    prompt: operation === 'kling-edit' || operation === 'flux-fast-edit' ? 'Make it winter' : '',
    settings: { resolution, ...(mode === 'reframe' ? { aspectRatio: '16:9' } : {}) },
    references: [{ kind: 'asset', assetId, role: 'source' }] });
  const resolved = { assetId, role: 'source' as const, mediaKind: 'video' as const, storageUrl: url,
    ...measured(seconds), originalName: 'source.mp4' };
  const validate = (overrides = {}) => validateNormalizedGenerationAttachments({ engineId, mode,
    inputSchema: engine.inputSchema, userId: owner, attachments: [attachment], mediaConstraintDeps: mediaDeps, ...overrides });
  return { base, engine, row, input, attachment, mediaDeps, request, resolved, validate };
}
async function billing(c: readonly [string, string, VideoOperation | undefined, string]) {
  const context = videoOperationTariffContexts().find(ctx => ctx.engine.id === c[0]
    && ctx.operation === normalizeVideoOperation(c[0], c[1], c[2]) && ctx.resolution === c[3])!;
  assert.ok(context);
  const scenario = buildManualTariffCoverageScenario(context, 'seam-test');
  const price = await compileCurrentContinuousTariffPrice(scenario, policy);
  const cell = { id: 'scoped-test-cell', selector: continuousInputTariffSelector(scenario.selector)!, price,
    currency: 'USD', source: 'database' as const, version: 1, effectiveFrom: '2026-01-01T00:00:00Z' };
  const quantities: number[] = [];
  return { quantities, price, compute: (ctx: PricingContext) => {
    quantities.push(ctx.durationSec);
    return computeCanonicalBillingSnapshot(ctx, { pricingPolicy: { loadOverrides: async () => policy },
      loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1, databaseCells: [cell], versionedCells: [] }) });
  } };
}
for (const c of cases) for (const trusted of [false, true]) test(`${c[0]}/${c[2] ?? 'inferred'}: actual attachments → Site quote → execution and canonical billing (${trusted ? 'canonical references' : 'owned row'})`, async () => {
  const f = fixture(c), b = await billing(c);
  const validated = await f.validate(trusted ? { trustedResolvedReferences: [f.resolved] } : {});
  assert.equal(validated.ok, true); if (!validated.ok) return;
  assert.equal(validated.trustedMediaReferences?.[0]?.durationSec, 5.558333);
  assert.equal(validated.trustedDurationSecByField.video_url[0], 5.558333);
  assert.equal(validated.attachments[0].durationSec, 5.558333);
  const execution = resolveGenerateSourceVideoContext({ engineId: c[0], mode: c[1], operation: f.request.operation,
    engineLabel: f.engine.label, attachments: validated.attachments, sourceInputVideoUrl: url, videoUrls: [url],
    fallbackDurationSec: 6, trustedSourceVideo: validated.trustedMediaReferences?.[0] });
  assert.equal(execution.ok, true); if (!execution.ok) return;
  assert.equal(execution.durationSec, 5.558333);
  const site = await resolveMediaAwarePreflight({ userId: owner, request: { engine: c[0], mode: c[1], operation: c[2],
    durationSec: 6, resolution: c[3], ...(c[1] === 'reframe' ? { aspectRatio: '16:9' } : {}), inputs: [f.input] } }, {
    getConfiguredEngineFn: async () => f.base, mediaConstraintDeps: f.mediaDeps,
    computeConfiguredPreflightFn: (req, options) => computeConfiguredPreflight(req, { ...options, computePublicSnapshot: b.compute }),
  });
  assert.equal(site.ok, true, JSON.stringify(site));
  const canonical = await priceCanonicalGenerationWithBilling(f.request, 'member', { resolvedEngine: f.engine, resolvedReferences: [f.resolved] }, b.compute);
  assert.deepEqual(b.quantities, [5.558333, 5.558333]);
  assert.equal(site.total, canonical.priceCents);
  const mismatch = resolveGenerateSourceVideoContext({ engineId: c[0], mode: c[1], operation: f.request.operation,
    engineLabel: f.engine.label, attachments: validated.attachments, sourceInputVideoUrl: url + '?other', videoUrls: [url],
    fallbackDurationSec: 6, trustedSourceVideo: validated.trustedMediaReferences?.[0] });
  assert.equal(mismatch.ok, false);
});
for (const c of cases) for (const corruption of ['owner', 'asset', 'url']) test(`${c[0]} ${String(c[2])}: ${corruption} mismatch cannot quote`, async () => {
  const f = fixture(c); let quotes = 0;
  const input = { ...f.input, ...(corruption === 'asset' ? { assetId: imageId } : {}), ...(corruption === 'url' ? { url: url + '?other' } : {}) };
  const result = await resolveMediaAwarePreflight({ userId: corruption === 'owner' ? 'other' : owner,
    request: { engine: c[0], mode: c[1], operation: c[2], durationSec: 6, resolution: c[3], inputs: [input] } }, {
    getConfiguredEngineFn: async () => f.base, mediaConstraintDeps: f.mediaDeps,
    computeConfiguredPreflightFn: async () => { quotes++; throw new Error('Invalid sources cannot reach quotation'); },
  });
  assert.equal(result.ok, false); assert.equal(quotes, 0);
});

for (const [engineId, operation, resolution] of [
  ['flux-3', 'flux-fast-edit', '720p'], ['flux-3-draft', 'flux-draft-enhance', '1080p'],
  ['minimax-h3-max', 'h3-recast', '768P'], ['minimax-h3-max', 'h3-relight', '768P'],
] as const) test(`real executable catalogue and prepare admission: ${operation}`, async () => {
  const base = getFalEngineById(engineId)!.engine;
  const catalog = (falApiKey: string) => listPublicAgentGenerationEngines({
    ...createAgentModelCatalogDeps({ ...environment, falApiKey }), listEngines: async () => [base],
  });
  const entries = await catalog('test-no-network');
  assert.ok(entries[0]?.publicModes.includes('v2v'));
  assert.equal((await catalog('')).some(entry => entry.publicModes.includes('v2v')), false);
  const enhance = operation === 'flux-draft-enhance', h3 = engineId === 'minimax-h3-max';
  const seconds = operation === 'h3-relight' ? 124 / 24 : 5.558333;
  const draft = qualifyFluxDraftPair({ ownerId: owner, jobId: 'native-draft', outputId: 'output', providerRequestId: 'provider',
    attemptId: 1, provenance: { kind: 'provider_attempt' }, endpoint: 'blackforestlabs/flux-3/text-to-video/draft',
    outputUrl: url, outputSha256: 'a'.repeat(64) }, { providerRequestId: 'provider', providerVideoUrl: 'https://fal.media/paired.mp4',
    cacheUrl: 'https://fal.media/cache', videoIdentity: 'video', ownedVideoIdentity: 'video', audioIdentity: null,
    ownedAudioIdentity: null, ownedSha256: 'a'.repeat(64), durationSec: seconds, fps: 24, decodedFrameCount: 124 });
  const input = { surface: 'video' as const, engineId, mode: 'v2v' as const, operation,
    prompt: operation === 'flux-fast-edit' ? 'Winter' : '', settings: { resolution, ...(operation === 'h3-relight' ? { aspectRatio: 'auto' } : {}) },
    ...(enhance ? { sourceJobId: 'native-draft' } : {}), references: enhance ? [] : [
      { kind: 'asset' as const, assetId, role: 'source' as const },
      ...(h3 ? [{ kind: 'asset' as const, assetId: imageId, role: 'reference' as const }] : []),
    ] };
  const b = await billing([engineId, 'v2v', operation, resolution]);
  let inserted = 0, prepared = 0, priced = 0;
  const service = (falApiKey: string) => createPrepareGenerationForActorService('https://maxvideoai.com/account', { clientIp: null, userAgent: null }, {
    paidGenerationEnabled: () => true, getAccountRestriction: async () => null,
    listPublicEngines: () => catalog(falApiKey),
    resolveRequestExecutability: (request, candidate, refs) => resolveAgentGenerationRequestExecutability(request, candidate.engine, refs, { ...environment, falApiKey }),
    prepareFluxDraftSource: async () => { prepared++; return draft; }, resolveFluxLineage: async () => enhance ? draft : undefined,
    resolveGenerationReferences: (request, principal) => resolveGenerationReferencesForActor(request, principal, {
      resolveOwnedReferenceAsset: async (current, id) => { assert.equal(current.userId, owner); return {
        assetId: id, mediaKind: id === assetId ? 'video' : 'image', storageUrl: id === assetId ? url : 'https://media.maxvideoai.com/light.jpg',
        mimeType: id === assetId ? 'video/mp4' : 'image/jpeg', width: 1280, height: 720, durationSec: id === assetId ? seconds : null, sizeBytes: 1000, originalName: null,
      }; },
      inspectFluxLtxSource: async () => ({ ...measured(seconds), sourceSha256: 'a'.repeat(64) }),
      inspectH3Source: async () => ({ ...measured(seconds), decodedFrameCount: 124, constantFrameRate: true, sourceSha256: 'a'.repeat(64) }),
    }),
    resolveMembershipPricing: async () => ({ tier: 'member', source: 'app_receipts_rolling_30d', spent30Cents: 0, thresholdCents: 0, discountPercent: 0 }),
    priceGeneration: async (request, tier, context) => {
      priced++; assert.ok(context.resolvedEngine);
      return priceCanonicalGenerationWithBilling(request, tier, { ...context, resolvedEngine: context.resolvedEngine }, b.compute);
    },
    getWalletSummary: async () => ({ balanceCents: 1000, currency: 'USD' }) as never,
    withTransaction: async callback => callback({} as never), checkSpendingLimits: async () => ({ allowed: true }) as never,
    insertPreparedQuote: async data => { inserted++; return { ...data, quoteId: 'prepared', authOrigin: 'studio-session', studioProjectId: actor.projectId, expiresAt: new Date('2026-12-01'), pricingSnapshot: data.pricingSnapshot } as never; },
  });
  const result = await service('test-no-network')(input, actor);
  assert.deepEqual(b.quantities, [seconds]);
  assert.equal(result.summary.operation, operation); assert.equal(inserted, 1); assert.equal(priced, 1); assert.equal(prepared, enhance ? 1 : 0);
  await assert.rejects(service('')(input, actor));
  await assert.rejects(service('test-no-network')({ ...input, operation: undefined }, actor), { code: 'PARAMETER_INVALID' });
  assert.equal(inserted, 1); assert.equal(priced, 1);
});

for (const c of cases.filter(c => c[0] === 'flux-3' || c[0] === 'ltx-2-3')) {
  test(`${c[0]}/${String(c[2])}: missing stored timing and fractional customer-cent boundary retain measured quantity`, async () => {
    const b = await billing(c);
    assert.equal(b.price.kind, 'unit_bands'); if (b.price.kind !== 'unit_bands') return;
    const boundary = b.price.bands.find(band => band.minUnits > 5 && band.minUnits < 6)!.minUnits;
    const totals: number[] = [];
    for (const seconds of [5.558333, boundary - 1e-8, boundary]) {
      const f = fixture(c, seconds, null);
      const validated = await f.validate(); assert.equal(validated.ok, true); if (!validated.ok) return;
      assert.equal(validated.trustedDurationSecByField.video_url[0], seconds);
      assert.equal(validated.trustedMediaReferences?.[0].durationSec, seconds);
      const site = await resolveMediaAwarePreflight({ userId: owner, request: { engine: c[0], mode: c[1], operation: c[2],
        durationSec: 6, resolution: c[3], ...(c[1] === 'reframe' ? { aspectRatio: '16:9' } : {}), inputs: [f.input] } }, {
        getConfiguredEngineFn: async () => f.base, mediaConstraintDeps: f.mediaDeps,
        computeConfiguredPreflightFn: (req, options) => computeConfiguredPreflight(req, { ...options, computePublicSnapshot: b.compute }),
      });
      const canonical = await priceCanonicalGenerationWithBilling(f.request, 'member', { resolvedEngine: f.engine, resolvedReferences: [f.resolved] }, b.compute);
      assert.equal(site.ok, true, JSON.stringify(site)); assert.equal(site.total, canonical.priceCents);
      assert.deepEqual(b.quantities.splice(0), [seconds, seconds]); totals.push(canonical.priceCents);
    }
    assert.equal(totals[2], totals[1] + 1, 'this case crosses an actual customer-cent boundary');
  });
  for (const seconds of [0, -1, NaN, c[0] === 'flux-3' ? 15 : 60.001]) test(`${c[0]}/${String(c[2])}: invalid probed ${seconds} never quotes`, async () => {
    const f = fixture(c, seconds); let quotes = 0;
    const validated = await f.validate(); assert.equal(validated.ok, false);
    const site = await resolveMediaAwarePreflight({ userId: owner, request: { engine: c[0], mode: c[1], operation: c[2], durationSec: 6, resolution: c[3], inputs: [f.input] } }, {
      getConfiguredEngineFn: async () => f.base, mediaConstraintDeps: f.mediaDeps,
      computeConfiguredPreflightFn: async () => { quotes++; throw new Error('Invalid source quoted'); },
    });
    assert.equal(site.ok, false); assert.equal(quotes, 0);
  });
  test(`${c[0]}/${String(c[2])}: busy byte-source qualification never quotes`, async () => {
    const f = fixture(c); let quotes = 0;
    await withVideoExcerptSlot(owner, async () => {
      const validated = await f.validate(); assert.equal(validated.ok, false);
      if (!validated.ok) assert.equal(validated.status, 429);
      const site = await resolveMediaAwarePreflight({ userId: owner, request: { engine: c[0], mode: c[1], operation: c[2], durationSec: 6, resolution: c[3], inputs: [f.input] } }, {
        getConfiguredEngineFn: async () => f.base, mediaConstraintDeps: f.mediaDeps,
        computeConfiguredPreflightFn: async () => { quotes++; throw new Error('Busy source quoted'); },
      });
      assert.equal(site.error?.code, 'RATE_LIMITED'); assert.equal(quotes, 0);
    });
  });
}
test('FAST accepts the measured value just below 15 even when stored timing rounds to 15', async () => {
  const f = fixture(cases[3], 14.999999, 15);
  const result = await f.validate(); assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.trustedMediaReferences?.[0].durationSec, 14.999999);
});

test('operation discovery cannot lend Edit credentials to a historical Reference submission', () => {
  const engine = getFalEngineById('kling-o3-pro')!.engine;
  const env = { ...environment, providerEnv: { KLING_DIRECT_ENABLED: 'true', KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true', KLING_DIRECT_ADMIN_ONLY: 'false' } };
  for (const operation of [undefined, 'kling-reference'] as const) {
    const request = normalizeGenerationRequest({ surface: 'video', engineId: engine.id, mode: 'v2v', operation, prompt: 'Reference',
      settings: { resolution: '1080p', durationSec: 5, aspectRatio: '16:9' }, references: [] });
    assert.deepEqual(resolveAgentGenerationRequestExecutability(request, engine, [], env), { executable: false, reason: 'provider_credentials_missing' });
  }
});

test('unaffected creation duration keeps historical integer rounding', async () => {
  const engine = getFalEngineById('kling-o3-pro')!.engine;
  let seconds: number | undefined;
  const result = await computeConfiguredPreflight({ engine: engine.id, mode: 't2v', durationSec: 5.558333, resolution: '1080p' }, {
    resolvedEngine: engine, bootstrap: false, computePublicSnapshot: context => {
      seconds = context.durationSec;
      assert.equal(context.operation, undefined);
      return computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => policy },
        loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 1, databaseCells: [], versionedCells: [] }) });
    },
  });
  assert.equal(result.ok, true); assert.equal(seconds, 6);
});

for (const c of cases) test(`${c[0]}/${String(c[2])}: canonical trusted facts cannot substitute a different asset or URL`, async () => {
  const f = fixture(c);
  for (const wrong of [{ ...f.resolved, assetId: imageId }, { ...f.resolved, storageUrl: url + '?other' }]) {
    const result = await f.validate({ trustedResolvedReferences: [wrong] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.body.error, 'MEDIA_METADATA_UNVERIFIED');
  }
});
