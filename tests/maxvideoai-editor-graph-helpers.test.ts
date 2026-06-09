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
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';

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
