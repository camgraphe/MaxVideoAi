import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {useExportController} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useExportController';
import {resolveStudioCopy} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {WorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

const original: WorkspaceTimelineRenderManifest = {version: 1,source: 'maxvideoai-editor',projectName: 'Film',sequenceId: 'main',sequenceName: 'Main',projectSettings: {aspectRatio: '16:9',resolution: '720p',fps: 30},createdAt: '2026-10-02T10:00:00Z',status: 'ready',durationSec: 12,exportRange: {mode: 'sequence',startSec: 0,endSec: 12,durationSec: 12},tracks: [],issues: []};
const copy = resolveStudioCopy({} as any);
const sessionKey = 'maxvideoai.editor.timelineExportSession.v1.project-a';

test('lost export acknowledgement preserves the immutable submission across reopen and reconciles one owned reservation',async () => {
  const dom = new JSDOM('<div id="root"></div>',{url: 'http://localhost/'});
  const old = new Map<string,PropertyDescriptor | undefined>();
  const posts: any[] = [];
  const jobs = new Map<string,any>();
  let dropAck = true;
  for (const [key,value] of Object.entries({window: dom.window,document: dom.window.document,navigator: dom.window.navigator,IS_REACT_ACT_ENVIRONMENT: true,fetch: async (url: string,options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (url.endsWith('/estimate')) return {ok: true,json: async () => ({ok: true,estimate: {amountCents: 23,currency: 'USD',billingKind: 'paid'},estimateToken: 'exact-token'})};
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
    const saved = dom.window.localStorage.getItem(sessionKey)!;
    assert.ok(JSON.parse(saved).pendingSubmission,'freeze the accepted request before posting');
    await act(async () => root.unmount());
    manifest = {...original,projectName: 'Changed after submission',durationSec: 7};
    quality = 'high';
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    await act(async () => state.openExportDialog());
    await act(async () => state.exportTimelineVideo());
    assert.equal(jobs.size,1,'only one job and paid reservation');
    assert.deepEqual(posts[1],posts[0],'retry original manifest, preset and identity after reopening');
    assert.equal(state.activeExportJob?.id,'owned-job');
    await act(async () => root.unmount());
    dom.window.localStorage.setItem(sessionKey,saved);
    recoveredJobs = [{...jobs.values().next().value,status: 'completed',outputUrl: 'https://media.test/film.mp4'}];
    root = createRoot(dom.window.document.getElementById('root')!);await render();
    assert.equal(state.activeExportJob?.id,'owned-job');
    assert.equal(state.activeExportJob?.status,'completed');
    assert.deepEqual(state.submittedExportManifest,original);
    assert.equal(posts.length,2,'owned history reconciles the lost acknowledgement without a third POST');
    assert.equal(JSON.parse(dom.window.localStorage.getItem(sessionKey)!).pendingSubmission,null);
  } finally {await act(async () => root.unmount());dom.window.close();for (const [key,value] of old) {if (value) Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});
