import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from '../frontend/node_modules/react';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server';
import { workspaceConnectionCandidates, workspaceGenerationActionReady } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-canvas-actions';
import type { WorkspaceGraphNode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import { loadingWorkspacePricingEstimate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import { submitWorkspaceShotGeneration } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import { useWorkspaceGenerationActions } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions';
import { getWorkspaceModelCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

test('source choices retain exact handles and apply the graph validator to every candidate', () => {
  const nodes: WorkspaceGraphNode[] = [
    { id: 'image', position: { x: 0, y: 0 }, data: { kind: 'asset-image', title: 'Product', sourceHandles: ['reference', 'mask'] } },
    { id: 'text', position: { x: 0, y: 0 }, data: { kind: 'text-prompt', title: 'Direction', sourceHandles: ['prompt'] } },
    { id: 'shot', position: { x: 0, y: 0 }, data: { kind: 'shot', title: 'Shot', sourceHandles: ['video'] } },
  ];
  const candidates = workspaceConnectionCandidates(nodes, 'shot', 'mask', (connection) => connection.sourceHandle === 'mask');
  assert.deepEqual(candidates.map(({ connection, title }) => ({ connection, title })), [{
    title: 'Product', connection: { source: 'image', sourceHandle: 'mask', target: 'shot', targetHandle: 'mask' },
  }]);
  assert.deepEqual(workspaceConnectionCandidates(nodes, 'shot', 'mask', () => false), []);
});

test('generation action cannot submit a loading, missing, failed or blocked quote', () => {
  for (const status of ['loading', 'error', 'blocked'] as const) {
    assert.equal(workspaceGenerationActionReady(true, 'ready', { status, label: '$1.00' }), false);
  }
  assert.equal(workspaceGenerationActionReady(true, 'ready', undefined), false);
  assert.equal(workspaceGenerationActionReady(true, 'ready', { status: 'ready', label: '$1.00', totalCents: 100 }), true);
  assert.equal(workspaceGenerationActionReady(false, 'ready', { status: 'ready', label: '$1.00' }), false);
  assert.equal(workspaceGenerationActionReady(true, 'generating', { status: 'ready', label: '$1.00' }), false);
});

test('recalculating a quote clears the previous amount and billing snapshot', () => {
  const next = loadingWorkspacePricingEstimate();
  assert.equal(next.status, 'loading');
  assert.equal(next.totalCents, undefined);
  assert.notEqual(next.label, '$1.00');
});

test('explicit mock simulation needs valid inputs but no live quote', () => {
  assert.equal(workspaceGenerationActionReady(true, 'ready', undefined, true), true);
  assert.equal(workspaceGenerationActionReady(false, 'ready', undefined, true), false);
  assert.equal(workspaceGenerationActionReady(true, 'generating', undefined, true), false);
});

test('Live routing errors remain errors in development, never simulated outputs', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const template = createStarterWorkspaceTemplate('minimal-start');
    const shot = template.nodes.find((node) => node.data.shot)!;
    // Chat has no media route: exercise a real, local routing rejection without a provider call.
    shot.data.shot = { ...shot.data.shot!, family: 'chat' };
    await assert.rejects(submitWorkspaceShotGeneration({
      nodes: template.nodes, edges: template.edges, shotNodeId: shot.id,
      capability: null, generationMode: 'real',
    }), /does not support generation through media routes/);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test('explicit mock calls the existing local simulation without network requests', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const template = createStarterWorkspaceTemplate('minimal-start');
  const shot = template.nodes.find((node) => node.data.shot)!;
  const outputs = await submitWorkspaceShotGeneration({
    nodes: template.nodes, edges: template.edges, shotNodeId: shot.id,
    capability: null, generationMode: 'mock',
  });
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].output.status, 'ready');
  assert.equal(fetch.mock.callCount(), 0);
});

test('generation callback rejects a missing Live quote before creating pending outputs', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request'); });
  const template = createStarterWorkspaceTemplate('minimal-start');
  const notices: unknown[] = [];
  let writes = 0;
  let actions: ReturnType<typeof useWorkspaceGenerationActions>;
  function Probe() {
    actions = useWorkspaceGenerationActions({
      capabilities: getWorkspaceModelCapabilities(), nodes: template.nodes, edges: template.edges,
      mockMode: false, pricingEstimates: {},
      onGeneratedProjectAsset: () => { writes++; }, patchShot: () => { writes++; },
      setNodes: () => { writes++; }, setEdges: () => { writes++; },
      setActiveEditorSurface: () => { writes++; }, setSelectedNodeId: () => { writes++; },
      setNotice: (notice) => notices.push(notice), studioCanvasNodeCopy: DEFAULT_STUDIO_COPY.canvas.nodes,
      studioNotices: DEFAULT_STUDIO_COPY.notices,
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  await actions!.handleGenerateShot('minimal-start-video');
  assert.deepEqual(notices, [DEFAULT_STUDIO_COPY.canvas.nodes.estimating]);
  assert.equal(writes, 0);
  assert.equal(fetch.mock.callCount(), 0);
});
