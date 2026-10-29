import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

test('shared reviewer reveals on demand, keeps failed notes and records explicit human feedback', async () => {
  const ui = await import('../frontend/app/(core)/admin/assistants/_components/AssistantReview.client').catch(() => null);
  assert.ok(ui?.AssistantReview, 'A review UI is required');
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/assistants' });
  const scope = { source: 'composer' as const, userId: 'owner', scopeId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534' };
  const requests: Record<string, unknown>[] = [], prior = new Map<string, PropertyDescriptor | undefined>();
  const detail = { item: { ...scope, createdAt: '2026-10-29T12:00:00Z', state: 'complete', surface: 'video', mediaModel: 'wan-3', assistantModel: 'gpt-6.1-terra' }, accessId: 'audit-one',
    message: 'A blue boat', reply: '<script>unsafe</script>', proposal: 'The complete proposed prompt', evidence: [], limitations: ['Historical context may be missing.'], annotations: { status: 'available', items: [], truncated: false } };
  let rejectSave = true;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (_url: string, options: RequestInit) => { const body = JSON.parse(options.body as string); requests.push(body); return new Response(JSON.stringify(body.action === 'reveal' ? { detail } : { annotation: { ...body, actorId: 'admin', createdAt: '2026-10-29T12:00:01Z' } }), { status: body.action === 'annotate' && rejectSave ? 503 : 200 }); } })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const button = (text: string) => Array.from(dom.window.document.querySelectorAll('button')).find(b => b.textContent === text)!;
  try {
    await React.act(async () => root.render(React.createElement(ui.AssistantReview, { scope })));
    assert.equal(requests.length, 0); assert.doesNotMatch(dom.window.document.body.textContent!, /A blue boat/);
    await React.act(async () => button('Reveal recorded content').click());
    assert.match(dom.window.document.body.textContent!, /A blue boat|The complete proposed prompt/);
    assert.equal(dom.window.document.querySelector('script'), null);
    assert.match(dom.window.document.body.textContent!, /unsafe/);
    await React.act(async () => {
      const note = dom.window.document.querySelector('textarea')!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(note, 'Wrong duration');
      note.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await React.act(async () => button('Save review').click());
    assert.match(dom.window.document.body.textContent!, /could not be saved/i);
    const firstSave = requests.at(-1)!;
    rejectSave = false;
    await React.act(async () => button('Save review').click());
    assert.equal(requests.at(-1)!.id, firstSave.id, 'An unchanged failed save keeps its idempotency identity');
    assert.match(dom.window.document.body.textContent!, /Review saved/i);
    await React.act(async () => button('Hide content').click());
    assert.doesNotMatch(dom.window.document.body.textContent!, /A blue boat|The complete proposed prompt/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
