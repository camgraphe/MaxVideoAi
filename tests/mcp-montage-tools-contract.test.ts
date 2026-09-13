import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'owner', clientId: 'test-client', emailVerified: true, authMethod: 'oauth',
};
const firstId = `ma_${'1'.repeat(32)}`;
const secondId = `ma_${'2'.repeat(32)}`;

function services(calls: unknown[]): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async getModelDetails() { throw new Error('unused'); },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async prepareMontage(input, currentPrincipal) {
      calls.push({ input, principal: currentPrincipal });
      return {
        schemaVersion: 1, status: 'edit_plan', persisted: false, title: input.title,
        settings: input.settings,
        clips: input.clips.map((clip, index) => ({
          ...clip, clipId: `clip_${index + 1}`, label: `Clip ${index + 1}`, timelineStartFrame: index * 24,
        })),
        totalFrames: 48, totalSeconds: 2, orderingBasis: 'caller_supplied', nextAction: 'Review.',
      };
    },
  };
}

test('prepare_montage is disabled by default and callable only with its explicit gate', async (t) => {
  const calls: unknown[] = [];
  const disabled = createMaxVideoAiMcpServer(principal, services(calls), { paidGeneration: false, referenceUploads: false });
  const enabled = createMaxVideoAiMcpServer(principal, services(calls), { paidGeneration: false, referenceUploads: false, montagePreparation: true });
  const [dtc, dts] = InMemoryTransport.createLinkedPair();
  const [etc, ets] = InMemoryTransport.createLinkedPair();
  const dc = new Client({ name: 'disabled', version: '1' });
  const ec = new Client({ name: 'enabled', version: '1' });
  await disabled.connect(dts); await dc.connect(dtc);
  await enabled.connect(ets); await ec.connect(etc);
  t.after(async () => { await dc.close(); await ec.close(); await disabled.close(); await enabled.close(); });

  assert.equal((await dc.listTools()).tools.some((tool) => tool.name === 'prepare_montage'), false);
  assert.doesNotMatch(dc.getInstructions() ?? '', /prepare_montage/u);
  const tool = (await ec.listTools()).tools.find((candidate) => candidate.name === 'prepare_montage');
  assert.ok(tool);
  assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false });
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal((tool.inputSchema.properties?.settings as { additionalProperties?: unknown }).additionalProperties, false);
  const clips = tool.inputSchema.properties?.clips as { minItems?: number; maxItems?: number; items?: { additionalProperties?: unknown } };
  assert.equal(clips.minItems, 2); assert.equal(clips.maxItems, 12); assert.equal(clips.items?.additionalProperties, false);
  assert.match(ec.getInstructions() ?? '', /caller-supplied semantic ordering.*does not inspect video contents/is);

  const args = {
    title: 'Two shots',
    settings: { fps: 24, aspectRatio: '16:9', resolution: '1080p', audioMode: 'mute' },
    clips: [
      { assetId: firstId, sourceInFrame: 0, durationFrames: 24 },
      { assetId: secondId, sourceInFrame: 24, durationFrames: 24 },
    ],
  };
  const result = await ec.callTool({ name: 'prepare_montage', arguments: args });
  assert.equal(result.isError, undefined, JSON.stringify(result));
  assert.equal((result.structuredContent as { persisted?: unknown }).persisted, false);
  assert.deepEqual(calls, [{ input: args, principal }]);

  const invalid = await ec.callTool({ name: 'prepare_montage', arguments: { ...args, sourceUrl: 'https://secret.example/video.mp4' } });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, 1);
});

test('montage tool has no generation, export, database-write, or Studio destination integration', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('frontend/src/server/mcp/tools/prepare-montage.ts', 'utf8');
  assert.doesNotMatch(source, /createPrepareGeneration|submitReserved|timeline-exports|\bquery\(|studio\/workspace/iu);
});
