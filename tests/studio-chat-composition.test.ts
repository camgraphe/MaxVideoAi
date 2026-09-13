import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from '../frontend/node_modules/react';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server';
import { useWorkspaceGenerationActions } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions';
import { useWorkspaceRenderNodes } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes';
import type { WorkspaceGraphNode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

function fixture(): WorkspaceGraphNode {
  return { id: 'chat', position: { x: 0, y: 0 }, data: { kind: 'chat', title: 'Chat', chat: {
    mode: 'assistant', provider: 'openai', modelId: 'gpt-4.1-mini', botName: '', systemPrompt: '',
    draftMessage: 'Plan my scene', status: 'idle',
    messages: [{ id: 'old', role: 'assistant', content: 'Keep this answer', createdAt: '2026-09-08T00:00:00Z' }],
  } } };
}

for (const mockMode of [true, false]) {
  test(`Chat ${mockMode ? 'Mock produces a marked local simulation' : 'Live preserves draft and history without authorization'} without network`, async (context) => {
    const network = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Network is forbidden'); });
    let nodes = [fixture()];
    const initial = structuredClone(nodes);
    const notices: string[] = [];
    let actions: ReturnType<typeof useWorkspaceGenerationActions>;
    function Probe() {
      actions = useWorkspaceGenerationActions({
        capabilities: [], nodes, edges: [], mockMode, pricingEstimates: { chat: { status: 'ready', label: '$0.00', totalCents: 0 } },
        onGeneratedProjectAsset: () => {}, patchShot: () => {},
        setNodes: (update) => { nodes = typeof update === 'function' ? update(nodes) : update; },
        setEdges: () => {}, setActiveEditorSurface: () => {}, setSelectedNodeId: () => {},
        setNotice: (notice) => { if (notice) notices.push(notice); },
        studioCanvasNodeCopy: DEFAULT_STUDIO_COPY.canvas.nodes, studioNotices: DEFAULT_STUDIO_COPY.notices,
      });
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    await actions!.handleRunChat('chat');
    assert.equal(network.mock.callCount(), 0);
    if (mockMode) {
      assert.equal(nodes[0].data.chat?.messages.length, 3);
      assert.deepEqual(nodes[0].data.chat?.messages[0], initial[0].data.chat?.messages[0]);
      assert.match(nodes[0].data.chat!.messages[2].content, /Simulation/);
      assert.match(nodes[0].data.chat!.messages[2].content, /Plan my scene/);
      assert.equal(nodes[0].data.chat?.status, 'idle');
      assert.equal(nodes[0].data.chat?.draftMessage, '');
    } else {
      assert.deepEqual(nodes, initial);
      assert.match(notices[0], /Live.*unavailable/i);
    }
  });
}

test('Chat render projection carries the actual generation mode to card and inspector', () => {
  for (const mockMode of [true, false]) {
    let result: WorkspaceGraphNode[] = [];
    function Probe() {
      result = useWorkspaceRenderNodes({ mockMode, capabilities: [], nodes: [fixture()], edges: [], pricingEstimates: {},
        studioCanvasCopy: DEFAULT_STUDIO_COPY.canvas, onGenerateShot: () => {}, onOpenAssetLibrary: () => {},
        onPatchNodeData: () => {}, onPatchShot: () => {}, onRunChat: () => {}, onSendOutputToTimeline: () => {},
      });
      return null;
    }
    renderToStaticMarkup(createElement(Probe));
    assert.equal(result[0].data.mockGeneration, mockMode);
  }
});
