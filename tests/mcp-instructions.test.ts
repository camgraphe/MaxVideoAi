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
  async createReferenceUploadLink() {
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

  assert.match(instructions, /host owns creative discussion, scripts, prompts, shot plans, and reference ideas/i);
  assert.match(instructions, /host may help create or select reference images/i);
  assert.match(instructions, /live MaxVideoAI tools for current model facts and prices instead of model memory/i);
  assert.match(instructions, /ask only for missing choices that materially change the result or budget/i);
  assert.match(instructions, /named single- or mixed-model proposals.*calculate_project_budget/i);
  assert.match(instructions, /creative attempts are explicit billable scenarios/i);
  assert.match(instructions, /technical failures follow the returned job and refund state/i);
  assert.match(instructions, /project estimates do not reserve price/i);
  assert.match(instructions, /get_account_status.*credit balance.*trial.*spending limit/i);
  assert.match(instructions, /same connected MaxVideoAI (?:account|library)/i);
  assert.match(instructions, /connected environment.*may differ.*staging.*production/i);
  assert.match(instructions, /always_generated.*omit settings\.audio/i);
  assert.match(instructions, /optional.*settings\.audio/i);
  assert.match(instructions, /explicit model choice.*do not.*recommend_models/i);
  assert.match(instructions, /never.*substitut.*without.*user/i);
  assert.match(instructions, /user.*undecided.*recommend_models/i);
  assert.match(instructions, /best-fit.*available.*first/i);
  assert.match(instructions, /distinct model famil/i);
  assert.match(instructions, /calculate_project_budget.*before.*(?:cheaper|lower-cost)/i);
  assert.match(instructions, /quality.*clarify.*story|quality.*clarify.*resolution/i);
  assert.match(instructions, /mixed-model.*shot.*rationale/i);
  assert.match(instructions, /aspectRatios.*empty.*omit aspectRatio/i);
  assert.match(instructions, /aspectRatios.*non-empty.*supported aspectRatio/i);
  assert.match(instructions, /generation is not available/i);
  assert.doesNotMatch(instructions, /use prepare_generation/i);
  assert.doesNotMatch(instructions, /use list_media/i);
  assert.doesNotMatch(instructions, /economy|balanced|premium/i);
  assert.doesNotMatch(instructions, /fixed questionnaire|automatic retr(?:y|ies)|automatic generation|custom ui/i);
});

test('instructions describe the exact quote and confirmation flow when paid generation is enabled', async () => {
  const instructions = await getInstructions({ paidGeneration: true, referenceUploads: false });

  assert.doesNotMatch(instructions, /generation is not available/i);
  assert.match(instructions, /use prepare_generation/i);
  assert.match(instructions, /exact price/i);
  assert.match(instructions, /explicit user confirmation/i);
  assert.match(instructions, /use confirm_generation/i);
  assert.match(instructions, /do not claim completion/i);
  assert.match(instructions, /do not automatically retry/i);
  assert.match(instructions, /complete.*chosen request.*prepare_generation/i);
  assert.match(instructions, /display.*exact (?:price|quote).*wait.*explicit.*approval/i);
  assert.match(instructions, /ambiguous.*(?:reply|approval|assent).*not.*confirmation/i);
  assert.match(instructions, /get_generation_status.*list_recent_generations.*rather than.*second paid/i);
  assert.match(instructions, /returned.*(?:account|upload|top-up|approval).*URL/i);
  assert.match(instructions, /insufficient.*credits.*create_topup_link/i);
  assert.match(instructions, /payment.*MaxVideoAI (?:website|site)/i);
  assert.match(instructions, /old.*quote.*invalid/i);
  assert.match(instructions, /after.*fund.*get_account_status.*prepare_generation/is);
  assert.match(instructions, /fresh exact quote.*explicit.*approval/i);
  assert.match(instructions, /technical failure.*refund.*not.*resubmit/is);
  assert.match(instructions, /creative retry.*new paid attempt.*prepare_generation.*approval/is);
  assert.match(instructions, /completed.*saved.*same connected.*library/is);
});

test('instructions cover all video workflows and distinguish private media selection from upload', async () => {
  const instructions = await getInstructions({ paidGeneration: false, referenceUploads: true });

  assert.match(instructions, /get_model_details.*required fields.*limits/i);
  assert.match(instructions, /t2v.*text.*i2v.*first.*last.*ref2v.*image.*video.*audio.*v2v.*source video.*extend.*ordered/is);
  assert.match(instructions, /use list_media/i);
  assert.match(instructions, /existing private.*image.*video.*audio/i);
  assert.match(instructions, /filter.*media kind/i);
  assert.match(instructions, /do not upload.*with list_media/i);
  assert.match(instructions, /use create_reference_upload_link/i);
  assert.match(instructions, /requested (?:image|media) kind/i);
  assert.match(instructions, /short-lived.*browser handoff/i);
  assert.match(instructions, /does not create reference (?:images|media)/i);
  assert.match(instructions, /upload.*saved.*same connected MaxVideoAI library.*list_media/is);
});

test('instructions recommend from live executable facts without hardcoded model hype', async () => {
  const instructions = await getInstructions({ paidGeneration: true, referenceUploads: true });

  assert.match(instructions, /best executable fit.*first/i);
  assert.match(instructions, /Seedance 2\.5.*only when.*live.*details.*fit/i);
  assert.match(instructions, /comparable.*budget.*before.*cheaper/i);
  assert.doesNotMatch(instructions, /best model|highest quality|state-of-the-art|always choose Seedance/i);
});
