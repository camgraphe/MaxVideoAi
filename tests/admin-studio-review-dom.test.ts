import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { StudioReviewReveal } from '../frontend/app/(core)/admin/studio/_components/StudioReviewReveal.client';

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
