import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useWorkspaceShotPricing } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing';
import { getWorkspaceModelCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import type { WorkspaceGraphNode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

test('React Flow measurement updates do not repeat an unchanged Studio pricing request', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'https://local.test/app/studio/workspace' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const saved = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const previousFetch = globalThis.fetch;
  let preflightRequests = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === '/api/member-status') return Response.json({ tier: 'Member' });
    if (url === '/api/preflight') {
      preflightRequests += 1;
      return Response.json({
        ok: false,
        messages: ['Invalid preflight request.'],
        error: { code: 'PREFLIGHT_REQUEST_INVALID', message: 'Invalid preflight request.' },
      }, { status: 400 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const liveNodes = template.nodes.map((node) => node.data.asset?.url?.startsWith('/')
    ? { ...node, data: { ...node.data, asset: { ...node.data.asset, url: `https://media.example${node.data.asset.url}` } } }
    : node);
  const capabilities = getWorkspaceModelCapabilities();
  const root = createRoot(dom.window.document.getElementById('root')!);
  function Fixture({ mockMode, nodes }: { mockMode: boolean; nodes: WorkspaceGraphNode[] }) {
    useWorkspaceShotPricing({ nodes, edges: template.edges, capabilities, mockMode });
    return null;
  }

  try {
    await act(async () => root.render(React.createElement(Fixture, { nodes: liveNodes, mockMode: false })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.ok(preflightRequests > 0, 'the fixture must exercise remote video pricing');
    const initialRequestCount = preflightRequests;

    const measuredNodes = liveNodes.map((node) => ({
      ...node,
      measured: { width: 320, height: 180 },
    }));
    await act(async () => root.render(React.createElement(Fixture, { nodes: measuredNodes, mockMode: false })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));

    assert.equal(
      preflightRequests,
      initialRequestCount,
      'a dimensions-only node update must not restart the identical debounced preflight'
    );

    const changedNodes = measuredNodes.map((node) => node.data.kind === 'shot' && node.data.shot
      ? { ...node, data: { ...node.data, shot: { ...node.data.shot, durationSec: node.data.shot.durationSec + 1 } } }
      : node);
    await act(async () => root.render(React.createElement(Fixture, { nodes: changedNodes, mockMode: false })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.ok(
      preflightRequests > initialRequestCount,
      'a pricing-relevant duration change must still dispatch a fresh preflight'
    );
    const changedRequestCount = preflightRequests;

    await act(async () => root.render(React.createElement(Fixture, { nodes: changedNodes, mockMode: true })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.equal(preflightRequests, changedRequestCount, 'mock mode must not call the billable pricing preflight');

    await act(async () => root.render(React.createElement(Fixture, { nodes: template.nodes, mockMode: false })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.equal(preflightRequests, changedRequestCount, 'local sample media must be rejected before live preflight');
  } finally {
    globalThis.fetch = previousFetch;
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
