import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  MAX_CANONICAL_PROMPT_CHARS,
} from '../frontend/src/server/agent-api/generation-normalization';
import { listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import {
  MCP_TRIAL_PRESET,
  assertTrialPresetSupported,
  normalizeTrialCandidate,
} from '../frontend/src/server/agent-api/trial-preset';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';

function trialCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: '  A paper sculpture unfolds\ninto a luminous city.  ',
    settings: { aspectRatio: '16:9', audio: true },
    references: [],
    outputCount: 1,
    ...overrides,
  };
}

async function getCurrentTrialEngine(): Promise<AgentPublicGenerationEngine> {
  const engine = listFalEngines().find((entry) => entry.id === MCP_TRIAL_PRESET.engineId)?.engine;
  assert.ok(engine, 'the current Seedance Mini catalog entry must exist');
  const candidates = await listPublicAgentGenerationEngines({
    listEngines: async () => [engine],
    surfaceByEngineId: () => 'video',
  });
  const candidate = candidates.find((entry) => entry.engine.id === MCP_TRIAL_PRESET.engineId);
  assert.ok(candidate, 'the current Seedance Mini entry must be exposed by the public agent catalog');
  return candidate;
}

function cloneEngine(candidate: AgentPublicGenerationEngine): AgentPublicGenerationEngine {
  return structuredClone(candidate);
}

test('owns the exact immutable Seedance Mini trial preset', () => {
  assert.deepEqual(MCP_TRIAL_PRESET, {
    engineId: 'seedance-2-0-mini',
    surface: 'video',
    mode: 't2v',
    durationSec: 5,
    resolution: '480p',
    aspectRatios: ['16:9', '9:16', '1:1'],
    outputCount: 1,
  });
});

test('normalizes a trial candidate to the forced canonical no-reference request', () => {
  assert.deepEqual(normalizeTrialCandidate(trialCandidate()), {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: 'A paper sculpture unfolds into a luminous city.',
    settings: {
      aspectRatio: '16:9',
      audio: true,
      durationSec: 5,
      resolution: '480p',
    },
    references: [],
    outputCount: 1,
  });
});

test('accepts every allowed ratio and primitive audio state without coercion', () => {
  for (const aspectRatio of MCP_TRIAL_PRESET.aspectRatios) {
    for (const audio of [true, false]) {
      const normalized = normalizeTrialCandidate(
        trialCandidate({ settings: { aspectRatio, audio } }),
      );
      assert.equal(normalized.settings.aspectRatio, aspectRatio);
      assert.equal(normalized.settings.audio, audio);
    }
  }

  for (const audio of ['true', 'false', 0, 1, null]) {
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({ settings: { aspectRatio: '16:9', audio } })),
      /trial candidate/i,
    );
  }
});

test('defaults the required ratio and forces explicit audio on when omitted', () => {
  const normalized = normalizeTrialCandidate(
    trialCandidate({ schemaVersion: undefined, settings: undefined, references: undefined, outputCount: undefined }),
  );

  assert.deepEqual(normalized.settings, {
    aspectRatio: '16:9',
    audio: true,
    durationSec: 5,
    resolution: '480p',
  });
  assert.deepEqual(normalized.references, []);
  assert.equal(normalized.outputCount, 1);
});

test('trims a bounded prompt and rejects empty, non-string, or oversized prompts', () => {
  assert.equal(
    normalizeTrialCandidate(trialCandidate({ prompt: '  Caf\u00e9\tlaunch\nwith   soft light  ' })).prompt,
    'Caf\u00e9 launch with soft light',
  );
  for (const prompt of ['', ' \n\t ', 42, 'x'.repeat(MAX_CANONICAL_PROMPT_CHARS + 1)]) {
    assert.throws(() => normalizeTrialCandidate(trialCandidate({ prompt })), /trial candidate/i);
  }
});

test('requires the exact public trial engine, surface, mode, and schema version', () => {
  for (const overrides of [
    { engineId: 'seedance-2-0' },
    { engineId: 'gpt-image-2' },
    { surface: 'image' },
    { mode: 'i2v' },
    { mode: 'ref2v' },
    { schemaVersion: 2 },
  ]) {
    assert.throws(() => normalizeTrialCandidate(trialCandidate(overrides)), /trial candidate/i);
  }
});

test('rejects references and every source or reference-shaped top-level input', () => {
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({
      references: [{ kind: 'https', url: 'https://example.com/image.png', role: 'reference' }],
    })),
    /trial candidate/i,
  );
  for (const field of [
    'image',
    'imageUrl',
    'image_url',
    'source',
    'sourceImage',
    'sourceVideo',
    'reference',
    'referenceImage',
    'referenceImages',
    'referenceUrls',
    'videoUrl',
  ]) {
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({ [field]: 'https://example.com/media' })),
      /trial candidate/i,
    );
  }
});

test('rejects duration, resolution, provider, funding, membership, add-on, and extra settings', () => {
  for (const field of [
    'durationSec',
    'resolution',
    'seed',
    'negativePrompt',
    'fps',
    'loop',
    'quality',
    'provider',
    'providerRoute',
    'paymentMode',
    'fundingMode',
    'membershipTier',
    'paidAddon',
  ]) {
    const value = field === 'durationSec' ? 5 : field === 'resolution' ? '480p' : true;
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({
        settings: { aspectRatio: '16:9', audio: true, [field]: value },
      })),
      /trial candidate/i,
    );
  }
  for (const field of ['provider', 'providerRoute', 'paymentMode', 'fundingMode', 'membershipTier', 'price']) {
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({ [field]: 'not-allowed' })),
      /trial candidate/i,
    );
  }
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({ settings: { aspectRatio: '16:9', audio: { enabled: true } } })),
    /trial candidate/i,
  );
});

test('accepts only output count one', () => {
  assert.equal(normalizeTrialCandidate(trialCandidate({ outputCount: 1 })).outputCount, 1);
  for (const outputCount of [-1, 0, 2, 1.5, '1', null]) {
    assert.throws(() => normalizeTrialCandidate(trialCandidate({ outputCount })), /trial candidate/i);
  }
});

test('rejects arrays, custom prototypes, accessors, symbols, and prototype-pollution fields', () => {
  assert.throws(() => normalizeTrialCandidate([]), /trial candidate/i);
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({ settings: [] })),
    /trial candidate/i,
  );

  const customPrototypeCandidate = Object.assign(Object.create({ injected: true }), trialCandidate());
  assert.throws(() => normalizeTrialCandidate(customPrototypeCandidate), /trial candidate/i);

  const customPrototypeSettings = Object.assign(Object.create({ seed: 1 }), {
    aspectRatio: '16:9',
    audio: true,
  });
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({ settings: customPrototypeSettings })),
    /trial candidate/i,
  );

  const accessorCandidate = trialCandidate();
  Object.defineProperty(accessorCandidate, 'provider', {
    enumerable: true,
    get() {
      throw new Error('accessor must never execute');
    },
  });
  assert.throws(() => normalizeTrialCandidate(accessorCandidate), /trial candidate/i);

  const accessorSettings = { aspectRatio: '16:9' };
  Object.defineProperty(accessorSettings, 'audio', {
    enumerable: true,
    get() {
      throw new Error('accessor must never execute');
    },
  });
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({ settings: accessorSettings })),
    /trial candidate/i,
  );

  const symbolCandidate = trialCandidate();
  Object.defineProperty(symbolCandidate, Symbol('provider'), { enumerable: true, value: 'hidden' });
  assert.throws(() => normalizeTrialCandidate(symbolCandidate), /trial candidate/i);

  const symbolSettings = { aspectRatio: '16:9', audio: true };
  Object.defineProperty(symbolSettings, Symbol('seed'), { enumerable: true, value: 7 });
  assert.throws(
    () => normalizeTrialCandidate(trialCandidate({ settings: symbolSettings })),
    /trial candidate/i,
  );

  const pollutionCandidate = Object.assign(Object.create(null), trialCandidate());
  Object.defineProperty(pollutionCandidate, '__proto__', { enumerable: true, value: { polluted: true } });
  assert.throws(() => normalizeTrialCandidate(pollutionCandidate), /trial candidate/i);
});

test('returns fresh settings and references that cannot be changed through caller mutation', () => {
  const settings = { aspectRatio: '9:16', audio: false };
  const references: unknown[] = [];
  const candidate = trialCandidate({ settings, references });
  const normalized = normalizeTrialCandidate(candidate);

  settings.aspectRatio = '1:1';
  settings.audio = true;
  references.push({ kind: 'asset', assetId: 'later', role: 'reference' });
  candidate.prompt = 'Changed later';

  assert.deepEqual(normalized, {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: 'A paper sculpture unfolds into a luminous city.',
    settings: {
      aspectRatio: '9:16',
      audio: false,
      durationSec: 5,
      resolution: '480p',
    },
    references: [],
    outputCount: 1,
  });
});

test('the actual current public Seedance Mini catalog entry supports the trial preset', async () => {
  const candidate = await getCurrentTrialEngine();
  assert.doesNotThrow(() => assertTrialPresetSupported(candidate));
});

test('fails closed when identity, publication, or t2v mode capability changes', async () => {
  const current = await getCurrentTrialEngine();
  const mutations: Array<(candidate: AgentPublicGenerationEngine) => void> = [
    (candidate) => { candidate.engine.id = 'seedance-2-0'; },
    (candidate) => { candidate.surface = 'image'; },
    (candidate) => { candidate.engine.status = 'busy'; },
    (candidate) => { candidate.engine.availability = 'limited'; },
    (candidate) => { candidate.publicModes = candidate.publicModes.filter((mode) => mode !== 't2v'); },
    (candidate) => { delete candidate.modeCaps.t2v; },
  ];
  for (const mutate of mutations) {
    const candidate = cloneEngine(current);
    mutate(candidate);
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
});

test('fails closed when five-second duration support changes', async () => {
  const current = await getCurrentTrialEngine();
  for (const mutate of [
    (candidate: AgentPublicGenerationEngine) => { candidate.engine.maxDurationSec = 4; },
    (candidate: AgentPublicGenerationEngine) => {
      const duration = candidate.modeCaps.t2v?.duration;
      assert.ok(duration && 'options' in duration);
      duration.options = duration.options.filter((value) => Number(value) !== 5);
    },
    (candidate: AgentPublicGenerationEngine) => {
      const duration = candidate.engine.inputSchema?.optional?.find((field) => field.id === 'duration');
      assert.ok(duration?.values);
      duration.values = duration.values.filter((value) => Number(value) !== 5);
    },
  ]) {
    const candidate = cloneEngine(current);
    mutate(candidate);
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
});

test('fails closed when 480p or an allowed ratio disappears from engine, mode, or schema caps', async () => {
  const current = await getCurrentTrialEngine();
  const mutations: Array<(candidate: AgentPublicGenerationEngine) => void> = [
    (candidate) => { candidate.engine.resolutions = candidate.engine.resolutions.filter((value) => value !== '480p'); },
    (candidate) => { candidate.modeCaps.t2v!.resolution = candidate.modeCaps.t2v!.resolution?.filter((value) => value !== '480p'); },
    (candidate) => {
      const field = candidate.engine.inputSchema?.optional?.find((entry) => entry.id === 'resolution');
      assert.ok(field?.values);
      field.values = field.values.filter((value) => value !== '480p');
    },
    (candidate) => { candidate.engine.aspectRatios = candidate.engine.aspectRatios.filter((value) => value !== '1:1'); },
    (candidate) => { candidate.modeCaps.t2v!.aspectRatio = candidate.modeCaps.t2v!.aspectRatio?.filter((value) => value !== '9:16'); },
    (candidate) => {
      const field = candidate.engine.inputSchema?.optional?.find((entry) => entry.id === 'aspect_ratio');
      assert.ok(field?.values);
      field.values = field.values.filter((value) => value !== '16:9');
    },
  ];
  for (const mutate of mutations) {
    const candidate = cloneEngine(current);
    mutate(candidate);
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
});

test('fails closed when audio on/off or reference-free t2v support changes', async () => {
  const current = await getCurrentTrialEngine();
  const mutations: Array<(candidate: AgentPublicGenerationEngine) => void> = [
    (candidate) => { candidate.engine.audio = false; },
    (candidate) => { candidate.modeCaps.t2v!.audioToggle = false; },
    (candidate) => {
      const field = candidate.engine.inputSchema?.optional?.find((entry) => entry.id === 'generate_audio');
      assert.ok(field);
      field.type = 'enum';
    },
    (candidate) => {
      candidate.engine.inputSchema!.required!.push({
        id: 'trial_reference',
        type: 'image',
        label: 'Trial reference',
        modes: ['t2v'],
        requiredInModes: ['t2v'],
      });
    },
  ];
  for (const mutate of mutations) {
    const candidate = cloneEngine(current);
    mutate(candidate);
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
});

test('fails closed when pricing is missing, malformed, or audio changes the addon total', async () => {
  const current = await getCurrentTrialEngine();
  const mutations: Array<(candidate: AgentPublicGenerationEngine) => void> = [
    (candidate) => {
      candidate.engine.pricingDetails = undefined;
      candidate.engine.pricing = undefined;
    },
    (candidate) => {
      candidate.engine.pricingDetails = {
        ...(candidate.engine.pricingDetails ?? { currency: 'USD' }),
        addons: { audio: { flatCents: Number.NaN } },
      };
    },
    (candidate) => {
      candidate.engine.pricingDetails = {
        ...(candidate.engine.pricingDetails ?? { currency: 'USD' }),
        addons: { audio: { flatCents: 1 } },
      };
    },
  ];
  for (const mutate of mutations) {
    const candidate = cloneEngine(current);
    mutate(candidate);
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
});
