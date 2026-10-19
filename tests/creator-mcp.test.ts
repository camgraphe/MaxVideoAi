import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';
import { buildMaxVideoAiMcpInstructions } from '../frontend/src/server/mcp/instructions';
import { prepareCreatorToolInputSchema } from '../frontend/src/server/mcp/tools/creator-tools';

const principal = { userId: 'owner', clientId: 'host', emailVerified: true, authMethod: 'oauth' } as const;
const calls: unknown[] = [];
const unused = async () => { throw new Error('Unexpected service call'); };
const services: MaxVideoAiMcpServices = {
  getAccountStatus: unused, listModels: unused, getModelDetails: unused, recommendModels: unused,
  prepareGeneration: unused, confirmGeneration: unused, getGenerationStatus: unused, listRecentGenerations: unused,
  createTopupLink: unused, createReferenceUploadLink: unused, importReferenceFiles: unused, listMedia: unused,
  readStudioTimeline: unused, editStudioTimeline: unused,
  creatorTools: {
    list: async () => ({ tools: [] }), prepare: unused, status: unused, readDocument: unused,
    editDocument: unused, prepareExport: unused, prepareStudio: unused, exportText: unused,
    confirm: async (input, actor) => { calls.push({ input, actor }); return { operationId: input.operationId, status: 'running', retry: { afterSeconds: 5 } }; },
  },
};
async function clientFor(options: { paidGeneration: boolean; referenceUploads: boolean; creatorTools: boolean; studioTimelineEditing?: boolean }) {
  const server = createMaxVideoAiMcpServer(principal, services, { ...options, montagePreparation: false, audioGeneration: false,
    studioMontageCreation: false, studioTimelineEditing: options.studioTimelineEditing ?? false, studioExports: false });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'creator-test', version: '1' });
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
test('creator MCP discovery requires its own paid/reference gates and keeps metadata bounded', async () => {
  for (const [paidGeneration, referenceUploads, creatorTools] of [[true, true, false], [false, true, true], [true, false, true], [true, true, true]]) {
    const connection = await clientFor({ paidGeneration, referenceUploads, creatorTools });
    try {
      const tools = (await connection.client.listTools()).tools;
      const exposed = tools.filter(tool => /creator|subtitle/.test(tool.name));
      assert.equal(exposed.length, paidGeneration && referenceUploads && creatorTools ? 8 : 0);
      for (const tool of exposed) {
        assert.equal(tool.inputSchema.type, 'object');
        assert.ok(Buffer.byteLength(tool.description ?? '') <= 2000);
        assert.equal(typeof tool.annotations?.destructiveHint, 'boolean');
      }
    } finally { await connection.close(); }
  }
});
test('Studio mix quotation follows timeline access without enabling Studio MP4 exports', async () => {
  const connection = await clientFor({ paidGeneration: true, referenceUploads: true, creatorTools: true, studioTimelineEditing: true });
  try {
    const names = (await connection.client.listTools()).tools.map(tool => tool.name);
    assert.ok(names.includes('prepare_studio_subtitles'));
    assert.ok(names.includes('get_studio_timeline'));
    assert.equal(names.includes('confirm_studio_export'), false);
  } finally { await connection.close(); }
});
test('creator confirmation requires true, retains actor scope and complete compact result', async () => {
  const connection = await clientFor({ paidGeneration: true, referenceUploads: true, creatorTools: true });
  try {
    const input = { toolId: 'lip-sync', operationId: '123e4567-e89b-42d3-a456-426614174000', confirmed: true };
    const before = calls.length;
    const invalid = await connection.client.callTool({ name: 'confirm_creator_tool', arguments: { ...input, confirmed: false } });
    assert.equal(invalid.isError, true); assert.equal(calls.length, before);
    const result = await connection.client.callTool({ name: 'confirm_creator_tool', arguments: input });
    assert.deepEqual(calls.at(-1), { input, actor: principal });
    assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), result.structuredContent);
  } finally { await connection.close(); }
});
test('creator transport rejects caller URLs and keeps explicit fractional source segments', () => {
  const request = { version: 1, toolId: 'product-video-editor', settings: {}, inputs: [{ role: 'source',
    source: { type: 'asset', assetId: 'ma_11111111111111111111111111111111', kind: 'video' }, segment: { startSec: 0.4, endSec: 5.4 } }] };
  assert.equal(prepareCreatorToolInputSchema.safeParse({ request }).success, true);
  assert.equal(prepareCreatorToolInputSchema.safeParse({ request: { ...request, inputs: [{ role: 'source', source: { type: 'https', url: 'https://example.com/video.mp4', kind: 'video' } }] } }).success, false);
});
test('all creator and existing instruction gates fit the host window', t => {
  let largest = 0;
  for (let mask = 0; mask < 256; mask++) {
    const instructions = buildMaxVideoAiMcpInstructions({ paidGeneration: !!(mask & 1), referenceUploads: !!(mask & 2),
      audioGeneration: !!(mask & 4), montagePreparation: !!(mask & 8), studioMontageCreation: !!(mask & 16),
      studioTimelineEditing: !!(mask & 32), studioExports: !!(mask & 64), creatorTools: !!(mask & 128) });
    assert.ok(Buffer.byteLength(instructions) <= 2000, `${mask}: ${Buffer.byteLength(instructions)} bytes`);
    largest = Math.max(largest, Buffer.byteLength(instructions));
  }
  t.diagnostic(`Largest instructions across 256 gate combinations: ${largest} bytes.`);
});
