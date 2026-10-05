import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { StudioReviewReveal } from '../frontend/app/(core)/admin/studio/_components/StudioReviewReveal.client';
import { AdminStudioList } from '../frontend/app/(core)/admin/studio/_components/AdminStudioList';
import { AdminStudioDetail } from '../frontend/app/(core)/admin/studio/_components/AdminStudioDetail';

const scope = { userId:'owner',projectId:'film',requestId:'a1bd8c76-7171-4f53-92f7-b0d7e418f534' };
test('admin content stays hidden until an explicit reveal and visible text is escaped', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/admin/studio'});
  const prior = new Map<string, PropertyDescriptor | undefined>();
  const requests: unknown[] = [];
  const unavailable = {status:'unavailable',items:[],truncated:false};
  const detail = {turn:{...scope,state:'ready',attempts:1,createdAt:'2026-10-03T12:00:00Z',quoteId:null},message:'A quiet product film.',reply:'<script>alert("unsafe")</script>',actions:unavailable,responses:unavailable,legacyUsage:unavailable,assistance:unavailable,accessId:'audit-id',coverage:'partial'};
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,React,IS_REACT_ACT_ENVIRONMENT:true,fetch:async (_url:string,options:RequestInit) => {requests.push(options);return new Response(JSON.stringify({detail}),{status:200,headers:{'content-type':'application/json'}});}})) {
    prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await React.act(async () => root.render(React.createElement(StudioReviewReveal,{scope})));
    assert.equal(requests.length,0);assert.doesNotMatch(dom.window.document.body.textContent!,/A quiet product film/);
    await React.act(async () => dom.window.document.querySelector('button')!.click());
    assert.equal(requests.length,1);
    assert.deepEqual(JSON.parse((requests[0] as RequestInit).body as string),scope);
    assert.equal((requests[0] as RequestInit).method,'POST');
    assert.match(dom.window.document.body.textContent!,/A quiet product film/);
    assert.match(dom.window.document.body.textContent!,/<script>alert/);
    assert.equal(dom.window.document.querySelector('script'),null);
    assert.match(dom.window.document.body.textContent!,/evidence source is unavailable/);
    await React.act(async () => dom.window.document.querySelector('button')!.click());
    assert.doesNotMatch(dom.window.document.body.textContent!,/A quiet product film/);
  } finally {
    await React.act(async () => root.unmount());dom.window.close();
    for(const [key,descriptor] of prior){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});

test('admin list and detail distinguish a saved reply from a request that needs continuation without revealing content', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/studio' });
  const prior = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const turn = { ...scope, state: 'ready', attempts: 4, createdAt: '2026-10-05T12:00:00Z', quoteId: null, incomplete: true, continuationReason: 'action_limit' as const };
  try {
    await React.act(async () => root.render(React.createElement(AdminStudioList, { data: { status: 'available', turns: [turn], hasMore: true }, filter: { page: 0, limit: 1, completion: 'incomplete' } })));
    const rowText = dom.window.document.querySelector('tbody tr')!.textContent!;
    assert.match(rowText, /Reply saved/);
    assert.match(rowText, /Needs continuation.*action limit/i);
    assert.doesNotMatch(rowText, /Succeeded|Preparation complete/);
    assert.equal((dom.window.document.querySelector('select[name="completion"]') as HTMLSelectElement).value, 'incomplete');
    const next = [...dom.window.document.querySelectorAll('a')].find(link => link.textContent === 'Next');
    assert.equal(new URL(next!.href).searchParams.get('completion'), 'incomplete');
    await React.act(async () => root.render(React.createElement(AdminStudioDetail, { turn })));
    assert.match(dom.window.document.body.textContent!, /Reply saved/);
    assert.match(dom.window.document.body.textContent!, /Needs continuation.*action limit/i);
    assert.ok([...dom.window.document.querySelectorAll('button')].some(button => button.textContent === 'Reveal recorded content'));
    assert.doesNotMatch(dom.window.document.body.textContent!, /PARAMETER_INVALID|NEVER|Succeeded/);
    await React.act(async () => root.render(React.createElement(AdminStudioList, { data: { status: 'available', turns: [{ ...turn, incomplete: false, continuationReason: null }], hasMore: false }, filter: { page: 0, limit: 50 } })));
    assert.match(dom.window.document.querySelector('tbody tr')!.textContent!, /No continuation recorded/);
    assert.doesNotMatch(dom.window.document.querySelector('tbody tr')!.textContent!, /Succeeded|Preparation complete/);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
