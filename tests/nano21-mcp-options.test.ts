import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerPrepareGenerationTool } from '../frontend/src/server/mcp/tools/prepare-generation';
import { registerCompareGenerationPricesTool } from '../frontend/src/server/mcp/tools/compare-generation-prices';
import type { MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest, GenerationNormalizationError } from '../frontend/src/server/agent-api/generation-normalization';
import { validateGenerationPricingCapabilities } from '../frontend/src/server/agent-api/generation-pricing-read';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { compareGenerationPrices } from '../frontend/src/server/agent-api/generation-price-comparison';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildGoogleVertexImagePayload } from '../frontend/src/server/images/google-vertex-image-payload';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';

const principal = { authMethod: 'oauth' as const, userId: 'offline-owner', clientId: 'offline-client', emailVerified: true };
const membership = { tier: 'member' as const, source: 'app_receipts_rolling_30d' as const, spent30Cents: 0, thresholdCents: 0, discountPercent: 0 };
const entry = getFalEngineById('nano-banana-2-1')!;
function candidate(id: string): AgentPublicGenerationEngine {
  const item = id === entry.id ? entry : getFalEngineById(id)!;
  return { engine: item.engine, surface: 'image', publicModes: item.engine.modes, modeCaps: Object.fromEntries(item.modes.map(mode => [mode.mode, mode.ui])) };
}

test('registered MCP preparation and comparison transport exact Nano caps/system through canonical pricing and native payload', async () => {
  const payloads: ReturnType<typeof buildGoogleVertexImagePayload>[] = [];
  const priced = async (request: CanonicalGenerationRequest) => priceCanonicalGeneration(request, 'member', {
    computeVideoPreflight: async () => { throw new Error('No video pricing'); },
    estimateImage: async input => {
      payloads.push(buildGoogleVertexImagePayload({ ...input, prompt: request.prompt, modelId: 'gemini-nano-banana-2.1', imageSize: input.resolution }));
      return { pricing: { totalCents: 913, currency: 'USD', membershipTier: 'member' }, normalized: {} } as never;
    },
  });
  let calls = 0;
  const services = {
    prepareGeneration: async (input: unknown) => {
      calls++;
      let request: CanonicalGenerationRequest;
      try { request = normalizeGenerationRequest(input); } catch (error) {
        if (error instanceof GenerationNormalizationError) throw new AgentApiError('PARAMETER_INVALID', 'Unsupported canonical settings.');
        throw error;
      }
      validateGenerationPricingCapabilities(request, candidate(request.engineId));
      const price = await priced(request);
      return { request, hash: hashCanonicalGenerationRequest(request), price };
    },
    compareGenerationPrices: async (input: Parameters<typeof compareGenerationPrices>[0]) => {
      calls++;
      return compareGenerationPrices(input, principal, {
        listPublicEngines: async () => [candidate(entry.id)],
        resolveMembershipPricing: async () => membership,
        resolveRequestExecutability: () => ({ executable: true, reason: 'available' }),
        priceGeneration: priced,
      });
    },
  } as unknown as MaxVideoAiMcpServices;
  const server = new McpServer({ name: 'nano-options-offline', version: '1' });
  registerPrepareGenerationTool(server, principal, services);
  registerCompareGenerationPricesTool(server, principal, services);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'nano-options-offline', version: '1' });
  await client.connect(clientTransport);
  try {
    for (const maxOutputTokens of [4096, 32768]) {
      const settings = { resolution: '2k', aspectRatio: '1:1', thinkingLevel: 'high', maxOutputTokens, systemInstruction: 'Preserve exact subject geometry.' };
      const input = { surface: 'image', mode: 't2i', prompt: 'A still.', settings };
      const prepared = await client.callTool({ name: 'prepare_generation', arguments: { ...input, engineId: entry.id } });
      assert.notEqual(prepared.isError, true, JSON.stringify(prepared.content));
      const normalized = normalizeGenerationRequest({ ...input, engineId: entry.id });
      const received = prepared.structuredContent as unknown as { request: CanonicalGenerationRequest; hash: string };
      assert.deepEqual(received.request.settings, normalized.settings);
      assert.equal(received.hash, hashCanonicalGenerationRequest(normalized));
      const compared = await client.callTool({ name: 'compare_generation_prices', arguments: { ...input, candidateModelIds: [entry.id], baselineModelId: entry.id, baselineSettings: settings } });
      assert.notEqual(compared.isError, true, JSON.stringify(compared.content));
      const result = compared.structuredContent as unknown as Awaited<ReturnType<typeof compareGenerationPrices>>;
      assert.equal(result.options[0].settings.maxOutputTokens, maxOutputTokens);
      assert.equal(result.options[0].settings.systemInstruction, settings.systemInstruction);
      assert.equal(result.baseline!.settings.maxOutputTokens, maxOutputTokens);
      const emitted = payloads.splice(0);
      assert.equal(emitted.length, 3, 'prepare, comparison and baseline all use real canonical image pricing');
      for (const payload of emitted) {
        assert.equal(payload.generationConfig.maxOutputTokens, maxOutputTokens);
        assert.equal(payload.systemInstruction?.parts[0].text, settings.systemInstruction);
      }
    }
    for (const name of ['prepare_generation', 'compare_generation_prices']) {
      for (const settings of [{ maxOutputTokens: 0 }, { maxOutputTokens: 32769 }, { maxOutputTokens: 1.5 }, { maxOutputTokens: '4096' }, { systemInstruction: 'x'.repeat(4097) }, { unknown: true }]) {
        const before = calls;
        const refused = await client.callTool({ name, arguments: { surface: 'image', mode: 't2i', prompt: 'A still.', ...(name === 'prepare_generation' ? { engineId: entry.id } : { candidateModelIds: [entry.id] }), settings } });
        assert.equal(refused.isError, true);
        assert.equal(calls, before, 'invalid outer inputs never reach canonical service');
      }
    }
    for (const settings of [{ maxOutputTokens: 4096, systemInstruction: 'Do not add an unsupported older-model control.' }]) {
      const engineId = 'nano-banana-2';
      const refused = await client.callTool({ name: 'prepare_generation', arguments: { surface: 'image', mode: 't2i', prompt: 'A still.', engineId, settings } });
      assert.equal(refused.isError, true);
    }
    assert.equal(getFalEngineById(entry.id)?.surfaces.app.enabled,true,'approved Nano21 is ordinarily discoverable');
    const searched=await client.callTool({name:'prepare_generation',arguments:{surface:'image',mode:'t2i',prompt:'A still.',engineId:entry.id,settings:{enableWebSearch:true}}});
    assert.notEqual(searched.isError,true,'native search is covered by the fixed-price admission');
  } finally { await client.close(); await server.close(); }
});
