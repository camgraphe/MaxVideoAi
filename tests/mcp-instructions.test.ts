import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMaxVideoAiMcpInstructions } from '../frontend/src/server/mcp/instructions';

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

test('every capability combination fits the host instruction window without truncation', () => {
  for (let mask = 0; mask < 32; mask += 1) {
    const instructions = buildMaxVideoAiMcpInstructions({
      paidGeneration: Boolean(mask & 1),
      referenceUploads: Boolean(mask & 2),
      audioGeneration: Boolean(mask & 4),
      montagePreparation: Boolean(mask & 8),
      studioMontageCreation: Boolean(mask & 16),
    });
    assert.ok(Buffer.byteLength(instructions, 'utf8') <= 2000,
      `capabilities ${mask}: ${Buffer.byteLength(instructions, 'utf8')} bytes exceeds the 2000-byte host budget`);
  }
});

test('the first kilobyte routes video requests and preserves the paid approval boundary', async () => {
  const instructions = await getInstructions({ paidGeneration: true, referenceUploads: true });
  const visible = Buffer.from(instructions, 'utf8').subarray(0, 1000).toString('utf8');
  assert.match(visible, /MaxVideoAI.*video/i);
  assert.match(visible, /prepare_generation/);
  assert.match(visible, /exact.*(?:quote|price)/i);
  assert.match(visible, /explicit.*approval/i);
  assert.match(visible, /confirm_generation/);
  assert.match(visible, /one.*attempt/i);
});

const services = {
  async prepareMontage() { throw new Error('unused'); },
  async createStudioMontage() { throw new Error('unused'); },
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
  async createReferenceUploadLink() {
    throw new Error('unused');
  },
  async importReferenceFiles() {
    throw new Error('unused');
  },
  async listAudioCapabilities() {
    throw new Error('unused');
  },
  async prepareAudioGeneration() {
    throw new Error('unused');
  },
  async confirmAudioGeneration() {
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

// Inspect initialize and tools/list exactly as clients receive them. These are
// metadata contracts, not claims that a host/model selected the right tool.
async function getMetadata(options: MaxVideoAiMcpServerOptions) {
  const server = createMaxVideoAiMcpServer(principal, services, options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'metadata-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    return { instructions: client.getInstructions() ?? '', tools: (await client.listTools()).tools };
  } finally {
    await client.close();
    await server.close();
  }
}

const allCapabilities = {
  paidGeneration: true, referenceUploads: true, audioGeneration: true,
  montagePreparation: true, studioMontageCreation: true,
};

test('discovery routes only to tools actually advertised for every gate combination', async () => {
  for (let mask = 0; mask < 32; mask += 1) {
    const options = {
      paidGeneration: Boolean(mask & 1), referenceUploads: Boolean(mask & 2),
      audioGeneration: Boolean(mask & 4), montagePreparation: Boolean(mask & 8),
      studioMontageCreation: Boolean(mask & 16),
    };
    const { instructions, tools } = await getMetadata(options);
    const names = new Set(tools.map(tool => tool.name));
    for (const name of instructions.match(/\b(?:get|list|recommend|calculate|prepare|confirm|create|import|present)_[a-z_]+\b/g) ?? []) {
      assert.ok(names.has(name), `capabilities ${mask} routes to unavailable ${name}`);
    }
    assert.equal(names.has('confirm_generation'), options.paidGeneration);
    assert.equal(names.has('confirm_audio_generation'), options.paidGeneration && options.audioGeneration);
    assert.equal(names.has('create_reference_upload_link'), options.referenceUploads);
    assert.equal(names.has('prepare_montage'), options.montagePreparation);
    assert.equal(names.has('create_studio_montage'), options.studioMontageCreation);
    if (!options.paidGeneration) assert.match(instructions, /generation is not available/i);
  }
});

test('each raw tool descriptor fits the host window and retains structured risk metadata', async () => {
  const { instructions, tools } = await getMetadata(allCapabilities);
  assert.ok(Buffer.byteLength(instructions, 'utf8') <= 2000);
  for (const tool of tools) {
    assert.ok(tool.description && Buffer.byteLength(tool.description, 'utf8') <= 2000, `${tool.name} exceeds the 2000-byte description budget`);
    assert.equal(tool.inputSchema.type, 'object', tool.name);
    assert.equal(typeof tool.annotations?.readOnlyHint, 'boolean', tool.name);
    assert.equal(typeof tool.annotations?.destructiveHint, 'boolean', tool.name);
    assert.equal(typeof tool.annotations?.openWorldHint, 'boolean', tool.name);
  }
});

async function descriptions() {
  const { tools } = await getMetadata(allCapabilities);
  return Object.fromEntries(tools.map(tool => [tool.name, tool.description ?? '']));
}

test('model details carry mode and reference guidance at the point of discovery', async () => {
  const d = (await descriptions()).get_model_details;
  for (const mode of ['t2v', 'i2v_standard', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend', 'a2v', 'retake', 'reframe']) assert.ok(d.includes(mode), mode);
  assert.match(d, /assetRequired.*assetRequiredWhen.*private.*never.*HTTPS/s);
  assert.match(d, /aspectRatios.*empty.*omit aspectRatio.*non-empty.*supported aspectRatio/s);
  assert.match(d, /always_generated.*unavailable.*omit settings.audio.*optional/s);
  assert.match(d, /GPT Image.*mask.*imageWidth.*imageHeight/s);
  assert.match(d, /mask image with the mask role/i);
  assert.match(d, /promptingSources.*empty.*do not invent.*web search/s);
  assert.match(d, /if empty, say no reviewed official source was returned/i);
  assert.match(d, /guides.*not MaxVideoAI availability or pricing/s);
});

test('recommendation and budget tools retain choice, quality and estimate boundaries', async () => {
  const d = await descriptions();
  assert.match(d.recommend_models, /best-fit.*executable.*first.*distinct model families/s);
  assert.match(d.recommend_models, /never rank creative quality by resolution/i);
  assert.match(d.recommend_models, /do not use.*already chose.*validation.*pricing.*execution/i);
  assert.match(d.recommend_models, /never substitute.*without user approval/i);
  assert.match(d.recommend_models, /mixed|mix models/i);
  assert.match(d.calculate_project_budget, /same.*attempts.*before.*cheaper/s);
  assert.match(d.calculate_project_budget, /estimates do not reserve.*authorize generation/i);
  assert.match(d.calculate_project_budget, /environment.*staging.*production/s);
  const { instructions } = await getMetadata(allCapabilities);
  assert.match(instructions, /scripts, shot plans.*reference media/i);
  assert.match(instructions, /named model is unavailable or incompatible.*explain.*ask before alternatives/i);
  assert.doesNotMatch(instructions, /Seedance|Veo|Kling|best model|highest quality/i);
});

test('each paid tool preserves exact approval and one-attempt recovery without a skill', async () => {
  const d = await descriptions();
  for (const tool of ['confirm_generation', 'confirm_audio_generation']) {
    const visible = Buffer.from(d[tool]).subarray(0, 1000).toString('utf8');
    assert.match(visible, /only after explicit user approval.*exact fresh quote/i);
    assert.match(visible, /ambiguous assent is not confirmation/i);
    assert.match(visible, /one paid attempt/i);
    assert.match(visible, /refund does not restore authorization/i);
    assert.match(visible, /fresh.*quote.*new explicit.*approval/i);
    assert.match(visible, /get_generation_status.*list_recent_generations/s);
  }
  assert.match(d.prepare_generation, /does not spend or generate/i);
  assert.match(d.prepare_generation, /required private references.*missing.*no exact quote/is);
  assert.match(d.prepare_generation, /expiresAt.*UTC.*QUOTE_EXPIRED/s);
  assert.match(d.prepare_audio_generation, /list_audio_capabilities.*exact cents.*currency.*expiry.*balance.*top-up/s);
  assert.match(d.create_topup_link, /invalidates.*old.*quote/i);
  assert.match(d.create_topup_link, /get_account_status.*prepare_generation.*prepare_audio_generation.*fresh exact quote.*new explicit approval/s);
});

test('reference descriptors preserve private import order and each fallback path', async () => {
  const d = await descriptions();
  assert.match(d.import_reference_files, /up to eight.*user-authorized/s);
  assert.match(d.import_reference_files, /asset IDs directly.*input order.*do not call list_media/s);
  assert.match(d.import_reference_files, /partial failure.*keep successful.*retry only failed/s);
  assert.match(d.create_reference_upload_link, /one link per file.*packaged local helper/s);
  assert.match(d.create_reference_upload_link, /never send a raw local path.*public URL.*Computer Use/s);
  assert.match(d.create_reference_upload_link, /helper returns asset IDs.*without relisting/s);
  assert.match(d.create_reference_upload_link, /browser upload.*same connected.*library.*list_media/s);
  assert.match(d.create_reference_upload_link, /fails.*denied.*unavailable.*authorize or retry/s);
});

test('recovery and presentation descriptors preserve status truth and UI fallback', async () => {
  const d = await descriptions();
  assert.match(d.get_generation_status, /do not claim completion until terminal success/i);
  assert.match(d.get_generation_status, /technical failure.*refund.*do not resubmit automatically/s);
  assert.match(d.get_generation_status, /wait.*retry\.afterSeconds.*retry\.tool.*retry\.arguments/s);
  assert.match(d.get_generation_status, /retry.*null.*stop automatic polling/i);
  assert.match(d.list_recent_generations, /before considering any second paid submission/i);
  assert.match(d.present_generation, /once.*completed.*original Audio/s);
  assert.match(d.present_generation, /same connected.*library.*does not render.*resource link.*fallback/s);
  assert.match(d.present_generation, /do not poll, generate, retry, confirm, or charge/i);
});
