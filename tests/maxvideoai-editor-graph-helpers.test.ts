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
import {
  createWorkspaceGraphClipboardSnapshot,
  duplicateWorkspaceGraphSelection,
  pasteWorkspaceGraphClipboardSnapshot,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-clipboard';
import {
  shouldHandleCanvasKeyboardShortcut,
  shouldHandleCanvasPaste,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-canvas-shortcuts';
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

test('canvas clipboard paste centers an offscreen selection in the supplied flow viewport center', () => {
  const snapshot = createWorkspaceGraphClipboardSnapshot({
    nodes: [
      graphNode('prompt-offscreen', 'text-prompt', 8_000, -4_000),
      graphNode('shot-offscreen', 'shot', 8_300, -3_800),
    ],
    edges: [graphEdge('edge-internal', 'prompt-offscreen', 'shot-offscreen', 'prompt')],
    selectedNodeIds: ['prompt-offscreen', 'shot-offscreen'],
  });
  const result = pasteWorkspaceGraphClipboardSnapshot({
    currentEdges: [],
    currentNodes: [],
    idSeed: 'viewport-center',
    center: { x: 120, y: 240 },
    snapshot,
  });

  assert.equal(result.edges.length, 1, 'the internal connector should be preserved');
  assert.deepEqual(
    result.nodes.map((node) => node.position),
    [{ x: -30, y: 140 }, { x: 270, y: 340 }],
    'the copied group should center in the supplied flow viewport without changing relative positions'
  );
  assert.equal(result.edges[0].source, 'prompt-offscreen-copy-viewport-center');
  assert.equal(result.edges[0].target, 'shot-offscreen-copy-viewport-center');
});

test('canvas keyboard shortcuts leave a stale selection alone when the timeline owns focus', () => {
  assert.equal(
    shouldHandleCanvasKeyboardShortcut({
      isCanvasActive: false,
      isDefaultPrevented: false,
      isBlockedTarget: false,
    }),
    false,
    'timeline focus must prevent the canvas inspector from opening for a stale canvas selection'
  );
  assert.equal(
    shouldHandleCanvasKeyboardShortcut({
      isCanvasActive: true,
      isDefaultPrevented: false,
      isBlockedTarget: false,
    }),
    true,
    'canvas focus should retain the inspector shortcut'
  );
});

test('native canvas paste respects active surface ownership before handling graph or text clipboard data', () => {
  assert.equal(
    shouldHandleCanvasPaste({ isBlockedTarget: false, isCanvasActive: false }),
    false,
    'timeline-owned body paste must not invoke canvas graph or text paste handling'
  );
  assert.equal(
    shouldHandleCanvasPaste({ isBlockedTarget: false, isCanvasActive: true }),
    true,
    'canvas-owned body paste should be handled once by the native paste listener'
  );
  assert.equal(
    shouldHandleCanvasPaste({ isBlockedTarget: true, isCanvasActive: true }),
    false,
    'editable and dialog targets must retain their native paste behavior'
  );
});
