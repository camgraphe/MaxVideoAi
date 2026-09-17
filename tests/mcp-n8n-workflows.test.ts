import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { getMcpIntegration } from '../frontend/lib/mcp-integration-registry';

const root = 'distribution/n8n';
const files = [
  'brief-to-approved-generation.json',
  'campaign-queue.json',
  'completion-notification.json',
] as const;

type Node = {
  id: string;
  name: string;
  type: string;
  position: unknown;
  parameters: Record<string, unknown>;
};
type Workflow = {
  name: string;
  active: boolean;
  nodes: Node[];
  connections: Record<string, { main?: Array<Array<{ node: string }>> }>;
  settings: Record<string, unknown>;
};

function load(file: typeof files[number]): Workflow {
  const path = `${root}/${file}`;
  assert.equal(existsSync(path), true, `${path} should exist`);
  return JSON.parse(readFileSync(path, 'utf8')) as Workflow;
}

function reachable(workflow: Workflow, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const branch of workflow.connections[current]?.main ?? []) {
      for (const edge of branch ?? []) queue.push(edge.node);
    }
  }
  return false;
}

function directTargets(workflow: Workflow, from: string, output = 0): string[] {
  return (workflow.connections[from]?.main?.[output] ?? []).map((edge) => edge.node);
}

test('each n8n candidate includes one isolated submission-guideline note with complete setup guidance', () => {
  const workflowSpecificGuidance = new Map<typeof files[number], RegExp[]>([
    [
      'brief-to-approved-generation.json',
      [/exact fresh quote/i, /quoteId/, /confirm_generation/, /jobId/, /bounded (?:status )?recovery/i],
    ],
    [
      'campaign-queue.json',
      [/one approval per item/i, /exact fresh quote/i, /quoteId/, /confirm_generation/, /jobId/],
    ],
    [
      'completion-notification.json',
      [/acceptedJobId/, /does not prepare or confirm/i, /upstream approval/i, /recovery/i],
    ],
  ]);

  for (const file of files) {
    const workflow = load(file);
    const notes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.stickyNote');

    assert.equal(notes.length, file === 'brief-to-approved-generation.json' ? 4 : 1,
      `${file}: expected a guide and, for the reviewed brief, three stage annotations`);
    const [note] = notes;
    const content = String(note.parameters.content ?? '');
    const position = note.position;

    assert.equal(workflow.nodes.filter((node) => node.id === note.id).length, 1, `${file}: note id must be unique`);
    assert.equal(workflow.nodes.filter((node) => node.name === note.name).length, 1, `${file}: note name must be unique`);
    assert.match(note.id, /^[a-z][a-z0-9-]+-guide$/);
    assert.match(note.name, /^Template guide:/);
    assert.ok(Array.isArray(position), `${file}: note position must be a coordinate pair`);
    assert.equal(position.length, 2, `${file}: note position must be a coordinate pair`);
    assert.ok(position.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)));
    assert.ok(Number(note.parameters.width) >= 500, `${file}: note should be wide enough to read`);
    assert.ok(Number(note.parameters.height) >= 500, `${file}: note should be tall enough to read`);
    assert.ok(content.length >= 800, `${file}: note should contain substantive instructions`);
    assert.match(content, /^# /);
    assert.match(content, /## Intended user and outcome/i);
    assert.match(content, /## How it works/i);
    assert.match(content, /## Setup/i);
    assert.match(content, /self-hosted n8n/i);
    assert.match(content, /MaxVideoAI MCP OAuth/i);
    assert.match(content, /https:\/\/api\.maxvideoai\.com\/mcp/);
    assert.match(content, /after import/i);
    assert.match(content, /n8n Cloud/i);
    assert.match(content, /MCP Client Tool/i);
    for (const pattern of workflowSpecificGuidance.get(file) ?? []) {
      assert.match(content, pattern, `${file}: missing ${pattern}`);
    }

    for (const annotation of notes) {
      assert.equal(annotation.name in workflow.connections, false, `${file}: note must not be a connection source`);
      for (const outputs of Object.values(workflow.connections)) {
        for (const branch of outputs.main ?? []) {
          assert.equal(
            (branch ?? []).some((edge) => edge.node === annotation.name),
            false,
            `${file}: note must not be a connection target`,
          );
        }
      }
    }
  }
});

test('reviewed n8n brief explains each execution stage in a nearby non-executable Sticky Note', () => {
  const workflow = load('brief-to-approved-generation.json');
  const annotations = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.stickyNote').slice(1);
  assert.deepEqual(annotations.map((node) => node.name), [
    'Step 1: prepare a fresh quote',
    'Step 2: require exact human approval',
    'Step 3: confirm once and recover by job ID',
  ]);
  for (const [index, annotation] of annotations.entries()) {
    assert.ok(String(annotation.parameters.content).length >= 180);
    assert.ok(Number(annotation.parameters.width) >= 600);
    assert.ok(Number(annotation.parameters.height) >= 200);
    assert.equal((annotation.position as number[])[1], -380);
    assert.equal((annotation.position as number[])[0], [-900, 200, 860][index]);
  }
  assert.match(String(annotations[0].parameters.content), /recommend_models.*calculate_project_budget.*prepare_generation/s);
  assert.match(String(annotations[1].parameters.content), /approved: true.*quoteId.*rejection/s);
  assert.match(String(annotations[2].parameters.content), /confirm_generation.*jobId.*never/s);
  assert.match(String(annotations[2].parameters.content), /bounded recovery/i);
});

test('n8n candidates are import-shaped, credential-free and internally connected', () => {
  for (const file of files) {
    const workflow = load(file);
    const serialized = JSON.stringify(workflow);
    const names = new Set(workflow.nodes.map((node) => node.name));
    const ids = workflow.nodes.map((node) => node.id);

    assert.ok(workflow.name.length > 0);
    assert.equal(workflow.active, false);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(workflow.nodes.length >= 4);
    assert.equal(typeof workflow.settings, 'object');
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.has(source), `${file}: missing connection source ${source}`);
      for (const branch of outputs.main ?? []) {
        for (const edge of branch ?? []) assert.ok(names.has(edge.node), `${file}: missing target ${edge.node}`);
      }
    }
    const mcpNodes = workflow.nodes.filter(
      (entry) => entry.type === '@n8n/n8n-nodes-langchain.mcpClient',
    );
    assert.ok(mcpNodes.length > 0, `${file}: should use the current built-in MCP Client node type`);
    assert.equal(
      workflow.nodes.some((entry) => entry.type === 'n8n-nodes-langchain.mcpClient'),
      false,
      `${file}: should not use the retired pre-scope package name`,
    );
    for (const node of mcpNodes) {
      assert.equal(node.parameters.endpointUrl, 'https://api.maxvideoai.com/mcp');
      assert.equal(node.parameters.authentication, 'mcpOAuth2Api');
      assert.deepEqual(node.parameters.tool, {
        mode: 'list',
        value: String((node.parameters.tool as { value?: unknown }).value),
      });
      assert.match(String((node.parameters.tool as { value?: unknown }).value), /^[a-z][a-z0-9_]+$/);
    }
    assert.doesNotMatch(serialized, /"credentials"|access[_ -]?token|client[_ -]?secret|bearer\s+[a-z0-9]/i);
    assert.doesNotMatch(serialized, /\$\d|Seedance|Luma|Kling|Veo|H3|\d+ models/i);
    for (const node of workflow.nodes.filter((entry) => entry.type === 'n8n-nodes-base.wait')) {
      assert.equal(typeof node.parameters.amount, 'number');
      assert.ok(Number(node.parameters.amount) > 0 && Number(node.parameters.amount) <= 60);
    }
  }
});

test('generation candidates put a human gate between prepare and one exact confirmation', () => {
  for (const file of ['brief-to-approved-generation.json', 'campaign-queue.json'] as const) {
    const workflow = load(file);
    assert.ok(reachable(workflow, 'Prepare Generation', 'Human Approval'));
    assert.deepEqual(directTargets(workflow, 'Human Approval'), ['Require Explicit Approval']);
    assert.deepEqual(directTargets(workflow, 'Require Explicit Approval', 0), ['Confirm Generation']);
    assert.deepEqual(directTargets(workflow, 'Require Explicit Approval', 1), ['Approval Rejected']);
    assert.equal(workflow.nodes.filter((node) => node.name === 'Confirm Generation').length, 1);
    const prepare = workflow.nodes.find((node) => node.name === 'Prepare Generation');
    const approval = workflow.nodes.find((node) => node.name === 'Require Explicit Approval');
    const wait = workflow.nodes.find((node) => node.name === 'Human Approval');
    const confirm = workflow.nodes.find((node) => node.name === 'Confirm Generation');
    assert.ok(prepare);
    assert.ok(approval);
    assert.ok(wait);
    assert.ok(confirm);
    assert.equal(wait.parameters.httpMethod, 'POST');
    assert.doesNotMatch(String(prepare.parameters.jsonInput), /idempotencyKey|confirmed|explicitApproval/);
    assert.match(JSON.stringify(approval.parameters), /body.*approved.*quoteId/is);
    assert.match(String(confirm.parameters.jsonInput), /quoteId/);
    assert.match(String(confirm.parameters.jsonInput), /structuredContent\.quoteId/);
    assert.match(String(confirm.parameters.jsonInput), /confirmed:\s*true/);
    assert.doesNotMatch(String(confirm.parameters.jsonInput), /idempotencyKey|explicitApproval/);
    assert.match(
      String(workflow.nodes.find((node) => node.name === 'Get Generation Status')?.parameters.jsonInput),
      /structuredContent\.jobId/,
    );
    assert.match(
      String(workflow.nodes.find((node) => node.name === 'Present Result')?.parameters.jsonInput),
      /structuredContent\.jobId/,
    );
    assert.deepEqual(directTargets(workflow, 'Get Generation Status'), ['Generation Terminal?']);
    assert.deepEqual(directTargets(workflow, 'Generation Terminal?', 0), ['Present Result']);
    assert.deepEqual(directTargets(workflow, 'Generation Terminal?', 1), ['Continue Polling?']);
    assert.deepEqual(directTargets(workflow, 'Continue Polling?', 0), ['Wait Before Status']);
    assert.deepEqual(directTargets(workflow, 'Continue Polling?', 1), ['Polling Timed Out']);
    assert.match(
      JSON.stringify(workflow.nodes.find((node) => node.name === 'Continue Polling?')?.parameters),
      /\$runIndex\s*<\s*19/,
    );
    const recoveryTargets = (workflow.connections['Get Generation Status']?.main ?? [])
      .flatMap((branch) => branch ?? [])
      .map((edge) => edge.node);
    assert.equal(recoveryTargets.includes('Confirm Generation'), false);
  }
});

test('campaign processing is bounded and sequential by default', () => {
  const workflow = load('campaign-queue.json');
  const limit = workflow.nodes.find((node) => node.name === 'Limit Campaign Items');
  const loop = workflow.nodes.find((node) => node.name === 'Bounded Campaign Loop');
  assert.ok(limit);
  assert.ok(loop);
  assert.equal(limit.type, 'n8n-nodes-base.limit');
  assert.equal(limit.parameters.maxItems, 20);
  assert.equal(loop.parameters.batchSize, 1);
  assert.equal('maxItems' in loop.parameters, false);
  assert.equal('approvalPolicy' in loop.parameters, false);
  assert.deepEqual(directTargets(workflow, 'Limit Campaign Items'), ['Bounded Campaign Loop']);
  assert.deepEqual(directTargets(workflow, 'Bounded Campaign Loop', 1), ['Normalize Campaign Item']);
  assert.deepEqual(directTargets(workflow, 'Present Result'), ['Bounded Campaign Loop']);
  assert.match(JSON.stringify(workflow), /one approval per item/i);
});

test('generation inputs use explicit strict-schema payloads instead of prior MCP output', () => {
  const brief = load('brief-to-approved-generation.json');
  const serializedBrief = JSON.stringify(brief);
  assert.match(
    String(brief.nodes.find((node) => node.name === 'Recommend Models')?.parameters.jsonInput),
    /Normalize Brief.*recommendationRequest/,
  );
  assert.match(
    String(brief.nodes.find((node) => node.name === 'Calculate Project Budget')?.parameters.jsonInput),
    /Normalize Brief.*projectBudgetRequest/,
  );
  assert.match(
    String(brief.nodes.find((node) => node.name === 'Prepare Generation')?.parameters.jsonInput),
    /Normalize Brief.*generationRequest/,
  );
  assert.doesNotMatch(serializedBrief, /\{\s*brief:\s*\$\(/);

  const campaign = load('campaign-queue.json');
  const serializedCampaign = JSON.stringify(campaign);
  assert.match(
    String(campaign.nodes.find((node) => node.name === 'Calculate Project Budget')?.parameters.jsonInput),
    /Normalize Campaign Item.*projectBudgetRequest/,
  );
  assert.match(
    String(campaign.nodes.find((node) => node.name === 'Prepare Generation')?.parameters.jsonInput),
    /Normalize Campaign Item.*generationRequest/,
  );
  assert.doesNotMatch(serializedCampaign, /idempotencyKey/);
});

test('completion notification only observes an accepted job and actionable outcomes', () => {
  const workflow = load('completion-notification.json');
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(names.includes('Prepare Generation'), false);
  assert.equal(names.includes('Confirm Generation'), false);
  assert.ok(names.includes('Get Generation Status'));
  assert.ok(names.includes('Notify Completion'));
  assert.ok(names.includes('Notify Failure Or Refund'));
  assert.ok(names.includes('Notify User Action'));
  assert.match(JSON.stringify(workflow), /acceptedJobId/);
  assert.match(
    JSON.stringify(
      workflow.nodes.find((node) => node.name === 'Require Accepted Job')?.parameters.assignments,
    ),
    /body.*acceptedJobId/,
  );
  const routing = JSON.stringify(
    workflow.nodes.find((node) => node.name === 'Route Actionable Outcome')?.parameters,
  );
  assert.match(routing, /structuredContent.*status/is);
  assert.match(routing, /paymentStatus/);
  assert.doesNotMatch(routing, /requiresUserAction/);
});

test('n8n candidate documentation records the live deterministic scope and keeps catalogue submission factual', () => {
  const path = `${root}/README.md`;
  assert.equal(existsSync(path), true, `${path} should exist`);
  const guide = readFileSync(path, 'utf8');
  assert.match(guide, /MCP Client.*deterministic/is);
  assert.match(guide, /MCP Client Tool.*AI Agent/is);
  assert.match(guide, /n8n Cloud.*self-hosted/is);
  assert.match(guide, /n8n 2\.38\.7/);
  assert.match(guide, /import.*export.*parity/is);
  assert.match(guide, /project-scoped/i);
  assert.match(guide, /MCP Client Tool.*Chat Model.*not configured/is);
  assert.match(guide, /quoteId.*idempoten/is);
  assert.doesNotMatch(guide, /stable idempotency key/i);
  assert.match(guide, /self-hosted deterministic MCP Client scope is\s+live and indexable/i);
  assert.match(guide, /MCP Client Tool and n8n Cloud[\s\S]{0,120}outside the public claim/i);
  assert.match(guide, /product owner has authorized the\s+exact three-file external action/i);
  assert.match(guide, /Creator Portal identity\s+step/i);
  assert.doesNotMatch(guide, /integration therefore stays a non-indexed preview/i);
  assert.doesNotMatch(guide, /fresh policy review and explicit owner authorization/i);
  assert.equal(getMcpIntegration('n8n').store.status, 'submitted');
  assert.equal(getMcpIntegration('n8n').installation.package, 'unavailable');
});
