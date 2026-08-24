import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  calculateAgentProjectBudget,
  type AgentProjectBudgetDependencies,
  type AgentProjectBudgetInput,
} from '../frontend/src/server/agent-api/project-budget';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';

const principal: AgentPrincipal = {
  userId: 'budget-user', clientId: 'codex-client', emailVerified: true, authMethod: 'oauth',
};

function engine(id: string, modes: readonly ('t2v' | 'i2v' | 'ref2v')[], durations: readonly number[]): AgentPublicGenerationEngine {
  const inputFields: EngineInputField[] = [
    { id: 'prompt', type: 'text', label: 'Prompt', requiredInModes: [...modes] },
    { id: 'duration', type: 'enum', label: 'Duration', values: durations.map(String), modes: [...modes] },
    { id: 'resolution', type: 'enum', label: 'Resolution', values: ['720p', '2K'], modes: [...modes] },
    { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9', '9:16'], modes: [...modes] },
    { id: 'generate_audio', type: 'boolean', label: 'Audio', modes: [...modes] },
    { id: 'image_url', type: 'image', label: 'Source', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1 },
    { id: 'reference_image_urls', type: 'image', label: 'References', modes: ['ref2v'], requiredInModes: ['ref2v'], minCount: 1, maxCount: 9 },
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

const seedance = engine('seedance-2-5', ['t2v', 'i2v', 'ref2v'], [5, 10]);
const h3 = engine('minimax-h3', ['t2v', 'i2v', 'ref2v'], [5, 10, 15]);
const omni = engine('gemini-omni-flash', ['t2v', 'i2v', 'ref2v'], [5, 10]);

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

test('prices a 60-second single-model video project as a named proposal', async () => {
  const deps = makeDeps();
  const result = await calculateAgentProjectBudget(input([{ name: 'Consistent product film', lines: [line({ clipCount: 6 })] }]), principal, deps);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0]?.name, 'Consistent product film');
  assert.equal(result.proposals[0]?.intendedOutputDurationSec, 60);
  assert.equal(result.intendedOutputDurationSec, 60);
  assert.equal(result.proposals[0]?.total.amountCents, 720);
  assert.equal(result.currency, 'USD');
  assert.equal(result.quoteRequired, true);
  assert.equal(result.nextAction, 'discuss_and_refine');
  assert.equal(deps.calls.length, 1);
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
  await assertError(calculateAgentProjectBudget(input([{ name: 'References', lines: [line({ mode: 'ref2v', referenceRoles: Array.from({ length: 17 }, () => 'reference') })] }]), principal, makeDeps()), 'REFERENCE_INVALID');
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
