import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useWorkspaceShotPricing } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing';
import { getWorkspaceModelCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { submitWorkspaceGenerationByFamily } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing';
import { notifyCustomerPricingRefresh } from '../frontend/lib/customer-tariff-revision';

test('Studio audio displays the server quote and reuses the actual generation request', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'https://local.test/app/studio/workspace' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const previousFetch = globalThis.fetch;
  const requests: Record<string, unknown>[] = [];
  let submitted: Record<string, unknown> | null = null;
  const pricing = { totalCents: 432, currency: 'USD', meta: {} };
  globalThis.fetch = async (url, options) => {
    if (String(url) === '/api/member-status') return Response.json({ tier: 'Member' });
    if (String(url) === '/api/audio/quote') {
      requests.push(JSON.parse(String(options?.body)));
      return Response.json({ ok: true, pricing, inputKey: 'server-audio-key', expiresAt: Date.now() + 60000 });
    }
    if (String(url) === '/api/audio/generate') {
      submitted = JSON.parse(String(options?.body));
      return Response.json({ ok: true, outputKind: 'audio', status: 'completed', audioUrl: 'https://cdn.example.test/audio.wav' });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const settings = getWorkspaceBlockPreset('audio-voiceover')!.defaultShot!;
  const nodes = [
    { id: 'prompt', position: { x: 0, y: 0 }, data: { kind: 'prompt', promptText: 'Read this current server quote.' } },
    { id: 'voice', position: { x: 1, y: 1 }, data: { kind: 'shot', shot: settings } },
  ] as never;
  const edges = [{ id: 'edge', source: 'prompt', target: 'voice', sourceHandle: 'prompt', targetHandle: 'prompt', data: { kind: 'prompt' } }] as never;
  const root = createRoot(dom.window.document.getElementById('root')!);
  let result: ReturnType<typeof useWorkspaceShotPricing> = {};
  function Fixture() { result = useWorkspaceShotPricing({ nodes, edges, capabilities: getWorkspaceModelCapabilities(), mockMode: false }); return null; }
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.equal(requests.length, 1, 'live audio requires a server quote');
    assert.equal(requests[0].pack, 'voice_only');
    assert.equal(requests[0].script, 'Read this current server quote.');
    assert.equal(result.voice.totalCents, 432);
    assert.equal(result.voice.pricing?.meta?.studioAudioQuote && (result.voice.pricing.meta.studioAudioQuote as { inputKey: string }).inputKey, 'server-audio-key');
    await submitWorkspaceGenerationByFamily({ nodes, edges, shotNode: nodes[1], settings, capability: null,
      prompt: 'Read this current server quote.', outputName: 'voice', connectedInputs: ['prompt'],
      resolvedWorkflowType: settings.workflowType, submissionId: 'test', pricingSnapshot: result.voice.pricing });
    assert.equal((submitted!.expectedQuote as { inputKey: string }).inputKey, 'server-audio-key');
    assert.equal((submitted!.expectedQuote as { totalCents: number }).totalCents, 432);
    await act(async () => notifyCustomerPricingRefresh('PRICING_REFRESH_REQUIRED'));
    assert.equal(result.voice.status, 'loading');
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 380)));
    assert.equal(requests.length, 2, 'a stale generation quote causes a fresh server estimate');
  } finally {
    globalThis.fetch = previousFetch;
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
