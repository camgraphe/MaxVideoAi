import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {useExportController,normalizeTimelineExportClientJob} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_controllers/useExportController';
import {resolveStudioCopy} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {WorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';

const original: WorkspaceTimelineRenderManifest = {version: 1,source: 'maxvideoai-editor',projectName: 'Film',sequenceId: 'main',sequenceName: 'Main',projectSettings: {aspectRatio: '16:9',resolution: '720p',fps: 30},createdAt: '2026-10-02T10:00:00Z',status: 'ready',durationSec: 12,exportRange: {mode: 'sequence',startSec: 0,endSec: 12,durationSec: 12},tracks: [],issues: []};
const copy = resolveStudioCopy({} as any);
const sessionKey = 'maxvideoai.editor.timelineExportSession.v1.project-a';

test('lost export acknowledgement preserves the immutable submission across reopen and reconciles one owned reservation',async () => {
  const dom = new JSDOM('<div id="root"></div>',{url: 'http://localhost/'});
  const old = new Map<string,PropertyDescriptor | undefined>();
  const posts: any[] = [];
  const jobs = new Map<string,any>();
  let dropAck = true;
  let estimates = 0;
  for (const [key,value] of Object.entries({window: dom.window,document: dom.window.document,navigator: dom.window.navigator,IS_REACT_ACT_ENVIRONMENT: true,fetch: async (url: string,options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (url.endsWith('/estimate')) {estimates++;return {ok: true,json: async () => ({ok: true,estimate: {amountCents: estimates === 1 ? 0 : 50,currency: 'USD',billingKind: estimates === 1 ? 'free' : 'paid',freeExportsRemaining: estimates === 1 ? 1 : 0},estimateToken: 'exact-token'})};}
    if (options?.method === 'POST') {
      posts.push(body.request);
      const key = body.request.idempotencyKey;
      if (!jobs.has(key)) jobs.set(key,{id: 'owned-job',status: 'queued',progress: 0,idempotencyKey: key});
      if (dropAck) {dropAck = false;throw new TypeError('Acknowledgement lost');}
      return {ok: true,json: async () => ({ok: true,export: jobs.get(key),reused: true})};
    }
    return {ok: false,json: async () => ({ok: false})};
  }})) {old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable: true,configurable: true});}
  let state!: ReturnType<typeof useExportController>;
  let manifest = original;
  let quality: 'draft'|'high' = 'draft';
  let recoveredJobs: any[] = [];
  const onNotice = () => {};
  function Fixture() {state = useExportController({manifest,projectId: 'project-a',qualityPreset: quality,copy: copy.exportDialog,notices: copy.notices,onNotice,recoveredJobs});return null;}
  let root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => act(async () => root.render(React.createElement(Fixture)));
  try {
    await render();await act(async () => state.openExportDialog());
    assert.equal(state.isExportEstimateReady,true);
    await act(async () => state.exportTimelineVideo());
    assert.equal(jobs.size,1);
    assert.equal(state.activeExportJob,null,'a lost acknowledgement is not a known terminal failure');
    assert.equal(state.submittedExportEstimate?.amountCents,0,'retain the original display quote while fresh retry authorization may change');
    const saved = dom.window.localStorage.getItem(sessionKey)!;
    assert.ok(JSON.parse(saved).pendingSubmission,'freeze the accepted request before posting');
    await act(async () => root.unmount());
    manifest = {...original,projectName: 'Changed after submission',durationSec: 7};
    quality = 'high';
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.submittedExportEstimate?.amountCents,0,'a reload cannot replace the original price before reconciliation');
    await act(async () => state.openExportDialog());
    await act(async () => state.exportTimelineVideo());
    assert.equal(jobs.size,1,'only one job and paid reservation');
    assert.deepEqual(posts[1],posts[0],'retry original manifest, preset and identity after reopening');
    assert.equal(state.activeExportJob?.id,'owned-job');
    assert.equal(state.submittedExportEstimate?.amountCents,0,'recover the original free price after an idempotent resume');
    await act(async () => root.unmount());
    dom.window.localStorage.setItem(sessionKey,saved);
    const savedJob = jobs.values().next().value;
    recoveredJobs = [{...normalizeTimelineExportClientJob({...savedJob,status: 'completed',artifact: {outputUrl: '/api/studio/timeline-exports/owned-job/media',canonicalOriginalUrl: 'https://media.test/film.mp4',outputAssetId: 'owned-asset'}}),idempotencyKey:savedJob.idempotencyKey}];
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.activeExportJob?.id,'owned-job');
    assert.equal(state.activeExportJob?.status,'completed');
    assert.deepEqual(state.submittedExportManifest,original);
    assert.equal(posts.length,2,'owned history reconciles the lost acknowledgement without a third POST');
    assert.equal(JSON.parse(dom.window.localStorage.getItem(sessionKey)!).pendingSubmission,null);
    assert.equal(state.activeExportJob?.canonicalOriginalUrl,'https://media.test/film.mp4');
    assert.equal(state.activeExportJob?.outputAssetId,'owned-asset');
    await act(async () => root.unmount());
    recoveredJobs = [];
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.activeExportJob?.outputUrl,'/api/studio/timeline-exports/owned-job/media');
    assert.equal(state.activeExportJob?.canonicalOriginalUrl,'https://media.test/film.mp4');
    assert.equal(state.activeExportJob?.outputAssetId,'owned-asset');
    assert.equal(posts.length,2,'completed session reload never charges or dispatches again');
    assert.doesNotMatch(dom.window.localStorage.getItem(sessionKey)!,/X-Amz-/);
  } finally {await act(async () => root.unmount());dom.window.close();for (const [key,value] of old) {if (value) Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});

test('the confirmed export keeps its price through rendering and reload; a new dialog requests the next price',async () => {
  const dom = new JSDOM('<div id="root"></div>',{url: 'http://localhost/'});
  const old = new Map<string,PropertyDescriptor | undefined>();
  let estimates = 0;
  let manifest = original;
  let recoveredJobs: any[] = [];
  for (const [key,value] of Object.entries({window: dom.window,document: dom.window.document,navigator: dom.window.navigator,IS_REACT_ACT_ENVIRONMENT: true,fetch: async (url: string,options?: RequestInit) => {
    if (url.endsWith('/estimate')) {
      estimates++;
      return {ok: true,json: async () => ({ok: true,estimate: {amountCents: estimates === 1 ? 0 : 50,currency: 'USD',billingKind: estimates === 1 ? 'free' : 'paid',freeExportsRemaining: estimates === 1 ? 1 : 0},estimateToken: `token-${estimates}`})};
    }
    if (options?.method === 'POST') return {ok: true,json: async () => ({ok: true,export: {id: 'free-job',status: 'queued',progress: 0}})};
    return {ok: false,json: async () => ({ok: false})};
  }})) {old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable: true,configurable: true});}
  let state!: ReturnType<typeof useExportController>;
  const onNotice = () => {};
  function Fixture() {state = useExportController({manifest,projectId: 'project-a',qualityPreset: 'draft',copy: copy.exportDialog,notices: copy.notices,onNotice,recoveredJobs});return null;}
  let root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => act(async () => root.render(React.createElement(Fixture)));
  try {
    await render();await act(async () => state.openExportDialog());
    assert.equal(state.exportEstimate?.amountCents,0);
    await act(async () => state.exportTimelineVideo());
    manifest = {...original,createdAt: '2026-10-02T11:00:00Z',durationSec: 7};
    await render();
    assert.equal(state.exportEstimate?.amountCents,0,'an accepted free render cannot display the next paid quote');
    assert.equal(estimates,1,'do not recalculate an accepted reservation');
    assert.equal(state.submissionManifest.durationSec,12,'the dialog describes the submitted cut');
    await act(async () => root.unmount());
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    await act(async () => state.openExportDialog());
    assert.equal(state.exportEstimate?.amountCents,0,'restore the confirmed price with the queued job');
    assert.equal(estimates,1,'reopening a queued job does not request a new quote');
    const saved = JSON.parse(dom.window.localStorage.getItem(sessionKey)!);
    saved.activeJob.status = 'completed';saved.activeJob.progress = 100;
    await act(async () => root.unmount());
    dom.window.localStorage.setItem(sessionKey,JSON.stringify(saved));
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.exportEstimate?.amountCents,0,'completion retains the accepted price');
    await act(async () => state.openExportDialog());
    assert.equal(state.activeExportJob,null,'opening a new export starts a fresh confirmation');
    assert.equal(state.exportEstimate?.amountCents,50);
    assert.equal(state.submissionManifest.durationSec,7);
    assert.equal(estimates,2,'only the explicitly reopened export requests the next quote');
    await act(async () => root.unmount());
    saved.activeJob.status = 'failed';saved.activeJob.progress = 0;
    dom.window.localStorage.setItem(sessionKey,JSON.stringify(saved));
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.submissionManifest.durationSec,7,'a failed render retry uses the current cut');
    await act(async () => state.openExportDialog());
    assert.notEqual(JSON.parse(dom.window.localStorage.getItem(sessionKey)!).idempotencyKey,saved.idempotencyKey,'failed retries have a fresh reservation identity');
  } finally {await act(async () => root.unmount());dom.window.close();for (const [key,value] of old) {if (value) Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});
