import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { JOBS_SOURCES } from '../frontend/app/(core)/jobs/_lib/jobs-page-types';
import { activityGroupStatus, activityLoadedJobs, filterActivityGroups } from '../frontend/app/(core)/jobs/_lib/jobs-activity';
import { resolveGroupLibrarySavePayload } from '../frontend/app/(core)/jobs/_lib/jobs-page-helpers';
import { groupJobsIntoSummaries } from '../frontend/lib/job-groups';
import type { Job } from '../frontend/types/jobs';

test('Activity exposes every supported source and filters real grouped status without changing order', () => {
  assert.deepEqual([...JOBS_SOURCES], ['all', 'video', 'image', 'audio', 'storyboard', 'character', 'angle', 'upscale', 'background-removal']);
  const jobs = ['pending', 'completed', 'failed'].map((status, index) => ({ jobId: `job-${index}`, engineLabel: 'Test', durationSec: 4, prompt: '', createdAt: `2026-09-07T12:0${index}:00Z`, status, videoUrl: status === 'completed' ? 'https://example.invalid/output.mp4' : undefined })) as Job[];
  const { groups } = groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true });
  assert.equal(filterActivityGroups(groups, 'all'), groups);
  for (const status of ['pending', 'completed', 'failed'] as const) {
    assert.equal(filterActivityGroups(groups, status).length, 1);
    assert.equal(activityGroupStatus(filterActivityGroups(groups, status)[0]), status);
  }
});

test('real SWR feed isolates source/account transitions, resets pagination, refreshes and applies status events', async () => {
  const frontend = path.join(process.cwd(), 'frontend');
  const stubs: Record<string, string> = {
    '@/lib/authFetch': `export const authFetch = (url) => window.fixtureFetch(url);`,
    '@/lib/last-known': `export const readLastKnownUserId = () => window.fixtureUser; export const writeLastKnownUserId = (id) => { window.fixtureUser = id; };`,
    '@/lib/supabase-session-hint': `export const hasSupabaseAuthCookie = () => true;`,
    '@/lib/supabaseClient': `export const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: window.fixtureUser } } } }), onAuthStateChange: (fn) => { window.fixtureAuth = fn; return { data: { subscription: { unsubscribe() {} } } }; } } };`,
    '@/lib/api-job-status': `export const clearMissingStatusRetries = () => {}; export const clearStatusRetry = () => {}; export const getStatusRetryMeta = () => null; export const jobHasRenderableMedia = (job) => Boolean(job.videoUrl); export const scheduleStatusRetry = () => {};`,
  };
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"test"' }, tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'jobs-host-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import { SWRConfig } from 'swr';
      import { useInfiniteJobs } from './lib/api-jobs';
      window.IS_REACT_ACT_ENVIRONMENT = true;
      window.fixtureUser = 'account-a';
      window.requests = [];
      window.frames = [];
      window.held = null;
      window.fail = false;
      window.revision = 0;
      window.fixtureFetch = async (url) => {
        const user = window.fixtureUser;
        window.requests.push(url);
        if (window.hold) await new Promise(resolve => { window.held = resolve; });
        const params = new URL(url, 'http://localhost').searchParams;
        const surface = params.get('surface') || 'all';
        const cursor = params.get('cursor');
        return { ok: !window.fail, status: window.fail ? 503 : 200, json: async () => window.fail ? { error: 'Offline' } : ({ ok: true, jobs: [{
          jobId: user + '-' + surface + '-' + (cursor || 'first'), surface: surface === 'all' ? 'video' : surface,
          engineLabel: 'Fixture', durationSec: 5, prompt: 'Revision ' + window.revision,
          createdAt: cursor ? '2026-09-07T11:00:00Z' : '2026-09-07T12:00:00Z', status: 'pending'
        }], nextCursor: cursor ? null : 'older' }) };
      };
      let source = 'all';
      const cache = new Map();
      function Fixture() {
        window.feed = useInfiniteJobs(24, { surface: source });
        window.frames.push({ source, user: window.fixtureUser, ids: window.feed.stableJobs.map(job => job.jobId) });
        return null;
      }
      const root = createRoot(document.getElementById('root'));
      const render = () => root.render(<SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}><Fixture /></SWRConfig>);
      window.fixture = { act, render, source(value) { source = value; render(); }, unmount() { root.unmount(); } };
    ` },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/jobs', runScripts: 'dangerously' });
  (dom.window as any).MessageChannel = class {
    port1 = { onmessage: () => {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  };
  dom.window.eval(bundle.outputFiles[0].text);
  const w = dom.window as any;
  const settle = async () => { await w.fixture.act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
  try {
    await w.fixture.act(async () => w.fixture.render()); await settle();
    assert.equal(w.requests.length, 1);
    assert.equal(w.requests[0], '/api/jobs?limit=24');
    assert.equal(w.feed.stableJobs[0].jobId, 'account-a-all-first');
    await w.fixture.act(async () => { await w.feed.setSize(2); }); await settle();
    assert.equal(w.feed.stableJobs.length, 2);
    assert.ok(w.requests.some((url: string) => url.includes('cursor=older')));
    w.hold = true;
    await w.fixture.act(async () => w.fixture.source('background-removal'));
    assert.equal(w.feed.stableJobs.length, 0, 'previous source must disappear before effects settle');
    assert.equal(w.feed.size, 1);
    w.hold = false;
    await w.fixture.act(async () => w.held()); await settle();
    assert.equal(w.feed.stableJobs.length, 1);
    assert.equal(w.feed.stableJobs[0].surface, 'background-removal');
    w.hold = true;
    await w.fixture.act(async () => w.fixtureAuth('SIGNED_IN', { user: { id: 'account-b' } }));
    assert.equal(w.feed.stableJobs.length, 0, 'previous account must disappear before effects settle');
    w.hold = false;
    await w.fixture.act(async () => w.held()); await settle();
    assert.equal(w.feed.stableJobs[0].jobId, 'account-b-background-removal-first');
    const id = w.feed.stableJobs[0].jobId;
    await w.fixture.act(async () => w.dispatchEvent(new w.CustomEvent('jobs:status', { detail: { jobId: id, status: 'completed', videoUrl: 'https://example.invalid/original.mp4' } })));
    assert.equal(w.feed.stableJobs[0].status, 'completed');
    w.revision = 2;
    await w.fixture.act(async () => { await w.feed.mutate(); });
    assert.equal(w.feed.stableJobs[0].status, 'completed', 'refresh cannot regress a completed observation');
    await w.fixture.act(async () => w.dispatchEvent(new w.CustomEvent('jobs:hidden', { detail: { jobId: id } })));
    assert.equal(w.feed.stableJobs.length, 0);
    w.fail = true;
    await w.fixture.act(async () => { await w.feed.mutate().catch(() => undefined); });
    assert.equal(w.feed.error.message, 'Offline');
    w.fail = false;
    await w.fixture.act(async () => { await w.feed.mutate(); });
    assert.equal(w.feed.error, undefined);
    assert.equal(w.feed.stableJobs.length, 1);
    for (const source of JOBS_SOURCES) {
      await w.fixture.act(async () => w.fixture.source(source)); await settle();
      assert.equal(w.feed.stableJobs.length, 1);
      assert.equal(w.feed.stableJobs[0].jobId, `account-b-${source}-first`);
      assert.equal(w.feed.size, 1);
    }
    for (const frame of w.frames) for (const jobId of frame.ids) {
      assert.ok(jobId.startsWith(frame.user + '-' + frame.source + '-'), 'no prior account/source in any render frame');
    }
  } finally { await w.fixture.act(async () => w.fixture.unmount()); dom.window.close(); }
});

test('explicitly loaded pages remain reachable beyond the 400-job observation cache', () => {
  const jobs = Array.from({ length: 425 }, (_, index) => ({ jobId: String(index), engineLabel: 'Test', durationSec: 4, prompt: '', createdAt: '2026-09-07', status: 'pending' })) as Job[];
  const stable = jobs.slice(0, 400).map((job) => ({ ...job, status: 'completed' }));
  const loaded = activityLoadedJobs([{ ok: true, jobs, nextCursor: null }], stable);
  assert.equal(loaded.length, 425);
  assert.equal(loaded[0].status, 'completed');
  assert.equal(loaded[424].jobId, '424');
  assert.deepEqual(activityLoadedJobs(undefined, stable), [], 'old cache cannot populate a new unloaded feed');
});

test('Activity saves the original output and never substitutes a display thumbnail', () => {
  const job: Job = { jobId: 'image', surface: 'image', engineLabel: 'Test', durationSec: 0, prompt: '', createdAt: '2026-09-07', status: 'completed', renderIds: ['https://private.example/original.png?signature=exact'], thumbUrl: 'https://private.example/thumbnail.webp' };
  const group = groupJobsIntoSummaries([job], { includeSinglesAsGroups: true }).groups[0];
  assert.equal(resolveGroupLibrarySavePayload(group)?.url, job.renderIds?.[0]);
  const thumbOnly = { ...group, hero: { ...group.hero, originalUrl: null, job: { ...job, renderIds: null } }, members: [] };
  assert.equal(resolveGroupLibrarySavePayload(thumbOnly), null);
});
