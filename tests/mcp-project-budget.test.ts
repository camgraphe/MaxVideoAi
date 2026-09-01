import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import {
  calculateAgentProjectBudget,
  type AgentProjectBudgetDependencies,
  type AgentProjectBudgetInput,
} from '../frontend/src/server/agent-api/project-budget';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { calculateProjectBudgetInputSchema } from '../frontend/src/server/mcp/tools/calculate-project-budget';
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';

const principal: AgentPrincipal = {
  userId: 'budget-user', clientId: 'codex-client', emailVerified: true, authMethod: 'oauth',
};

type VideoBudgetMode = 't2v' | 'i2v' | 'ref2v' | 'fl2v' | 'v2v' | 'r2v' | 'extend' | 'a2v';

function engine(id: string, modes: readonly VideoBudgetMode[], durations: readonly number[]): AgentPublicGenerationEngine {
  const inputFields: EngineInputField[] = [
    { id: 'prompt', type: 'text', label: 'Prompt', requiredInModes: [...modes] },
    { id: 'duration', type: 'enum', label: 'Duration', values: durations.map(String), modes: [...modes] },
    { id: 'resolution', type: 'enum', label: 'Resolution', values: ['720p', '2K'], modes: [...modes] },
    { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9', '9:16'], modes: [...modes] },
    { id: 'generate_audio', type: 'boolean', label: 'Audio', modes: [...modes] },
    { id: 'image_url', type: 'image', label: 'Source', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1 },
    { id: 'first_frame_url', type: 'image', label: 'First frame', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1 },
    { id: 'last_frame_url', type: 'image', label: 'Last frame', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1 },
    { id: 'reference_image_urls', type: 'image', label: 'References', modes: ['ref2v'], requiredInModes: ['ref2v'], minCount: 1, maxCount: 9 },
    { id: 'video_url', type: 'video', label: 'Source video', modes: ['v2v'], requiredInModes: ['v2v'], minCount: 1, maxCount: 1 },
    { id: 'video_urls', type: 'video', label: 'Reference videos', modes: ['r2v'], requiredInModes: ['r2v'], minCount: 1, maxCount: 3 },
    { id: 'extension_source_videos', type: 'video', label: 'Source clips', modes: ['extend'], requiredInModes: ['extend'], minCount: 1, maxCount: 3 },
    { id: 'audio_url', type: 'audio', label: 'Source audio', modes: ['a2v'], requiredInModes: ['a2v'], minCount: 1, maxCount: 1 },
  ];
  const caps: EngineCaps = {
    id, label: id, provider: 'test', status: 'live', latencyTier: 'standard', modes: [...modes],
    maxDurationSec: Math.max(...durations), resolutions: ['720p', '2K'], aspectRatios: ['16:9', '9:16'],
    fps: [24], audio: true, upscale4k: false, extend: false, motionControls: false, keyframes: false,
    params: {}, inputLimits: { promptMaxChars: 12_000 }, inputSchema: { required: inputFields, optional: [] },
    updatedAt: '2026-08-24T00:00:00.000Z', ttlSec: 600, availability: 'available',
  };
  const modeCaps = Object.fromEntries(modes.map((mode) => [mode, {
    modes: [mode], duration: { options: [...durations], default: durations[0] },
    resolution: ['720p', '2K'], aspectRatio: ['16:9', '9:16'], fps: [24], audioToggle: true,
  } satisfies EngineModeUiCaps]));
  return { engine: caps, surface: 'video', publicModes: [...modes], modeCaps };
}

const seedance = engine('seedance-2-5', ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'], [5, 10]);
const h3 = engine('minimax-h3', ['t2v', 'i2v', 'ref2v'], [5, 10, 15]);
const omni = engine('gemini-omni-flash', ['t2v', 'i2v', 'ref2v'], [5, 10]);

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing registry engine ${engineId}`);
  const publicModes = entry.modes
    .map((mode) => mode.mode)
    .filter((mode): mode is AgentPublicGenerationEngine['publicModes'][number] =>
      ['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend', 'a2v', 't2i', 'i2i'].includes(mode));
  return {
    engine: entry.engine,
    surface: entry.category === 'image' ? 'image' : 'video',
    publicModes,
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
}

function makeDeps(overrides: Partial<AgentProjectBudgetDependencies> = {}) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    listPublicEngines: async () => [seedance, h3, omni],
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    priceGeneration: async (request: { engineId: string }) => {
      calls.push(request as Record<string, unknown>);
      const priceCents = request.engineId === 'seedance-2-5' ? 120 : request.engineId === 'minimax-h3' ? 340 : 80;
      return { priceCents, currency: 'USD', membershipTier: 'member', pricingSnapshot: { totalCents: priceCents, currency: 'USD', membershipTier: 'member' } };
    },
    computeCatalogRevision: () => 'mcp-catalog-v2:test',
    ...overrides,
  } as AgentProjectBudgetDependencies & { calls: Array<Record<string, unknown>> };
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    purpose: 'Hero shot', engineId: 'seedance-2-5', mode: 't2v' as const,
    settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9' }, clipCount: 1, attemptsPerClip: 1,
    ...overrides,
  };
}

function input(proposals: AgentProjectBudgetInput['proposals']): AgentProjectBudgetInput { return { proposals }; }

async function assertError(work: Promise<unknown>, code: AgentApiError['code']): Promise<void> {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, code);
    return true;
  });
}

async function assertLineError(
  work: Promise<unknown>,
  code: AgentApiError['code'],
  location: { proposalIndex: number; lineIndex: number; field: string },
): Promise<void> {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.code, code);
    assert.deepEqual(error.nextAction, { type: 'edit_project_line', ...location });
    return true;
  });
}

test('prices a 60-second single-model video project as a named proposal', async () => {
  const deps = makeDeps();
  const result = await calculateAgentProjectBudget(input([{ name: 'Consistent product film', lines: [line({ clipCount: 6 })] }]), principal, deps);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0]?.name, 'Consistent product film');
  assert.equal(result.proposals[0]?.intendedOutputDurationSec, 60);
  assert.equal(result.proposals[0]?.total.amountCents, 720);
  assert.equal(Object.hasOwn(result, 'total'), false);
  assert.equal(Object.hasOwn(result, 'intendedOutputDurationSec'), false);
  assert.equal(result.currency, 'USD');
  assert.equal(result.pricingScope, 'connected_environment');
  assert.equal(result.quoteRequired, true);
  assert.equal(result.nextAction, 'discuss_and_refine');
  assert.equal(deps.calls.length, 1);
});

test('keeps alternative proposal totals separate instead of summing them as one project', async () => {
  const result = await calculateAgentProjectBudget(input([
    { name: 'Seedance direction', lines: [line({ clipCount: 6 })] },
    { name: 'Omni direction', lines: [line({ engineId: 'gemini-omni-flash', clipCount: 6 })] },
  ]), principal, makeDeps());

  assert.deepEqual(result.proposals.map((proposal) => ({
    name: proposal.name,
    totalCents: proposal.total.amountCents,
    durationSec: proposal.intendedOutputDurationSec,
  })), [
    { name: 'Seedance direction', totalCents: 720, durationSec: 60 },
    { name: 'Omni direction', totalCents: 480, durationSec: 60 },
  ]);
  assert.equal(Object.hasOwn(result, 'total'), false);
  assert.equal(Object.hasOwn(result, 'intendedOutputDurationSec'), false);
});

test('budgets real H3 and Seedance 2.5 i2v lines with source-derived framing', async () => {
  const candidates = [registryCapability('minimax-h3'), registryCapability('seedance-2-5')];
  const pricedSettings: Array<Record<string, unknown>> = [];
  const result = await calculateAgentProjectBudget(input([
    {
      name: 'H3 source framing',
      lines: [line({
        engineId: 'minimax-h3',
        mode: 'i2v',
        settings: { durationSec: 5, resolution: '2K' },
        referenceRoles: ['source'],
      })],
    },
    {
      name: 'Seedance source framing',
      lines: [line({
        engineId: 'seedance-2-5',
        mode: 'i2v',
        settings: { durationSec: 4, resolution: '480p' },
        referenceRoles: ['source'],
      })],
    },
  ]), principal, {
    listPublicEngines: async () => candidates,
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    computeCatalogRevision: () => 'mcp-catalog-v2:source-framing',
    priceGeneration: async (request) => {
      pricedSettings.push(request.settings);
      return {
        priceCents: 100,
        currency: 'USD',
        membershipTier: 'member',
        pricingSnapshot: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
  });

  assert.deepEqual(result.proposals.map((proposal) => proposal.total.amountCents), [100, 100]);
  assert.deepEqual(pricedSettings, [
    { durationSec: 5, resolution: '2K' },
    { durationSec: 4, resolution: '480p' },
  ]);
});

test('budgets source-video modes without inventing a ref2v media kind', async () => {
  const candidate = registryCapability('seedance-2-5');
  const pricedModes: string[] = [];
  const billingInputTypes: unknown[] = [];
  const result = await calculateAgentProjectBudget(input([{
    name: 'Source video workflows',
    lines: [
      line({
        purpose: 'Edit source',
        mode: 'v2v',
        settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
        referenceRoles: ['source'],
      }),
      line({
        purpose: 'Extend clips',
        mode: 'extend',
        settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
        referenceRoles: ['source', 'source', 'source'],
      }),
      line({
        purpose: 'Unspecified reference media',
        mode: 'ref2v',
        settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
        referenceRoles: ['reference'],
      }),
    ],
  }]), principal, {
    listPublicEngines: async () => [candidate],
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    computeCatalogRevision: () => 'mcp-catalog-v2:full-video-modes',
    priceGeneration: async (request, membershipTier) => {
      pricedModes.push(request.mode);
      const pricing = await priceCanonicalGeneration(request, membershipTier);
      billingInputTypes.push(
        (pricing.pricingSnapshot.meta as Record<string, unknown>).byteplus_billing_input_type,
      );
      return pricing;
    },
  });

  assert.deepEqual(pricedModes, ['v2v', 'extend', 'ref2v']);
  assert.deepEqual(billingInputTypes, ['video_input', 'video_input', 'no_video_input']);
  assert.deepEqual(
    result.proposals[0]?.lines.map((budgetLine) => budgetLine.mode),
    ['v2v', 'extend', 'ref2v'],
  );
  assert.deepEqual(result.proposals[0]?.lines.map((budgetLine) => budgetLine.referenceCount), [1, 3, 1]);
});

test('budgets first/last-frame and ordered reference-video workflows exposed by the MCP', async () => {
  const candidates = [registryCapability('veo-3-1'), registryCapability('wan-2-6')];
  const value = input([
    {
      name: 'First and last frame plan',
      lines: [line({
        engineId: 'veo-3-1',
        mode: 'fl2v',
        settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: true },
        referenceRoles: ['first_frame', 'last_frame'],
      })],
    },
    {
      name: 'Reference video plan',
      lines: [line({
        engineId: 'wan-2-6',
        mode: 'r2v',
        settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
        referenceRoles: ['reference', 'reference'],
      })],
    },
  ]);

  assert.equal(calculateProjectBudgetInputSchema.safeParse(value).success, true);
  const pricedModes: string[] = [];
  const result = await calculateAgentProjectBudget(value, principal, {
    listPublicEngines: async () => candidates,
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    computeCatalogRevision: () => 'mcp-catalog-v2:framed-video-budget',
    priceGeneration: async (request) => {
      pricedModes.push(request.mode);
      return {
        priceCents: 100,
        currency: 'USD',
        membershipTier: 'member',
        pricingSnapshot: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
      };
    },
  });

  assert.deepEqual(pricedModes, ['fl2v', 'r2v']);
  assert.deepEqual(result.proposals.map((proposal) => proposal.total.amountCents), [100, 100]);
});

test('returns an exact safe line location when a project capability is invalid', async () => {
  const proposals = [
    { name: 'Valid alternative', lines: [line()] },
    {
      name: 'Alternative to edit',
      lines: [
        line({ purpose: 'Valid opening' }),
        line({ purpose: 'Invalid hero', settings: { durationSec: 7, resolution: '720p', aspectRatio: '16:9' } }),
      ],
    },
  ];
  await assertLineError(
    calculateAgentProjectBudget(input(proposals), principal, makeDeps()),
    'PARAMETER_INVALID',
    { proposalIndex: 1, lineIndex: 1, field: 'durationSec' },
  );
  await assertLineError(
    calculateAgentProjectBudget(input([{
      name: 'Reference line',
      lines: [line({ mode: 'i2v', referenceRoles: [] })],
    }]), principal, makeDeps()),
    'REFERENCE_REQUIRED',
    { proposalIndex: 0, lineIndex: 0, field: 'references' },
  );
  await assertLineError(
    calculateAgentProjectBudget(input([{
      name: 'Resolution line',
      lines: [line({ settings: { durationSec: 10, resolution: '4K', aspectRatio: '16:9' } })],
    }]), principal, makeDeps()),
    'PARAMETER_INVALID',
    { proposalIndex: 0, lineIndex: 0, field: 'resolution' },
  );
  await assertLineError(
    calculateAgentProjectBudget(input([{
      name: 'Missing framing line',
      lines: [line({ settings: { durationSec: 10, resolution: '720p' } })],
    }]), principal, makeDeps()),
    'PARAMETER_INVALID',
    { proposalIndex: 0, lineIndex: 0, field: 'aspectRatio' },
  );
  await assertLineError(
    calculateAgentProjectBudget(input([{
      name: 'Audio line',
      lines: [line({ settings: { durationSec: 10, resolution: '720p', aspectRatio: '16:9', audio: 'yes' } })],
    }]), principal, makeDeps()),
    'PARAMETER_INVALID',
    { proposalIndex: 0, lineIndex: 0, field: 'audio' },
  );
});

test('preserves named mixed-model proposals, line order, and creative attempt allowances', async () => {
  const deps = makeDeps();
  const result = await calculateAgentProjectBudget(input([{
    name: 'Mixed production plan',
    lines: [
      line({ purpose: 'Opening', engineId: 'seedance-2-5', clipCount: 2, attemptsPerClip: 3 }),
      line({ purpose: 'Reference hero', engineId: 'minimax-h3', mode: 'ref2v', settings: { durationSec: 10, resolution: '2K', aspectRatio: '16:9' }, referenceRoles: ['reference', 'reference', 'reference', 'reference', 'reference', 'reference'] }),
      line({ purpose: 'Cutaway', engineId: 'gemini-omni-flash', settings: { durationSec: 5, resolution: '720p', aspectRatio: '9:16', audio: true } }),
    ],
  }]), principal, deps);
  const proposal = result.proposals[0]!;
  assert.deepEqual(proposal.lines.map((item) => item.purpose), ['Opening', 'Reference hero', 'Cutaway']);
  assert.equal(proposal.lines[0]?.baseProduction.amountCents, 240);
  assert.equal(proposal.lines[0]?.creativeAttempts.amountCents, 480);
  assert.equal(proposal.lines[0]?.total.amountCents, 720);
  assert.equal(proposal.lines[1]?.total.amountCents, 340);
  assert.equal(proposal.lines[2]?.total.amountCents, 80);
  assert.equal(proposal.total.amountCents, 1_140);
  assert.equal((deps.calls[1]?.references as unknown[]).length, 6);
  assert.equal(deps.calls[1]?.prompt, 'Project pricing scenario');
});

test('project budgets accept the full canonical reference envelope when the model does', async () => {
  const candidate = registryCapability('seedance-2-5');
  const references = Array.from({ length: 17 }, () => 'reference' as const);
  const value = input([{
    name: 'Reference-rich Seedance plan',
    lines: [line({
      engineId: 'seedance-2-5',
      mode: 'ref2v',
      settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: true },
      referenceRoles: references,
    })],
  }]);
  assert.equal(calculateProjectBudgetInputSchema.safeParse(value).success, true);

  const result = await calculateAgentProjectBudget(value, principal, {
    listPublicEngines: async () => [candidate],
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    priceGeneration: async () => ({
      priceCents: 100,
      currency: 'USD',
      membershipTier: 'member',
      pricingSnapshot: { totalCents: 100, currency: 'USD', membershipTier: 'member' },
    }),
    computeCatalogRevision: () => 'mcp-catalog-v2:reference-envelope',
  });
  assert.equal(result.proposals[0]?.lines[0]?.referenceCount, 17);
});

test('project budget prices LTX A2V from the explicitly declared source-audio duration', async () => {
  const candidate = registryCapability('ltx-2-5-fast');
  let capturedExtraInputValues: Record<string, unknown> | undefined;
  const value = input([{
    name: 'LTX audio-led plan',
    lines: [line({
      engineId: 'ltx-2-5-fast',
      mode: 'a2v',
      settings: { durationSec: 9, resolution: '1080p', aspectRatio: 'auto' },
      referenceRoles: ['source'],
    })],
  }]);

  const result = await calculateAgentProjectBudget(value, principal, {
    listPublicEngines: async () => [candidate],
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    computeCatalogRevision: () => 'mcp-catalog-v2:ltx-a2v',
    priceGeneration: (request, membershipTier) => priceCanonicalGeneration(
      request,
      membershipTier,
      {
        computeVideoPreflight: async (payload) => {
          capturedExtraInputValues = payload.extraInputValues;
          return {
            ok: true,
            total: 153,
            currency: 'USD',
            pricing: { totalCents: 153, currency: 'USD', membershipTier: 'member' },
          };
        },
        estimateImage: async () => { throw new Error('unused'); },
      },
    ),
  });

  assert.equal(capturedExtraInputValues?.inputAudioDurationSec, 9);
  assert.equal(result.proposals[0]?.lines[0]?.unitPrice.amountCents, 153);
});

test('fails closed for invalid catalog, capability, reference, quantity, pricing, and overflow conditions', async () => {
  await assertError(calculateAgentProjectBudget(input([{ name: 'Missing', lines: [line({ engineId: 'hidden-model' })] }]), principal, makeDeps()), 'ENGINE_UNAVAILABLE');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Mode', lines: [line({ mode: 'i2v', referenceRoles: [] })] }]), principal, makeDeps()), 'REFERENCE_REQUIRED');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Invalid reference', lines: [line({ mode: 't2v', referenceRoles: ['reference'] })] }]), principal, makeDeps()), 'REFERENCE_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Invalid setting', lines: [line({ settings: { durationSec: 7, resolution: '720p', aspectRatio: '16:9' } })] }]), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Count', lines: [line({ clipCount: 0 })] }]), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Unsafe count', lines: [line({ clipCount: Number.MAX_SAFE_INTEGER + 1 })] }]), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Attempts below range', lines: [line({ attemptsPerClip: 0 })] }]), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input(Array.from({ length: 5 }, (_, index) => ({ name: `P${index}`, lines: [line()] }))), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Lines', lines: Array.from({ length: 13 }, () => line()) }]), principal, makeDeps()), 'PARAMETER_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'References', lines: [line({ mode: 'ref2v', referenceRoles: Array.from({ length: 51 }, () => 'reference') })] }]), principal, makeDeps()), 'REFERENCE_INVALID');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Attempts', lines: [line({ clipCount: 100, attemptsPerClip: 10 })] }]), principal, makeDeps()), 'PARAMETER_INVALID');
  let currencyCalls = 0;
  await assertError(calculateAgentProjectBudget(input([{ name: 'Currency', lines: [line(), line({ engineId: 'minimax-h3', settings: { durationSec: 10, resolution: '2K', aspectRatio: '16:9' } })] }]), principal, makeDeps({ priceGeneration: async () => {
    currencyCalls += 1;
    const currency = currencyCalls === 1 ? 'USD' : 'EUR';
    return { priceCents: 1, currency, membershipTier: 'member', pricingSnapshot: { totalCents: 1, currency, membershipTier: 'member' } };
  } })), 'INTERNAL_ERROR');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Mismatch', lines: [line()] }]), principal, makeDeps({ priceGeneration: async () => ({ priceCents: 2, currency: 'USD', membershipTier: 'member', pricingSnapshot: { totalCents: 1, currency: 'USD', membershipTier: 'member' } }) })), 'INTERNAL_ERROR');
  await assertError(calculateAgentProjectBudget(input([{ name: 'Overflow', lines: [line({ clipCount: 2 })] }]), principal, makeDeps({ priceGeneration: async () => ({ priceCents: Number.MAX_SAFE_INTEGER, currency: 'USD', membershipTier: 'member', pricingSnapshot: { totalCents: Number.MAX_SAFE_INTEGER, currency: 'USD', membershipTier: 'member' } }) })), 'INTERNAL_ERROR');
});
