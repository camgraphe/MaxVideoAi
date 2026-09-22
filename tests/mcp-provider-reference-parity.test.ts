import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentModelCatalogDeps, AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { priceCanonicalGeneration, priceCanonicalGenerationInExecutor } from '../frontend/src/server/agent-api/generation-pricing';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';

function candidate(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((entry) => entry.id === engineId);
  assert.ok(entry);
  return {
    engine: entry.engine,
    surface: 'video',
    publicModes: entry.modes.map(({ mode }) => mode) as AgentPublicGenerationEngine['publicModes'],
    modeCaps: Object.fromEntries(entry.modes.map(({ mode, ui }) => [mode, ui])),
  };
}

function request(engineId: string, mode: CanonicalGenerationRequest['mode'], overrides: Partial<CanonicalGenerationRequest> = {}) {
  return normalizeGenerationRequest({
    schemaVersion: 1, surface: 'video', engineId, mode,
    prompt: 'Create a cinematic scene from the supplied reference.',
    settings: {
      durationSec: 5,
      resolution: engineId === 'minimax-h3-max' ? '768P' : engineId === 'minimax-h3' ? '2K' : '720p',
      ...(engineId.startsWith('minimax-h3') && mode === 'i2v' ? {} : { aspectRatio: '16:9' }),
    },
    references: [], outputCount: 1, ...overrides,
  });
}

function resolved(assetId: string, kind: ResolvedReference['mediaKind'], role: ResolvedReference['role'] = 'reference'): ResolvedReference {
  const suffix = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav';
  return {
    assetId, role, storageUrl: `https://cdn.example.com/${assetId}.${suffix}`,
    mediaKind: kind, width: kind === 'audio' ? null : 1280, height: kind === 'audio' ? null : 720,
    durationSec: kind === 'image' ? null : 4,
    mimeType: kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'audio/wav',
    sizeBytes: 1024, originalName: `${assetId}.${suffix}`,
  };
}

function detailsDeps(engineId: string): AgentModelCatalogDeps {
  const { engine } = candidate(engineId);
  return {
    listEngines: async () => [engine],
    getEngineIncludingHidden: async () => engine,
    surfaceByEngineId: () => 'video',
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
}

function paidBody(canonical: CanonicalGenerationRequest, resolvedReferences: ResolvedReference[] = []) {
  return buildPaidVideoRequestBody({
    quoteId: 'quote-reference-parity', request: canonical,
    engine: candidate(canonical.engineId).engine, resolvedReferences,
    canonicalPricing: { membershipTier: 'member' },
  });
}

test('Wan document and webpage references are discoverable, validated and projected into paid requests', async () => {
  for (const engineId of ['wan-3', 'wan-3-prime']) {
    const details = await getAgentModelDetails(engineId, detailsDeps(engineId));
    const settings = details.modes.find(({ mode }) => mode === 'ref2v')!.settings;
    assert.ok(details.modes.find(({ mode }) => mode === 'ref2v')!.referenceRequirement?.alternatives
      .some((alternative) => 'setting' in alternative && alternative.setting === 'documentUrl'));
    for (const key of ['documentUrl', 'webpageUrl', 'enablePromptExpansion']) {
      assert.ok(settings.some((setting) => setting.key === key), `${engineId}:${key}`);
    }
    for (const [key, field] of [['documentUrl', 'file_url'], ['webpageUrl', 'web_url']] as const) {
      const canonical = request(engineId, 'ref2v', {
        settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', [key]: 'https://example.com/brief.pdf' },
      });
      assert.equal(prepareGenerationInputSchema.safeParse(canonical).success, true);
      assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, candidate(engineId)));
      assert.deepEqual(paidBody(canonical).extraInputValues, { [field]: 'https://example.com/brief.pdf' });
      assert.throws(() => validateCanonicalGenerationCapabilities({
        ...canonical, settings: { ...canonical.settings, enablePromptExpansion: false },
      }, candidate(engineId)), GenerationCapabilityError);
    }
    assert.throws(() => validateCanonicalGenerationCapabilities(request(engineId, 'ref2v', {
      settings: {
        durationSec: 5, resolution: '720p', aspectRatio: '16:9',
        documentUrl: 'https://example.com/brief.pdf', webpageUrl: 'https://example.com',
      },
    }), candidate(engineId)), GenerationCapabilityError);
    assert.throws(() => request(engineId, 'ref2v', {
      settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', webpageUrl: 'https://user:secret@example.com/private' },
    }));
  }
});

test('Wan image-to-video source role uses its schema start image field', () => {
  const canonical = request('wan-3', 'i2v', {
    references: [{ kind: 'asset', assetId: 'frame', role: 'source' }],
  });
  const references = [resolved('frame', 'image', 'source')];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, candidate('wan-3'), { resolvedReferences: references }));
  assert.equal((paidBody(canonical, references).inputs as Array<{ slotId: string }>)[0]?.slotId, 'start_image_url');
});

test('Wan editing and extension preserve owned image/audio guidance alongside the source video', () => {
  for (const engineId of ['wan-3', 'wan-3-prime']) {
    for (const mode of ['v2v', 'extend'] as const) {
      const canonical = request(engineId, mode, {
        references: [
          { kind: 'asset', assetId: 'source', role: 'source' },
          { kind: 'asset', assetId: 'image', role: 'reference' },
          { kind: 'asset', assetId: 'audio', role: 'reference' },
        ],
      });
      const references = canonical.references.map((reference) => ({
        ...resolved(reference.kind === 'asset' ? reference.assetId : '',
          reference.role === 'source' ? 'video' : reference.kind === 'asset' && reference.assetId === 'audio' ? 'audio' : 'image',
          reference.role),
        ...(reference.slot === undefined ? {} : { slot: reference.slot }),
      }));
      assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, candidate(engineId), { resolvedReferences: references }));
      const body = paidBody(canonical, references);
      assert.equal(body.videoUrl, 'https://cdn.example.com/source.mp4');
      assert.deepEqual(body.referenceImages, ['https://cdn.example.com/image.png']);
      assert.deepEqual(body.referenceAudio, ['https://cdn.example.com/audio.wav']);
      const inputs = body.inputs as Array<{ slotId: string; assetId: string }>;
      assert.ok(inputs.some(({ slotId, assetId }) => slotId === 'reference_image_urls' && assetId === 'image'));
      assert.ok(inputs.some(({ slotId, assetId }) => slotId === 'reference_audio_urls' && assetId === 'audio'));
    }
  }
});

test('H3 Max accepts an owned final frame alone and projects target audio by its schema field', async () => {
  const engine = candidate('minimax-h3-max');
  const details = await getAgentModelDetails(engine.engine.id, detailsDeps(engine.engine.id));
  assert.deepEqual(details.modes.find(({ mode }) => mode === 'i2v')?.referenceRequirement, {
    min: 1,
    alternatives: [
      { type: 'image', roles: ['source', 'first_frame'] },
      { type: 'image', roles: ['last_frame'] },
    ],
  });
  for (const mode of ['t2v', 'i2v'] as const) {
    const canonical = request(engine.engine.id, mode, {
      references: [
        ...(mode === 'i2v' ? [{ kind: 'asset' as const, assetId: 'last', role: 'last_frame' as const }] : []),
        { kind: 'asset', assetId: 'target-audio', role: 'reference' },
      ],
    });
    const references = [
      ...(mode === 'i2v' ? [resolved('last', 'image', 'last_frame')] : []),
      { ...resolved('target-audio', 'audio'), durationSec: 30 },
    ];
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, engine, { resolvedReferences: references }));
    const body = paidBody(canonical, references);
    assert.equal(body.imageUrl, undefined);
    if (mode === 'i2v') assert.equal(body.endImageUrl, 'https://cdn.example.com/last.png');
    assert.ok((body.inputs as Array<{ slotId: string }>).some(({ slotId }) => slotId === 'target_audio_url'));
    const audio = details.modes.find((entry) => entry.mode === mode)!.references.find(({ type }) => type === 'audio');
    assert.equal(audio?.assetRequired, true);
    assert.equal(audio?.durationSec?.combinedMax, null);
    assert.equal(audio?.durationSec?.max, null);
  }
  assert.throws(() => validateCanonicalGenerationCapabilities(request(engine.engine.id, 'i2v', {
    references: [{ kind: 'asset', assetId: 'target-audio', role: 'reference' }],
  }), engine), (error) => error instanceof GenerationCapabilityError && error.kind === 'reference_required');
});

test('H3 Max audio-only reference mode and all media metadata remain owned and verified', () => {
  const engine = candidate('minimax-h3-max');
  for (const kind of ['image', 'video', 'audio'] as const) {
    const canonical = request(engine.engine.id, 'ref2v', {
      references: [{ kind: 'asset', assetId: kind, role: 'reference' }],
    });
    const references = [resolved(kind, kind)];
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, engine, { resolvedReferences: references }));
    assert.ok((paidBody(canonical, references).inputs as Array<{ slotId: string }>).some(({ slotId }) => slotId === `reference_${kind}_urls`));
    for (const invalid of [
      { ...references[0]!, sizeBytes: null },
      { ...references[0]!, mimeType: 'application/octet-stream' },
      { ...references[0]!, originalName: 'forged.exe' },
      ...(kind === 'audio' ? [] : [{ ...references[0]!, width: null }]),
      ...(kind === 'image' ? [] : [{ ...references[0]!, durationSec: null }]),
    ]) {
      assert.throws(() => validateCanonicalGenerationCapabilities(canonical, engine, { resolvedReferences: [invalid] }), GenerationCapabilityError);
    }
    assert.throws(() => validateCanonicalGenerationCapabilities(request(engine.engine.id, 'ref2v', {
      references: [{ kind: 'https', url: references[0]!.storageUrl, mediaKind: kind, role: 'reference' }],
    }), engine), GenerationCapabilityError);
    assert.throws(() => normalizeGenerationRequest({
      ...canonical,
      references: [{ ...canonical.references[0], width: 1024, durationSec: 2, verifiedReferenceTokenCount: 0 }],
    }));
  }
});

test('H3 shares final-frame-only, target soundtrack, and audio-only reference capabilities', () => {
  const engine = candidate('minimax-h3');
  for (const mode of ['t2v', 'i2v', 'ref2v'] as const) {
    const canonical = request(engine.engine.id, mode, {
      references: [
        ...(mode === 'i2v' ? [{ kind: 'asset' as const, assetId: 'last', role: 'last_frame' as const }] : []),
        { kind: 'asset', assetId: 'audio', role: 'reference' },
      ],
    });
    const references = [
      ...(mode === 'i2v' ? [resolved('last', 'image', 'last_frame')] : []),
      { ...resolved('audio', 'audio'), durationSec: mode === 'ref2v' ? 4 : 30 },
    ];
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, engine));
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, engine, { resolvedReferences: references }));
    assert.ok((paidBody(canonical, references).inputs as Array<{ slotId: string }>).some(({ slotId }) =>
      slotId === (mode === 'ref2v' ? 'reference_audio_urls' : 'target_audio_url')));
  }
});

test('H3 Max prepares and reprices the customer quote from freshly resolved reference cost facts', async () => {
  const canonical = request('minimax-h3-max', 'ref2v', {
    references: [{ kind: 'asset', assetId: 'video', role: 'reference' }],
  });
  const verified = [resolved('video', 'video')];
  let preparedBudget: number | undefined;
  let confirmedBudget: number | undefined;
  const pricing = { totalCents: 100, currency: 'USD', membershipTier: 'member' as const };
  const pricingDependencies = {
    computeVideoPreflight: async (_payload, options) => {
      preparedBudget = options?.trustedMediaPricingFacts?.referenceTokenBudget;
      return { ok: true, total: 100, currency: 'USD', pricing };
    },
    estimateImage: async () => { throw new Error('unused'); },
  } satisfies Parameters<typeof priceCanonicalGeneration>[2];
  await priceCanonicalGeneration(canonical, 'member', pricingDependencies, { resolvedReferences: verified });
  assert.ok(typeof preparedBudget === 'number' && preparedBudget > 4096);
  const executor = { query: async () => [] } as TransactionQueryExecutor;
  const confirmationDependencies = {
    executor, candidate: candidate(canonical.engineId), resolvedReferences: verified,
    computeBillingSnapshot: async (context) => {
      confirmedBudget = context.referenceTokenBudget;
      return pricing as never;
    },
  } satisfies Parameters<typeof priceCanonicalGenerationInExecutor>[2];
  await priceCanonicalGenerationInExecutor(canonical, 'member', confirmationDependencies);
  assert.equal(confirmedBudget, preparedBudget);
  await priceCanonicalGenerationInExecutor(canonical, 'member', {
    ...confirmationDependencies,
    resolvedReferences: [{ ...verified[0]!, durationSec: 2 }],
  });
  assert.ok(confirmedBudget! < preparedBudget!);
  for (const resolvedReferences of [undefined, [], [{ ...verified[0]!, durationSec: null }]]) {
    await assert.rejects(priceCanonicalGeneration(canonical, 'member', pricingDependencies, { resolvedReferences }));
    await assert.rejects(priceCanonicalGenerationInExecutor(canonical, 'member', { ...confirmationDependencies, resolvedReferences }));
  }
  await assert.rejects(priceCanonicalGeneration({
    ...canonical,
    references: [{ kind: 'https', url: verified[0]!.storageUrl, role: 'reference', mediaKind: 'video' }],
  }, 'member', pricingDependencies, { resolvedReferences: verified }));
  assert.throws(() => request('minimax-h3-max', 'ref2v', {
    settings: { ...canonical.settings, referenceTokenBudget: 0 },
  }));
});

test('Wan reference pricing includes unique persisted video durations in prepare and confirmation', async () => {
  for (const [engineId, vendorCents, customerCents] of [['wan-3', 150, 195], ['wan-3-prime', 210, 273]] as const) {
    for (const mode of ['ref2v', 'v2v', 'extend'] as const) {
      const canonical = request(engineId, mode, {
        references: [{ kind: 'asset', assetId: 'video', role: mode === 'ref2v' ? 'reference' : 'source' }],
      });
      const reference = canonical.references[0]!;
      const references = [{ ...resolved('video', 'video', reference.role), slot: reference.slot, durationSec: 10 }];
      const prepared = await priceCanonicalGeneration(canonical, 'member', undefined, {
        resolvedReferences: references, resolvedEngine: candidate(engineId).engine,
      });
      const confirmed = await priceCanonicalGenerationInExecutor(canonical, 'member', {
        executor: { query: async () => [] } as TransactionQueryExecutor,
        candidate: candidate(engineId), resolvedReferences: references,
      });
      assert.equal(prepared.priceCents, customerCents, `${engineId}/${mode}/prepared`);
      assert.equal(confirmed.priceCents, customerCents, `${engineId}/${mode}/confirmed`);
      assert.equal(confirmed.pricingSnapshot.vendorShareCents, vendorCents);
      assert.equal((confirmed.pricingSnapshot.meta as Record<string, unknown>).input_video_duration_sec, 10);
      await assert.rejects(priceCanonicalGeneration(canonical, 'member', undefined, { resolvedEngine: candidate(engineId).engine }));
      await assert.rejects(priceCanonicalGenerationInExecutor(canonical, 'member', {
        executor: { query: async () => [] } as TransactionQueryExecutor,
        candidate: candidate(engineId), resolvedReferences: [{ ...references[0]!, durationSec: null }],
      }));
      const raw = { ...canonical, references: [{ kind: 'https' as const, mediaKind: 'video' as const, url: references[0]!.storageUrl, role: reference.role }] };
      assert.throws(() => validateCanonicalGenerationCapabilities(raw, candidate(engineId)), GenerationCapabilityError);
    }
  }
  const canonical = request('wan-3', 'ref2v', {
    references: [
      { kind: 'asset', assetId: 'video-a', role: 'reference' },
      { kind: 'asset', assetId: 'video-b', role: 'reference' },
      { kind: 'asset', assetId: 'image', role: 'reference' },
    ],
  });
  const price = await priceCanonicalGenerationInExecutor(canonical, 'member', {
    executor: { query: async () => [] } as TransactionQueryExecutor,
    candidate: candidate('wan-3'), resolvedReferences: [
      { ...resolved('video-a', 'video'), storageUrl: 'https://cdn.example.com/duplicate.mp4', durationSec: 10 },
      { ...resolved('video-b', 'video'), storageUrl: 'https://cdn.example.com/duplicate.mp4', durationSec: 10 },
      resolved('image', 'image'),
    ],
  });
  assert.equal(price.priceCents, 195, 'Duplicate asset aliases of one video are charged once.');
  const imageOnly = { ...canonical, references: canonical.references.filter((reference) => reference.kind === 'asset' && reference.assetId === 'image') };
  const imagePrice = await priceCanonicalGenerationInExecutor(imageOnly, 'member', {
    executor: { query: async () => [] } as TransactionQueryExecutor,
    candidate: candidate('wan-3'), resolvedReferences: [resolved('image', 'image')],
  });
  assert.equal(imagePrice.priceCents, 65);
  assert.throws(() => request('wan-3', 'ref2v', { settings: { ...canonical.settings, inputVideoDurationSec: 0 } }));
});
