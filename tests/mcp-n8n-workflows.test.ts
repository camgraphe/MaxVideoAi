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

type Node = { id: string; name: string; type: string; parameters: Record<string, unknown> };
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
    for (const node of workflow.nodes.filter((entry) => entry.type === 'n8n-nodes-langchain.mcpClient')) {
      assert.equal(node.parameters.endpointUrl, 'https://api.maxvideoai.com/mcp');
      assert.equal(node.parameters.authentication, 'oAuth2');
    }
    assert.doesNotMatch(serialized, /"credentials"|access[_ -]?token|client[_ -]?secret|bearer\s+[a-z0-9]/i);
    assert.doesNotMatch(serialized, /\$\d|Seedance|Luma|Kling|Veo|H3|\d+ models/i);
    for (const node of workflow.nodes.filter((entry) => entry.type === 'n8n-nodes-base.wait')) {
      assert.equal(typeof node.parameters.amount, 'number');
      assert.ok(Number(node.parameters.amount) > 0 && Number(node.parameters.amount) <= 60);
    }
  }
});

test('generation candidates put a human gate between prepare and one confirmation', () => {
  for (const file of ['brief-to-approved-generation.json', 'campaign-queue.json'] as const) {
    const workflow = load(file);
    assert.ok(reachable(workflow, 'Prepare Generation', 'Human Approval'));
    assert.ok(reachable(workflow, 'Human Approval', 'Confirm Generation'));
    assert.equal(workflow.nodes.filter((node) => node.name === 'Confirm Generation').length, 1);
    assert.match(JSON.stringify(workflow), /idempotencyKey/);
    const recoveryTargets = (workflow.connections['Get Generation Status']?.main ?? [])
      .flatMap((branch) => branch ?? [])
      .map((edge) => edge.node);
    assert.equal(recoveryTargets.includes('Confirm Generation'), false);
  }
});

test('campaign processing is bounded and sequential by default', () => {
  const workflow = load('campaign-queue.json');
  const loop = workflow.nodes.find((node) => node.name === 'Bounded Campaign Loop');
  assert.ok(loop);
  assert.equal(loop.parameters.batchSize, 1);
  assert.equal(loop.parameters.maxItems, 20);
  assert.match(JSON.stringify(workflow), /one approval per item/i);
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
});

test('n8n candidate documentation keeps clean import and catalogue release pending', () => {
  const path = `${root}/README.md`;
  assert.equal(existsSync(path), true, `${path} should exist`);
  const guide = readFileSync(path, 'utf8');
  assert.match(guide, /MCP Client.*deterministic/is);
  assert.match(guide, /MCP Client Tool.*AI Agent/is);
  assert.match(guide, /n8n Cloud.*self-hosted/is);
  assert.match(guide, /clean import.*not yet recorded/is);
  assert.match(guide, /explicit owner authorization/i);
  assert.equal(getMcpIntegration('n8n').store.status, 'preparing');
  assert.equal(getMcpIntegration('n8n').installation.package, 'unavailable');
});
