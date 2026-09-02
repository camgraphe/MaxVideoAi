import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { listAgentModels, listPublicAgentGenerationEngines, type AgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import { recommendAgentModels } from '../frontend/src/server/agent-api/model-recommendations';
import { resolveMcpPrelaunchModelAccess } from '../frontend/src/server/mcp/provider-canary-access';
import { calculateAgentProjectBudget } from '../frontend/src/server/agent-api/project-budget';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';

const P0 = ['wan-3', 'wan-3-prime', 'ltx-2-5-fast', 'ltx-2-5-pro', 'grok-imagine-video-1-5', 'flux-3', 'flux-3-draft'] as const;
const expectedModes = new Map<string, readonly string[]>([
  ['wan-3', ['t2v', 'i2v', 'ref2v']], ['wan-3-prime', ['t2v', 'i2v', 'ref2v']],
  ['ltx-2-5-fast', ['t2v', 'i2v', 'a2v']], ['ltx-2-5-pro', ['t2v', 'i2v', 'a2v']],
  ['grok-imagine-video-1-5', ['t2v', 'i2v', 'ref2v']],
  ['flux-3', ['t2v', 'i2v', 'fl2v', 'extend']], ['flux-3-draft', ['t2v', 'i2v', 'fl2v', 'extend']],
]);
const entries = listFalEngines();
const byId = new Map(entries.map((entry) => [entry.id, entry.engine]));
const deps: AgentModelCatalogDeps = {
  async listEngines() { return entries.filter((entry) => getRuntimeModelById(entry.id)?.publication.app.published).map((entry) => entry.engine); },
  async getEngineIncludingHidden(id) { return byId.get(id); },
  surfaceByEngineId(id) { const entry = entries.find((candidate) => candidate.id === id); return entry?.category === 'image' ? 'image' : entry ? 'video' : null; },
  isEngineExecutable: () => true,
  isModeExecutable: () => true,
};
test('default discovery is current+published while exact legacy identities preserve lifecycle and canonical successor slugs', async () => {
  const listed = await listAgentModels({}, deps);
  assert.ok(listed.length > 0);
  assert.ok(listed.every((model) => model.lifecycle === 'current' && model.recommendedByDefault));
  assert.equal(listed.some((model) => ['ltx-2-3', 'ltx-2'].includes(model.id as never)), false);
  assert.deepEqual(listed.filter((model) => P0.includes(model.id as never)).map((model) => model.id).sort(), [...P0].sort());
  const [legacy] = await listAgentModels({ id: 'ltx-2-3' }, deps);
  assert.equal(legacy?.lifecycle, 'legacy');
  assert.equal(legacy?.recommendedByDefault, false);
  assert.deepEqual(legacy?.successor, { id: 'ltx-2-5-pro', slug: 'ltx-2-5-pro' });
  const legacyDetails = await getAgentModelDetails('ltx-2-3', deps);
  assert.equal(legacyDetails.links.model, 'https://maxvideoai.com/models/ltx-2-3-pro');
  const deep = await getAgentModelDetails('ltx-2', deps);
  assert.equal(deep.id, 'ltx-2');
  assert.equal(deep.lifecycle, 'deep_legacy');
  assert.equal(deep.generationEnabled, false);
  assert.deepEqual(deep.successor, { id: 'ltx-2-5-pro', slug: 'ltx-2-5-pro' });
  const executable = await listPublicAgentGenerationEngines(deps);
  assert.equal(executable.some((entry) => entry.engine.id === 'ltx-2-3'), true);
  assert.equal(executable.some((entry) => entry.engine.id === 'ltx-2'), false);
  assert.equal((await recommendAgentModels({ id: 'ltx-2-3' }, deps)).recommendations.length, 0);
});

test('published P0 models enumerate normally and no longer require staging canary access', async () => {
  assert.equal((await listAgentModels({}, deps)).filter((model) => P0.includes(model.id as never)).length, P0.length);
  const principal = { userId: 'canary-user', clientId: 'canary-client', emailVerified: true, authMethod: 'oauth' as const };
  const env = { NODE_ENV: 'production', MCP_STAGING_OPERATIONAL_ENABLED: 'true', MCP_STAGING_CANARY_ACCOUNT_IDS: principal.userId, MCP_STAGING_CANARY_CLIENT_IDS: principal.clientId } as NodeJS.ProcessEnv;
  const resolved = resolveMcpPrelaunchModelAccess(principal, 'https://maxvideoai-mcp-staging.vercel.app/account', env);
  assert.equal(resolved, null);
  assert.equal(resolveMcpPrelaunchModelAccess({ ...principal, clientId: 'wrong' }, 'https://maxvideoai-mcp-staging.vercel.app', env), null);
  assert.equal(resolveMcpPrelaunchModelAccess(principal, 'https://maxvideoai.com', env), null);
  const details = await getAgentModelDetails(P0[0], deps);
  assert.equal(details.prelaunch, false);
  assert.equal(details.links.model, 'https://maxvideoai.com/models/wan-3');
  assert.equal(details.links.examples, null);
});

test('all 23 P0 modes expose numeric duration choices from canonical engine schemas', async () => {
  let modes = 0;
  for (const id of P0) {
    const details = await getAgentModelDetails(id, deps);
    assert.deepEqual(details.modes.map((mode) => mode.mode), expectedModes.get(id), id);
    for (const mode of details.modes) {
      modes += 1;
      assert.ok(mode.duration === null || mode.duration.options === null || mode.duration.options.every(Number.isFinite), `${id}:${mode.mode}`);
    }
  }
  assert.equal(modes, 23);
  assert.deepEqual((await listPublicAgentGenerationEngines(deps)).filter((entry) => P0.includes(entry.engine.id as never)).map((entry) => entry.engine.id).sort(), [...P0].sort());
});

test('deep-legacy and retired spending selection fail before canonical pricing is called', async () => {
  for (const engineId of ['ltx-2', 'retired-video-fixture']) {
    let pricingCalls = 0;
    await assert.rejects(calculateAgentProjectBudget({ proposals: [{
      name: 'Deprecated identity',
      lines: [{
        purpose: 'Migration check', engineId, mode: 't2v',
        settings: { durationSec: 6, resolution: '1080p', aspectRatio: '16:9' },
        clipCount: 1, attemptsPerClip: 1,
      }],
    }] }, {
      userId: 'public-user', clientId: 'public-client', emailVerified: true, authMethod: 'oauth',
    }, {
      listPublicEngines: () => listPublicAgentGenerationEngines(deps),
      getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
      async priceGeneration() { pricingCalls += 1; throw new Error('must not price'); },
      computeCatalogRevision: () => 'lifecycle-test',
    }), (error: unknown) => error instanceof AgentApiError && error.code === 'ENGINE_UNAVAILABLE');
    assert.equal(pricingCalls, 0, engineId);
  }
});

test('the P0 prelaunch canary closes after atomic publication', () => {
  const principal = { userId: 'canary-user', clientId: 'canary-client', emailVerified: true, authMethod: 'oauth' as const };
  const env = { NODE_ENV: 'production', MCP_STAGING_OPERATIONAL_ENABLED: 'true', MCP_STAGING_CANARY_ACCOUNT_IDS: principal.userId, MCP_STAGING_CANARY_CLIENT_IDS: principal.clientId } as NodeJS.ProcessEnv;
  const accountUrl = 'https://maxvideoai-mcp-staging.vercel.app';
  const current = resolveMcpPrelaunchModelAccess(principal, accountUrl, env);
  assert.equal(current, null);
  assert.ok(P0.every((id) => {
    const runtime = getRuntimeModelById(id);
    return runtime?.lifecycle === 'current' && runtime.publication.app.published === true;
  }));
});
