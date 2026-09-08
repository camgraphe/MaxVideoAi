import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

test('Connections renders every policy slot and exposes create-and-connect through semantic buttons', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => {
    module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key });
  };
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/app/studio/workspace',
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame(callback: FrameRequestCallback) { callback(0); return 1; },
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const shot: WorkspaceGraphNode = {
    id: 'slot-shot',
    type: 'shot',
    position: { x: 500, y: 200 },
    data: {
      kind: 'shot',
      title: 'Generation',
      targetHandles: ['prompt', 'video_reference'],
      inputConnectors: [
        { kind: 'prompt', label: 'Prompt', fieldId: 'prompt', required: true, sourceType: 'text', maxCount: 1, connectedCount: 0, remainingCount: 1 },
        { kind: 'video_reference', label: 'Video refs', fieldId: 'video_urls', required: false, sourceType: 'video', maxCount: 3, connectedCount: 1, remainingCount: 2 },
      ],
    },
  };
  const prompt: WorkspaceGraphNode = {
    id: 'prompt', type: 'text-prompt', position: { x: 0, y: 0 },
    data: { kind: 'text-prompt', title: 'Direction', sourceHandles: ['prompt'] },
  };
  const video: WorkspaceGraphNode = {
    id: 'video', type: 'asset-video', position: { x: 0, y: 100 },
    data: { kind: 'asset-video', title: 'Take 1', sourceHandles: ['video_reference'] },
  };
  const edges: WorkspaceGraphEdge[] = [{
    id: 'video-link', source: video.id, target: shot.id,
    sourceHandle: 'video_reference', targetHandle: 'video_reference', data: { kind: 'video_reference' },
  }];
  const createRequests: unknown[] = [];

  try {
    const { CanvasConnectionPicker } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasConnectionPicker');
    await act(async () => root.render(React.createElement(CanvasConnectionPicker as React.ComponentType<Record<string, unknown>>, {
      node: shot,
      nodes: [shot, prompt, video],
      edges,
      copy: DEFAULT_STUDIO_COPY.canvas.nodes,
      isValidConnection: (connection: { source: string; targetHandle: string }) => connection.source !== video.id || connection.targetHandle !== 'video_reference',
      onConnect() {},
      onDisconnect() {},
      onCreateAndConnect: (request: unknown) => createRequests.push(request),
      onClose() {},
    })));

    const slots = [...dom.window.document.querySelectorAll<HTMLElement>('[data-connection-slot]')];
    assert.deepEqual(slots.map((slot) => slot.dataset.connectionSlot), ['prompt', 'video_reference']);
    assert.equal(slots[0]?.dataset.connectionFieldId, 'prompt');
    assert.equal(slots[1]?.dataset.connectionFieldId, 'video_urls');
    assert.match(slots[0]?.textContent ?? '', /Required.*0 used \/ 1 maximum.*Required input missing/s);
    assert.match(slots[1]?.textContent ?? '', /Optional.*1 used \/ 3 maximum.*Connected/s);
    assert.match(slots[0]?.textContent ?? '', /Direction/);
    assert.doesNotMatch(slots[1]?.textContent ?? '', /Take 1.*Connect/s, 'an existing edge cannot be proposed as a duplicate source');

    const createButton = dom.window.document.querySelector<HTMLButtonElement>('[data-create-and-connect="video_reference"]');
    assert.ok(createButton, 'keyboard and touch users receive a real create-and-connect button');
    assert.equal(createButton.type, 'button');
    await act(async () => createButton.click());
    assert.deepEqual(createRequests, [{
      sourceNodeId: shot.id,
      handleId: 'video_reference',
      handleType: 'target',
      position: { x: 240, y: 320 },
    }]);

    const output: WorkspaceGraphNode = {
      id: 'output', type: 'output', position: { x: 500, y: 400 },
      data: { kind: 'output', title: 'Generated clip', targetHandles: ['generated_output'] },
    };
    const generatedEdge: WorkspaceGraphEdge = {
      id: 'generated-link', source: shot.id, target: output.id,
      sourceHandle: 'video_reference', targetHandle: 'generated_output', data: { kind: 'generated_output' },
    };
    await act(async () => root.render(React.createElement(CanvasConnectionPicker as React.ComponentType<Record<string, unknown>>, {
      node: output,
      nodes: [shot, output],
      edges: [generatedEdge],
      copy: DEFAULT_STUDIO_COPY.canvas.nodes,
      isValidConnection: () => false,
      onConnect() {},
      onDisconnect() {},
      onClose() {},
    })));

    const generatedSlot = dom.window.document.querySelector<HTMLElement>('[data-connection-slot="generated_output"]');
    assert.equal(generatedSlot?.dataset.connectionSlotStatus, 'full');
    assert.match(generatedSlot?.textContent ?? '', /Required.*1 used \/ 1 maximum.*Full/s);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
});
