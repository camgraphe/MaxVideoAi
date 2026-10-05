import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  normalizeTimelineExportClientJob,
  useExportController,
} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_controllers/useExportController';
import { resolveStudioCopy } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import { parseWorkspaceTimelineExportSession } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-export-session';
import type { WorkspaceTimelineRenderManifest } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import type { TimelineExportJobRecord } from '../frontend/src/server/timeline-exports/repository';

const manifest: WorkspaceTimelineRenderManifest = {
  version: 1,
  source: 'maxvideoai-editor',
  projectName: 'Film',
  sequenceId: 'main',
  sequenceName: 'Main',
  projectSettings: { aspectRatio: '16:9', resolution: '720p', fps: 30 },
  createdAt: '2026-10-02T10:00:00Z',
  status: 'ready',
  durationSec: 12,
  exportRange: { mode: 'sequence', startSec: 0, endSec: 12, durationSec: 12 },
  tracks: [],
  issues: [],
};
const paidBilling = { amountCents: 50, currency: 'USD', billingKind: 'paid' } as const;
const paidJob = {
  id: 'paid-export',
  status: 'queued',
  progress: 0,
  message: null,
  artifact: null,
  billing: paidBilling,
};
const sessionKey = 'maxvideoai.editor.timelineExportSession.v1.pricing-recovery';
const copy = resolveStudioCopy({} as any);

test('a paid resume with a lost acknowledgement recovers actual billing instead of its rejected free quote', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
  const posts: any[] = [];
  const reservedJobs = new Map<string, typeof paidJob>();
  let state!: ReturnType<typeof useExportController>;
  let recoveredJobs: any[] = [];
  const onNotice = () => {};
  const fetchFixture = async (url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (url.endsWith('/estimate')) {
      const paid = posts.length > 0;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          estimate: { amountCents: paid ? 50 : 0, currency: 'USD', billingKind: paid ? 'paid' : 'free', freeExportsRemaining: paid ? 0 : 1 },
          estimateToken: paid ? 'paid-authorization' : 'free-authorization',
        }),
      };
    }
    if (url === '/api/studio/timeline-exports' && options?.method === 'POST') {
      posts.push(body);
      if (posts.length === 1) {
        return { ok: false, json: async () => ({ ok: false, error: 'EXPORT_ESTIMATE_CHANGED', reestimate: true }) };
      }
      assert.equal(body.estimateToken, 'paid-authorization');
      const key = body.request.idempotencyKey;
      if (!reservedJobs.has(key)) {
        reservedJobs.set(key, paidJob);
        throw new TypeError('Paid export acknowledgement lost');
      }
      // Reused reservations return no new top-level billing reservation.
      return { ok: true, json: async () => ({ ok: true, export: reservedJobs.get(key), billing: null, reused: true }) };
    }
    return { ok: false, json: async () => ({ ok: false }) };
  };
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: fetchFixture })) {
    previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  function Fixture() {
    state = useExportController({ manifest, projectId: 'pricing-recovery', qualityPreset: 'draft', copy: copy.exportDialog, notices: copy.notices, onNotice, recoveredJobs });
    return null;
  }
  let root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => act(async () => root.render(React.createElement(Fixture)));
  try {
    await render();
    await act(async () => state.openExportDialog());
    assert.equal(state.exportEstimate?.amountCents, 0);
    await act(async () => state.exportTimelineVideo());
    assert.equal(state.exportEstimate?.amountCents, 50, 'the explicit resume authorizes the changed price');
    await act(async () => state.exportTimelineVideo());
    assert.equal(state.activeExportJob, null);
    assert.equal(state.submissionPending, true);
    const pendingSession = dom.window.localStorage.getItem(sessionKey)!;
    await act(async () => state.exportTimelineVideo());
    assert.equal(state.activeExportJob?.id, 'paid-export');
    assert.equal(state.exportEstimate?.amountCents, 50, 'actual reused-job billing wins over the rejected original free quote');
    assert.equal(state.exportEstimate?.billingKind, 'paid');
    assert.equal(reservedJobs.size, 1, 'resume cannot create another reservation');
    assert.equal(posts.length, 3);
    assert.deepEqual(posts[2].request, posts[1].request, 'lost acknowledgement retry preserves manifest, quality and identity');
    await act(async () => root.unmount());
    root = createRoot(dom.window.document.getElementById('root')!);
    await render();
    assert.equal(state.exportEstimate?.amountCents, 50, 'reload retains the accepted paid amount');
    assert.equal(posts.length, 3, 'reload does not submit another reservation');
    await act(async () => root.unmount());
    dom.window.localStorage.setItem(sessionKey, pendingSession);
    recoveredJobs = [{ ...normalizeTimelineExportClientJob(paidJob), idempotencyKey: posts[1].request.idempotencyKey }];
    root = createRoot(dom.window.document.getElementById('root')!);
    await render();
    assert.equal(state.exportEstimate?.amountCents, 50, 'owned history recovery also uses actual billing');
    assert.equal(state.submissionPending, false);
    assert.equal(posts.length, 3, 'history recovery does not POST');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of previousGlobals) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('export job normalization and session reload retain actual billing', () => {
  const job = normalizeTimelineExportClientJob(paidJob)!;
  assert.deepEqual(job.billing, paidBilling);
  const restored = parseWorkspaceTimelineExportSession(JSON.stringify({
    activeJob: job,
    idempotencyKey: 'paid-recovery-key',
    submittedManifests: { 'paid-export': manifest },
    submittedEstimate: { ...paidBilling, freeExportsRemaining: 0 },
  }))!;
  assert.deepEqual(restored.activeJob?.billing, paidBilling);
  assert.equal(restored.submittedEstimate?.amountCents, 50);
});

test('an inline retry of a failed free export displays its fresh paid authorization', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
  const posts: any[] = [];
  let state!: ReturnType<typeof useExportController>;
  const onNotice = () => {};
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (url: string, options?: RequestInit) => {
    if (url.endsWith('/estimate')) {
      const paid = posts.length > 0;
      return { ok: true, json: async () => ({ ok: true, estimate: { amountCents: paid ? 50 : 0, currency: 'USD', billingKind: paid ? 'paid' : 'free', freeExportsRemaining: paid ? 0 : 1 }, estimateToken: paid ? 'paid-authorization' : 'free-authorization' }) };
    }
    if (url === '/api/studio/timeline-exports' && options?.method === 'POST') {
      const body = JSON.parse(String(options.body));
      posts.push(body);
      if (posts.length === 1) return { ok: false, json: async () => ({ ok: false, error: 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED', export: { ...paidJob, id: 'failed-free-export', status: 'failed', billing: { amountCents: 0, currency: 'USD', billingKind: 'free' } } }) };
      assert.equal(body.estimateToken, 'paid-authorization');
      return { ok: true, json: async () => ({ ok: true, export: paidJob, reused: false }) };
    }
    return { ok: false, json: async () => ({ ok: false }) };
  } })) {
    previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  function Fixture() {
    state = useExportController({ manifest, projectId: 'pricing-recovery', qualityPreset: 'draft', copy: copy.exportDialog, notices: copy.notices, onNotice });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => state.openExportDialog());
    await act(async () => state.exportTimelineVideo());
    assert.equal(state.activeExportJob?.status, 'failed');
    assert.equal(state.isExportDialogOpen, true);
    assert.equal(state.isExportEstimateReady, true);
    assert.equal(state.exportEstimate?.amountCents, 50, 'the retry action must show the newly authorized amount rather than failed-job billing');
    await act(async () => state.exportTimelineVideo());
    assert.notEqual(posts[1].request.idempotencyKey, posts[0].request.idempotencyKey);
    assert.equal(state.activeExportJob?.id, 'paid-export');
    assert.equal(state.exportEstimate?.amountCents, 50);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of previousGlobals) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('owned export response projects the stored charge without exposing another owner or private job fields', async () => {
  const { timelineExportJobResponse, ownedTimelineExportJobResponse } = await import('../frontend/src/server/timeline-exports/media-access');
  const job: TimelineExportJobRecord = {
    id: 'paid-export', user_id: 'owner', idempotency_key: 'private-recovery-key', project_name: 'Film',
    status: 'queued', progress: 0, message: null, duration_sec: 12, resolution: '720p', fps: 30,
    quality_preset: 'draft', amount_cents: 50, currency: 'USD', billing_kind: 'paid', billing_status: 'paid_reserved',
    render_manifest: manifest, export_settings: { qualityPreset: 'draft', includeAudio: true },
    output_url: null, output_asset_id: null, output_size_bytes: null, output_mime_type: null,
    created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z',
  };
  const before = JSON.stringify(job);
  assert.deepEqual(timelineExportJobResponse(job).billing, paidBilling);
  const executor = { query: async <T>(): Promise<T[]> => { throw new Error('Queued billing projection must not query storage or the database'); } };
  const response = await ownedTimelineExportJobResponse(job, 'owner', executor);
  assert.deepEqual(response.billing, paidBilling);
  assert.equal(response.artifact, null);
  for (const field of ['user_id', 'idempotency_key', 'render_manifest', 'export_settings']) assert.equal(field in response, false);
  await assert.rejects(ownedTimelineExportJobResponse(job, 'other', executor), /EXPORT_NOT_FOUND/);
  await assert.rejects(ownedTimelineExportJobResponse(job, '', executor), /EXPORT_NOT_FOUND/);
  assert.equal(JSON.stringify(job), before);
});
