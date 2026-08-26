import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { getModelRegistryEntryById } from '../frontend/config/model-registry';
import {
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';
import {
  CANONICAL_GENERATION_MODES,
  type CanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-types';
import {
  listAgentModels,
  type AgentModelCatalogDeps,
  type AgentPublicGenerationEngine,
} from '../frontend/src/server/agent-api/model-catalog';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing registry engine ${engineId}`);
  return {
    engine: entry.engine,
    surface: 'video',
    publicModes: entry.modes.map(({ mode }) => mode) as AgentPublicGenerationEngine['publicModes'],
    modeCaps: Object.fromEntries(entry.modes.map(({ mode, ui }) => [mode, ui])),
  };
}

function realRegistryDeps(): AgentModelCatalogDeps {
  const entries = listFalEngines();
  return {
    async listEngines() {
      return entries.map(({ engine }) => engine);
    },
    surfaceByEngineId(engineId) {
      const entry = entries.find((candidate) => candidate.id === engineId);
      return entry?.category === 'image' ? 'image' : entry ? 'video' : null;
    },
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
}

function request(input: Record<string, unknown>): CanonicalGenerationRequest {
  return normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    prompt: 'Create one controlled cinematic transition.',
    outputCount: 1,
    ...input,
  });
}

test('MCP discovery exposes the executable first/last-frame and reference-video workflows', async () => {
  const deps = realRegistryDeps();
  const [veo] = await listAgentModels({ id: 'veo-3-1' }, deps);
  const [wan] = await listAgentModels({ id: 'wan-2-6' }, deps);

  assert.ok(veo);
  assert.ok(wan);
  assert.ok(veo.modes.includes('fl2v' as never));
  assert.ok(wan.modes.includes('r2v' as never));
});

test('MCP mode parity audit identifies every remaining specialized public workflow', async () => {
  const supported = new Set<string>(CANONICAL_GENERATION_MODES);
  const videoModes = new Set(['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend']);
  const imageModes = new Set(['t2i', 'i2i']);
  const publicEntries = listFalEngines().filter((entry) =>
    getModelRegistryEntryById(entry.id)?.publication.app.published === true
  );
  const remaining = publicEntries.flatMap((entry) =>
    entry.modes.flatMap(({ mode }) => {
      const surfaceModes = entry.category === 'image' ? imageModes : videoModes;
      return supported.has(mode) && surfaceModes.has(mode) ? [] : [`${entry.id}:${mode}`];
    })
  ).sort();

  assert.deepEqual(remaining, [
    'gemini-omni-flash:retake',
    'kling-2-5-turbo:i2i',
    'ltx-2-3:a2v',
    'ltx-2-3:retake',
    'luma-ray-3-2:reframe',
    'lumaRay2:reframe',
    'lumaRay2_flash:reframe',
  ]);

  const deps = realRegistryDeps();
  for (const entry of publicEntries) {
    const [model] = await listAgentModels({ id: entry.id }, deps);
    assert.ok(model, `${entry.id} is published in the app but absent from MCP discovery`);
    const expectedModes = entry.modes
      .map(({ mode }) => mode)
      .filter((mode) => supported.has(mode))
      .filter((mode) => (entry.category === 'image' ? imageModes : videoModes).has(mode));
    assert.deepEqual(model.modes, expectedModes, entry.id);
  }
});

test('MCP normalization and tool schema accept fl2v and r2v as video modes', () => {
  for (const mode of ['fl2v', 'r2v']) {
    const input = {
      engineId: mode === 'fl2v' ? 'veo-3-1' : 'wan-2-6',
      mode,
      settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9' },
      references: [],
    };
    assert.equal(request(input).mode, mode);
    assert.equal(prepareGenerationInputSchema.safeParse({
      schemaVersion: 1,
      surface: 'video',
      prompt: 'Create one controlled cinematic transition.',
      outputCount: 1,
      ...input,
    }).success, true);
  }
});

test('real capability validation enforces the reference contract for fl2v and r2v', () => {
  const fl2v = request({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/first.png', role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: 'https://cdn.example.com/last.png', role: 'last_frame', mediaKind: 'image' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(fl2v, registryCapability('veo-3-1')));

  const r2v = request({
    engineId: 'wan-2-6',
    mode: 'r2v',
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/a.mp4', role: 'reference', mediaKind: 'video' },
      { kind: 'https', url: 'https://cdn.example.com/b.mp4', role: 'reference', mediaKind: 'video' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(r2v, registryCapability('wan-2-6')));
});

test('paid video projection preserves first/last-frame and ordered reference-video slots', () => {
  const firstUrl = 'https://cdn.example.com/first.png';
  const lastUrl = 'https://cdn.example.com/last.png';
  const fl2v = request({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9' },
    references: [
      { kind: 'https', url: firstUrl, role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: lastUrl, role: 'last_frame', mediaKind: 'image' },
    ],
  });
  const fl2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-fl2v',
    request: fl2v,
    engine: registryCapability('veo-3-1').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(fl2vBody.imageUrl, firstUrl);
  assert.equal(fl2vBody.endImageUrl, lastUrl);
  assert.deepEqual(fl2vBody.inputs, [
    { kind: 'image', slotId: 'first_frame_url', url: firstUrl },
    { kind: 'image', slotId: 'last_frame_url', url: lastUrl },
  ]);

  const referenceUrls = ['https://cdn.example.com/z-first.mp4', 'https://cdn.example.com/a-second.mp4'];
  const r2v = request({
    engineId: 'wan-2-6',
    mode: 'r2v',
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
    references: referenceUrls.map((url) => ({
      kind: 'https', url, role: 'reference', mediaKind: 'video',
    })),
  });
  assert.doesNotThrow(() => hashCanonicalGenerationRequest(r2v));
  const r2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-r2v',
    request: r2v,
    engine: registryCapability('wan-2-6').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(r2vBody.referenceVideos, referenceUrls);
  assert.deepEqual(r2vBody.inputs, referenceUrls.map((url) => ({
    kind: 'video', slotId: 'video_urls', url,
  })));
});
