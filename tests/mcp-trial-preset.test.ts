import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  const originalDuration = MCP_TRIAL_PRESET.durationSec;
  const originalRatio = MCP_TRIAL_PRESET.aspectRatios[0];
  const presetMutationSucceeded = Reflect.set(
    MCP_TRIAL_PRESET as unknown as Record<string, unknown>,
    'durationSec',
    10,
  );
  const ratioMutationSucceeded = Reflect.set(
    MCP_TRIAL_PRESET.aspectRatios as unknown as string[],
    0,
    '4:3',
  );
  if (presetMutationSucceeded) {
    Reflect.set(MCP_TRIAL_PRESET as unknown as Record<string, unknown>, 'durationSec', originalDuration);
  }
  if (ratioMutationSucceeded) {
    Reflect.set(MCP_TRIAL_PRESET.aspectRatios as unknown as string[], 0, originalRatio);
  }

  assert.equal(Object.isFrozen(MCP_TRIAL_PRESET), true);
  assert.equal(Object.isFrozen(MCP_TRIAL_PRESET.aspectRatios), true);
  assert.equal(presetMutationSucceeded, false);
  assert.equal(ratioMutationSucceeded, false);
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

test('keeps public-engine policy in a pure leaf outside catalog and server engine owners', () => {
  const trialPresetPath = new URL(
    '../frontend/src/server/agent-api/trial-preset.ts',
    import.meta.url,
  );
  const modelCatalogPath = new URL(
    '../frontend/src/server/agent-api/model-catalog.ts',
    import.meta.url,
  );
  const publicPolicyPath = new URL(
    '../frontend/src/server/agent-api/public-engine-policy.ts',
    import.meta.url,
  );
  assert.equal(existsSync(publicPolicyPath), true, 'public engine policy must have a leaf owner');

  const trialPresetSource = readFileSync(trialPresetPath, 'utf8');
  const modelCatalogSource = readFileSync(modelCatalogPath, 'utf8');
  const publicPolicySource = readFileSync(publicPolicyPath, 'utf8');
  assert.doesNotMatch(trialPresetSource, /from ['"]\.\/model-catalog['"]/u);
  assert.match(trialPresetSource, /from ['"]\.\/public-engine-policy['"]/u);
  assert.match(modelCatalogSource, /from ['"]\.\/public-engine-policy['"]/u);
  assert.doesNotMatch(
    publicPolicySource,
    /@\/server\/engines|@\/lib\/db|\.\/model-catalog|falEngines|provider/iu,
  );
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
  const candidate = trialCandidate();
  delete candidate.schemaVersion;
  delete candidate.settings;
  delete candidate.references;
  delete candidate.outputCount;
  const normalized = normalizeTrialCandidate(candidate);

  assert.deepEqual(normalized.settings, {
    aspectRatio: '16:9',
    audio: true,
    durationSec: 5,
    resolution: '480p',
  });
  assert.deepEqual(normalized.references, []);
  assert.equal(normalized.outputCount, 1);
});

test('rejects optional envelope and setting properties when explicitly present as undefined', () => {
  for (const field of ['schemaVersion', 'settings', 'references', 'outputCount']) {
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({ [field]: undefined })),
      /trial candidate/i,
      `${field}: undefined must not be treated as omission`,
    );
  }
  for (const field of ['aspectRatio', 'audio']) {
    assert.throws(
      () => normalizeTrialCandidate(trialCandidate({
        settings: { aspectRatio: '16:9', audio: true, [field]: undefined },
      })),
      /trial candidate/i,
      `settings.${field}: undefined must not be treated as omission`,
    );
  }
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
    (candidate) => { candidate.engine.isLab = true; },
    (candidate) => { candidate.engine.apiAvailability = 'private'; },
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

test('fails closed before pricing calculation for exotic addon collections and audio rules', async () => {
  const current = await getCurrentTrialEngine();
  const candidates: AgentPublicGenerationEngine[] = [];
  let pricingDetailsAccessorReads = 0;
  let addonsAccessorReads = 0;
  let audioRuleAccessorReads = 0;
  let resolutionMapAccessorReads = 0;

  const withAddons = (addons: unknown): AgentPublicGenerationEngine => {
    const candidate = cloneEngine(current);
    assert.ok(candidate.engine.pricingDetails);
    (candidate.engine.pricingDetails as { addons?: unknown }).addons = addons;
    return candidate;
  };

  const accessorPricingDetails = cloneEngine(current);
  assert.ok(accessorPricingDetails.engine.pricingDetails);
  Object.defineProperty(accessorPricingDetails.engine.pricingDetails, 'addons', {
    configurable: true,
    enumerable: true,
    get() {
      pricingDetailsAccessorReads += 1;
      return {};
    },
  });
  assert.throws(() => assertTrialPresetSupported(accessorPricingDetails), /trial preset/i);
  assert.equal(pricingDetailsAccessorReads, 0);

  candidates.push(withAddons([]));
  candidates.push(withAddons({ audio: [] }));
  candidates.push(withAddons(Object.assign(Object.create({ inherited: true }), {})));

  const symbolAddons = {};
  Object.defineProperty(symbolAddons, Symbol('audio'), {
    enumerable: true,
    value: { flatCents: 1 },
  });
  candidates.push(withAddons(symbolAddons));

  const accessorAddons = {};
  Object.defineProperty(accessorAddons, 'audio', {
    enumerable: true,
    get() {
      addonsAccessorReads += 1;
      return {};
    },
  });
  candidates.push(withAddons(accessorAddons));

  candidates.push(withAddons({ audio: Object.assign(Object.create({ inherited: true }), { flatCents: 0 }) }));
  candidates.push(withAddons({ audio: { flatCents: 0, unexpected: true } }));

  const symbolAudioRule = { flatCents: 0 };
  Object.defineProperty(symbolAudioRule, Symbol('unexpected'), { enumerable: true, value: true });
  candidates.push(withAddons({ audio: symbolAudioRule }));

  const accessorAudioRule = {};
  Object.defineProperty(accessorAudioRule, 'flatCents', {
    enumerable: true,
    get() {
      audioRuleAccessorReads += 1;
      return 0;
    },
  });
  candidates.push(withAddons({ audio: accessorAudioRule }));

  candidates.push(withAddons({
    audio: { perSecondCentsByResolution: Object.assign(Object.create({ inherited: true }), { '480p': 0 }) },
  }));

  const symbolResolutionMap = { '480p': 0 };
  Object.defineProperty(symbolResolutionMap, Symbol('unexpected'), { enumerable: true, value: 1 });
  candidates.push(withAddons({ audio: { perSecondCentsByResolution: symbolResolutionMap } }));

  const accessorResolutionMap = {};
  Object.defineProperty(accessorResolutionMap, '480p', {
    enumerable: true,
    get() {
      resolutionMapAccessorReads += 1;
      return 0;
    },
  });
  candidates.push(withAddons({ audio: { perSecondCentsByResolution: accessorResolutionMap } }));

  for (const candidate of candidates) {
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }
  assert.equal(addonsAccessorReads, 0);
  assert.equal(audioRuleAccessorReads, 0);
  assert.equal(resolutionMapAccessorReads, 0);
});

test('fails closed without reading malformed modern and legacy pricing containers', async () => {
  const current = await getCurrentTrialEngine();
  let inheritedModernAddonReads = 0;
  let legacyAddonReads = 0;

  const pricingDetailsArray = cloneEngine(current);
  pricingDetailsArray.engine.pricingDetails = [] as never;
  assert.throws(() => assertTrialPresetSupported(pricingDetailsArray), /trial preset/i);

  const inheritedModernAddons = cloneEngine(current);
  assert.ok(inheritedModernAddons.engine.pricingDetails);
  const pricingDetailsPrototype = {};
  Object.defineProperty(pricingDetailsPrototype, 'addons', {
    enumerable: true,
    get() {
      inheritedModernAddonReads += 1;
      return {};
    },
  });
  inheritedModernAddons.engine.pricingDetails = Object.assign(
    Object.create(pricingDetailsPrototype),
    inheritedModernAddons.engine.pricingDetails,
  );
  assert.throws(() => assertTrialPresetSupported(inheritedModernAddons), /trial preset/i);
  assert.equal(inheritedModernAddonReads, 0);

  const legacyPricingArray = cloneEngine(current);
  legacyPricingArray.engine.pricing = [] as never;
  assert.throws(() => assertTrialPresetSupported(legacyPricingArray), /trial preset/i);

  const legacyAddonsArray = cloneEngine(current);
  assert.ok(legacyAddonsArray.engine.pricing);
  (legacyAddonsArray.engine.pricing as { addons?: unknown }).addons = [];
  assert.throws(() => assertTrialPresetSupported(legacyAddonsArray), /trial preset/i);

  const legacyAudioArray = cloneEngine(current);
  assert.ok(legacyAudioArray.engine.pricing);
  (legacyAudioArray.engine.pricing as { addons?: unknown }).addons = { audio: [] };
  assert.throws(() => assertTrialPresetSupported(legacyAudioArray), /trial preset/i);

  const legacyAddonAccessor = cloneEngine(current);
  assert.ok(legacyAddonAccessor.engine.pricing);
  Object.defineProperty(legacyAddonAccessor.engine.pricing, 'addons', {
    configurable: true,
    enumerable: true,
    get() {
      legacyAddonReads += 1;
      return {};
    },
  });
  assert.throws(() => assertTrialPresetSupported(legacyAddonAccessor), /trial preset/i);
  assert.equal(legacyAddonReads, 0);
});

test('rejects a direct engine pricingDetails getter without reading it', async () => {
  const current = await getCurrentTrialEngine();
  const candidate = cloneEngine(current);
  const safePricingDetails = candidate.engine.pricingDetails;
  let reads = 0;
  Object.defineProperty(candidate.engine, 'pricingDetails', {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      return safePricingDetails;
    },
  });

  let rejected = false;
  try {
    assertTrialPresetSupported(candidate);
  } catch {
    rejected = true;
  }
  assert.equal(reads, 0);
  assert.equal(rejected, true);
});

test('rejects a direct engine legacy pricing getter without reading it', async () => {
  const current = await getCurrentTrialEngine();
  const candidate = cloneEngine(current);
  const safeLegacyPricing = candidate.engine.pricing;
  let reads = 0;
  Object.defineProperty(candidate.engine, 'pricing', {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      return safeLegacyPricing;
    },
  });

  let rejected = false;
  try {
    assertTrialPresetSupported(candidate);
  } catch {
    rejected = true;
  }
  assert.equal(reads, 0);
  assert.equal(rejected, true);
});

test('rejects inherited and non-enumerable engine pricing properties before owner calculation', async () => {
  const current = await getCurrentTrialEngine();
  let inheritedPricingDetailsReads = 0;
  let inheritedLegacyPricingReads = 0;

  for (const key of ['pricingDetails', 'pricing'] as const) {
    const candidate = cloneEngine(current);
    const value = candidate.engine[key];
    Object.defineProperty(candidate.engine, key, {
      configurable: true,
      enumerable: false,
      value,
      writable: true,
    });
    assert.throws(() => assertTrialPresetSupported(candidate), /trial preset/i);
  }

  const inheritedPricingDetails = cloneEngine(current);
  const safePricingDetails = inheritedPricingDetails.engine.pricingDetails;
  delete inheritedPricingDetails.engine.pricingDetails;
  const pricingDetailsPrototype = Object.create(Object.getPrototypeOf(inheritedPricingDetails.engine));
  Object.defineProperty(pricingDetailsPrototype, 'pricingDetails', {
    enumerable: true,
    get() {
      inheritedPricingDetailsReads += 1;
      return safePricingDetails;
    },
  });
  Object.setPrototypeOf(inheritedPricingDetails.engine, pricingDetailsPrototype);
  assert.throws(() => assertTrialPresetSupported(inheritedPricingDetails), /trial preset/i);
  assert.equal(inheritedPricingDetailsReads, 0);

  const inheritedLegacyPricing = cloneEngine(current);
  const safeLegacyPricing = inheritedLegacyPricing.engine.pricing;
  delete inheritedLegacyPricing.engine.pricing;
  const legacyPricingPrototype = Object.create(Object.getPrototypeOf(inheritedLegacyPricing.engine));
  Object.defineProperty(legacyPricingPrototype, 'pricing', {
    enumerable: true,
    get() {
      inheritedLegacyPricingReads += 1;
      return safeLegacyPricing;
    },
  });
  Object.setPrototypeOf(inheritedLegacyPricing.engine, legacyPricingPrototype);
  assert.throws(() => assertTrialPresetSupported(inheritedLegacyPricing), /trial preset/i);
  assert.equal(inheritedLegacyPricingReads, 0);
});

test('validates exact modern and legacy addon rule schemas before owner calculation', async () => {
  const current = await getCurrentTrialEngine();

  const withModernAddons = (addons: unknown): AgentPublicGenerationEngine => {
    const candidate = cloneEngine(current);
    assert.ok(candidate.engine.pricingDetails);
    (candidate.engine.pricingDetails as { addons?: unknown }).addons = addons;
    return candidate;
  };
  const withLegacyAddons = (addons: unknown): AgentPublicGenerationEngine => {
    const candidate = cloneEngine(current);
    assert.ok(candidate.engine.pricingDetails);
    delete candidate.engine.pricingDetails.addons;
    assert.ok(candidate.engine.pricing);
    (candidate.engine.pricing as { addons?: unknown }).addons = addons;
    return candidate;
  };

  assert.doesNotThrow(() => assertTrialPresetSupported(withModernAddons({
    audio: {
      perSecondCents: 0,
      flatCents: 0,
      perSecondCentsByResolution: { '480p': 0, '720p': 0 },
    },
  })));
  assert.doesNotThrow(() => assertTrialPresetSupported(withLegacyAddons({
    audio: { perSecond: 0, flat: 0 },
  })));

  const invalidModernRules = [
    { audio: { perSecond: 0 } },
    { audio: { flatCents: 0, unexpected: true } },
  ];
  const invalidLegacyRules: unknown[] = [
    { audio: Object.assign(Object.create({ inherited: true }), { flat: 0 }) },
    { audio: { flatCents: 0 } },
    { audio: { flat: 0, unexpected: true } },
  ];
  const symbolLegacyRule = { flat: 0 };
  Object.defineProperty(symbolLegacyRule, Symbol('unexpected'), { enumerable: true, value: true });
  invalidLegacyRules.push({ audio: symbolLegacyRule });
  const accessorLegacyRule = {};
  Object.defineProperty(accessorLegacyRule, 'flat', {
    enumerable: true,
    get() {
      return 0;
    },
  });
  invalidLegacyRules.push({ audio: accessorLegacyRule });

  for (const addons of invalidModernRules) {
    assert.throws(() => assertTrialPresetSupported(withModernAddons(addons)), /trial preset/i);
  }
  for (const addons of invalidLegacyRules) {
    assert.throws(() => assertTrialPresetSupported(withLegacyAddons(addons)), /trial preset/i);
  }
});
