import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServerOptions,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'instruction-user',
  clientId: 'instruction-client',
  emailVerified: true,
  authMethod: 'oauth',
};

const services = {
  async getAccountStatus() {
    throw new Error('unused');
  },
  async listModels() {
    return [];
  },
  async recommendModels() {
    return { recommendations: [], nextAction: 'clarify_requirements' as const };
  },
  async listMedia() {
    return { items: [], nextCursor: null, hasMore: false };
  },
  async prepareGeneration() {
    throw new Error('unused');
  },
  async confirmGeneration() {
    throw new Error('unused');
  },
  async getGenerationStatus() {
    throw new Error('unused');
  },
  async listRecentGenerations() {
    throw new Error('unused');
  },
  async createTopupLink() {
    throw new Error('unused');
  },
} satisfies MaxVideoAiMcpServices;

async function getInstructions(options: MaxVideoAiMcpServerOptions): Promise<string> {
  const server = createMaxVideoAiMcpServer(principal, services, options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'instruction-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    return client.getInstructions() ?? '';
  } finally {
    await client.close();
    await server.close();
  }
}

test('instructions never advertise paid generation when its gate is closed', async () => {
  const instructions = await getInstructions({ paidGeneration: false, referenceUploads: false });

  assert.match(instructions, /generation is not available/i);
  assert.doesNotMatch(instructions, /use prepare_generation/i);
  assert.doesNotMatch(instructions, /use list_media/i);
});

test('instructions describe the exact quote and confirmation flow when paid generation is enabled', async () => {
  const instructions = await getInstructions({ paidGeneration: true, referenceUploads: false });

  assert.doesNotMatch(instructions, /generation is not available/i);
  assert.match(instructions, /use prepare_generation/i);
  assert.match(instructions, /exact price/i);
  assert.match(instructions, /explicit user confirmation/i);
  assert.match(instructions, /use confirm_generation/i);
  assert.match(instructions, /do not claim completion/i);
});

test('instructions advertise only existing private reference selection when its gate is enabled', async () => {
  const instructions = await getInstructions({ paidGeneration: false, referenceUploads: true });

  assert.match(instructions, /use list_media/i);
  assert.match(instructions, /existing private.*image/i);
  assert.match(instructions, /do not upload images with list_media/i);
});
