import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSelectedWorkspaceGraphNode,
  connectedInputCounts,
  connectedInputKinds,
  defaultSelectedNodeId,
  findGeneratedOutputNodeForShot,
  outputNodeSubtitle,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-helpers';
import { duplicateWorkspaceGraphSelection } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-clipboard';
import type { WorkspaceGraphEdge, WorkspaceGraphNode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';

function graphNode(id: string, kind: string, x: number, y: number): WorkspaceGraphNode {
  return {
    id,
    type: kind,
    position: { x, y },
    data: { kind, title: id },
  } as WorkspaceGraphNode;
}

function graphEdge(id: string, source: string, target: string, kind: string): WorkspaceGraphEdge {
  return {
    id,
    source,
    target,
    sourceHandle: kind,
    targetHandle: kind,
    data: { kind },
  } as WorkspaceGraphEdge;
}

test('workspace graph helpers derive graph selection and connected inputs from templates', () => {
  const template = createStarterWorkspaceTemplate('product-ad');
  const shot03InputKinds = connectedInputKinds('shot-03', template.edges);
  const shot03InputCounts = connectedInputCounts('shot-03', template.edges);

  assert.equal(defaultSelectedNodeId(template.nodes, template.id), 'shot-03');
  assert.ok(shot03InputKinds.length > 0);
  assert.equal(shot03InputKinds.includes('generated_output'), false);
  assert.equal(
    Array.from(shot03InputCounts.values()).reduce((total, count) => total + count, 0),
    template.edges.filter((edge) => edge.target === 'shot-03').length
  );

  const shot01Output = findGeneratedOutputNodeForShot('shot-01', template.nodes, template.edges);
  assert.equal(shot01Output?.data.kind, 'output');
});

test('workspace graph helpers append a selected node without preserving stale selection', () => {
  const template = createStarterWorkspaceTemplate('dev-blocks');
  const node = template.nodes[0];
  const appendedNodes = appendSelectedWorkspaceGraphNode(template.nodes, {
    ...node,
    id: 'new-node',
    selected: false,
  });

  assert.equal(appendedNodes.at(-1)?.id, 'new-node');
  assert.equal(appendedNodes.at(-1)?.selected, true);
  assert.equal(appendedNodes.filter((candidate) => candidate.selected).length, 1);
});

test('workspace graph helpers keep output subtitles centralized', () => {
  assert.equal(
    outputNodeSubtitle({
      kind: 'video',
      modelId: 'veo-3.1',
      modelLabel: 'Veo 3.1',
      workflowType: 'image_to_video',
      durationSec: 8,
      aspectRatio: '16:9',
      resolution: '1080p',
      status: 'ready',
      createdAt: new Date(0).toISOString(),
      sourceShotId: 'shot-01',
    }),
    '8s · 16:9'
  );
});

test('canvas clipboard duplicates selected graph nodes and keeps internal edges only', () => {
  const result = duplicateWorkspaceGraphSelection({
    nodes: [
      graphNode('prompt-1', 'text-prompt', 0, 0),
      graphNode('shot-1', 'shot', 300, 0),
      graphNode('shot-2', 'shot', 600, 0),
    ],
    edges: [
      graphEdge('edge-internal', 'prompt-1', 'shot-1', 'prompt'),
      graphEdge('edge-external', 'shot-1', 'shot-2', 'generated_output'),
    ],
    selectedNodeIds: ['prompt-1', 'shot-1'],
    offset: { x: 48, y: 48 },
  });

  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  assert.ok(result.edges[0].source !== 'prompt-1');
  assert.ok(result.edges[0].target !== 'shot-1');
  assert.deepEqual(
    result.nodes.map((node) => node.position),
    [{ x: 48, y: 48 }, { x: 348, y: 48 }],
    'duplicates should keep their selected nodes\' relative positions'
  );
});
