import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, webkit, expect, type Route } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { galleryRecallBrowserSource } from './helpers/workspace-gallery-recall-browser-source';
import { sanitizePublicRecreationSnapshot } from '../frontend/server/marketing-media/public-recreation';

const jobs = [
  { jobId: 'job_modify', curated: true, finalPriceCents: 1, engineId: 'wan-3', engineLabel: 'Wan Modify', durationSec: 5,
    aspectRatio: '16:9', prompt: 'Short rail excerpt', createdAt: '2026-10-01T00:00:00Z', status: 'completed' },
  { jobId: 'job_extend', engineId: 'wan-3', engineLabel: 'Wan Extend', durationSec: 8,
    aspectRatio: '16:9', prompt: 'Another short rail excerpt', createdAt: '2026-10-02T00:00:00Z', status: 'completed' },
];
function detail(mode: 'v2v' | 'extend', origin: string) {
  return { ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: mode,
    prompt: mode === 'v2v' ? 'Preserve the portrait framing and original motion.' : 'Continue the scene with the same portrait framing.',
    core: { durationSec: mode === 'v2v' ? 5 : 8, resolution: mode === 'v2v' ? '1080p' : '720p', aspectRatio: '9:16' },
    refs: { inputs: [{ slotId: 'video_url', kind: 'video', assetId: 'synthetic-source', url: origin + '/source.mp4',
      width: 1080, height: 1920, durationSec: 7.5, type: 'video/mp4', size: 4096 }] },
  } };
}

test('gallery recall renders Modify and Extend controls after delayed job detail without losing later edits', { timeout: 180000 }, async () => {
  const harnessSource = (await readFile('tests/helpers/workspace-gallery-recall-harness.ts', 'utf8')).replaceAll('../../frontend/', './');
  const source = harnessSource + '\n' + galleryRecallBrowserSource.replace("import {useGalleryRecallHarness} from '../tests/helpers/workspace-gallery-recall-harness';", '');
  const fixture = await startWorkspaceReferenceFixture({ source, config: { jobs },
    // Only authenticated HTTP transport is synthetic; recall, draft and workflow owners run unchanged.
    hostModules: { '@/lib/authFetch': 'export const authFetch=(url,options)=>fetch(url,options);',
      '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-owned',user:{id:'recall-owner'}}},error:null})}});` },
  });
  const reply = (mode: 'v2v' | 'extend') => mode === 'extend' ? detail(mode, fixture.url) : {
    ok: true, video: { ...jobs[0], id: 'job_modify', recreationSnapshot: sanitizePublicRecreationSnapshot(detail(mode, fixture.url).settingsSnapshot) },
  };
  const evidence = process.env.GALLERY_RECALL_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const browserName of ['chromium', 'webkit'] as const) {
      const browser = await (browserName === 'chromium' ? chromium : webkit).launch({ headless: true });
      try {
        for (const width of [390, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
          const requests: Route[] = [], assetImports: Route[] = [], errors: string[] = [], forbidden: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin === fixture.url && url.pathname === '/api/media-library/ensure' && request.method() === 'POST') {
              assetImports.push(route); return;
            }
            if (request.method() !== 'GET' || url.origin !== fixture.url) {
              forbidden.push(`${request.method()} ${url.origin}`); return route.abort();
            }
            if (/^\/api\/(jobs|videos)\//.test(url.pathname)) { requests.push(route); return; }
            return route.continue();
          });
          await page.goto(fixture.url);
          const state = async () => JSON.parse((await page.locator('[data-state]').textContent())!);
          for (const [index, label, mode, resolution, duration] of [
            [0, 'Wan Modify', 'v2v', '1080p', 5], [1, 'Wan Extend', 'extend', '720p', 8],
          ] as const) {
            const beforeRecall = await state();
            await page.getByRole('button', { name: `Open ${label}`, exact: true }).click();
            await expect.poll(() => requests.length).toBe(index + 1);
            assert.equal(new URL(requests[index].request().url()).pathname, mode === 'v2v' ? '/api/videos/job_modify' : '/api/jobs/job_extend');
            await expect.poll(async () => (await state()).recallPending).toBe(true);
            await expect(page.getByRole('textbox', { name: 'Prompt', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: `Open ${label}`, exact: true })).toBeVisible();
            assert.deepEqual((await state()).form, beforeRecall.form, 'incomplete cards preserve the previous draft while loading');
            await requests[index].fulfill({ json: reply(mode) });
            if (mode === 'v2v') {
              await expect.poll(() => assetImports.length).toBe(1);
              await expect.poll(async () => (await state()).recallPending).toBe(true);
              const payload = assetImports[0].request().postDataJSON();
              assert.equal(payload.publicVideoId, 'job_modify');
              assert.equal(payload.jobId, null);
              await assetImports[0].fulfill({ json: { ok: true, asset: { id: `ma_${'a'.repeat(32)}`, url: payload.url,
                durationSec: 7.5, width: 1080, height: 1920, size: 4096, mime: 'video/mp4' } } });
            }
            await expect.poll(async () => (await state()).recallBlocked).toBe(false);
            await expect(page.locator(`[data-composer-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByRole('textbox', { name: 'Prompt', exact: true })).toHaveValue(detail(mode, fixture.url).settingsSnapshot.prompt);
            await expect.poll(async () => (await state()).form.resolution).toBe(resolution);
            await expect(page.locator('[data-settings-density]')).toBeVisible();
            const current = await state();
            assert.equal(current.form.durationSec, duration); assert.equal(current.form.aspectRatio, '9:16');
            assert.equal(current.assets.video_url[0].url, fixture.url + '/source.mp4');
            if (evidence) await page.screenshot({ path: `${evidence}/${browserName}-${width}-gallery-${mode}.png`, fullPage: true });
          }
          // Same-model gallery selection followed by a real composer edit wins over its older detail response.
          await page.getByRole('button', { name: 'Open Wan Modify', exact: true }).click();
          await expect.poll(() => requests.length).toBe(3);
          await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill('My new edit wins');
          const before = await state();
          await requests[2].fulfill({ json: reply('v2v') });
          await page.waitForTimeout(50);
          await expect(page.getByRole('textbox', { name: 'Prompt', exact: true })).toHaveValue('My new edit wins');
          assert.deepEqual((await state()).form, before.form);
          // Failure is scoped and leaves both the prior draft and editable composer available.
          const beforeFailure = await state();
          await page.getByRole('button', { name: 'Open Wan Extend', exact: true }).click();
          await expect.poll(() => requests.length).toBe(4);
          await expect.poll(async () => (await state()).recallBlocked).toBe(true);
          await requests[3].fulfill({ status: 404, json: { ok: false } });
          await expect.poll(async () => (await state()).recallPending).toBe(false);
          await expect.poll(async () => (await state()).recallError).toMatch(/settings/i);
          assert.deepEqual((await state()).form, beforeFailure.form);
          await expect(page.getByRole('textbox', { name: 'Prompt', exact: true })).toBeVisible();
          await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill('My deliberate recovery edit');
          await expect.poll(async () => (await state()).recallBlocked).toBe(false);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});

test('the visible Create control preserves canonical recalled frames through repeated clicks and Extend', { timeout: 180000 }, async () => {
  const frames = [
    ['veo-3-1', 'first_frame_url', 'last_frame_url'],
    ['flux-3', 'start_image_url', 'end_image_url'],
    ['gemini-omni-flash', 'image_url', 'end_image_url'],
  ] as const;
  const frameJobs = frames.map(([engineId, first, last]) => ({
    jobId: `job_${engineId}`, engineId, engineLabel: engineId, durationSec: 5, aspectRatio: '16:9',
    prompt: 'A canonical two-frame recipe', createdAt: '2026-10-01T00:00:00Z', status: 'completed',
    settingsSnapshot: { schemaVersion: 1, surface: 'video', engineId, inputMode: 'fl2v', prompt: 'A canonical two-frame recipe', core: {},
      refs: { inputs: [first, last].map(slotId => ({ slotId, kind: 'image', assetId: slotId,
        url: `https://assets.test/${slotId}.png`, width: 1280, height: 720, size: 1024, type: 'image/png' })) } },
  }));
  const harnessSource = (await readFile('tests/helpers/workspace-gallery-recall-harness.ts', 'utf8')).replaceAll('../../frontend/', './');
  const source = harnessSource + '\n' + galleryRecallBrowserSource.replace("import {useGalleryRecallHarness} from '../tests/helpers/workspace-gallery-recall-harness';", '');
  const fixture = await startWorkspaceReferenceFixture({ source, config: { jobs: frameJobs },
    hostModules: { '@/lib/authFetch': 'export const authFetch=(url,options)=>fetch(url,options);',
      '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-owned',user:{id:'recall-owner'}}},error:null})}});` },
  });
  try {
    for (const browserType of [chromium, webkit]) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const width of [390, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
          const errors: string[] = [], forbidden: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            if (request.method() !== 'GET') { forbidden.push(request.method()); return route.abort(); }
            if (url.hostname === 'assets.test') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"/>' });
            if (url.origin !== fixture.url) { forbidden.push(url.origin); return route.abort(); }
            if (url.pathname.startsWith('/api/jobs/')) {
              const job = frameJobs.find(entry => url.pathname.endsWith(entry.jobId));
              assert.ok(job);
              return route.fulfill({ json: { ok: true, settingsSnapshot: job.settingsSnapshot } });
            }
            return route.continue();
          });
          await page.goto(fixture.url);
          const state = async () => JSON.parse((await page.locator('[data-state]').textContent())!);
          for (const [engineId, first, last] of frames) {
            await page.getByRole('button', { name: `Open ${engineId}`, exact: true }).click();
            await expect.poll(async () => (await state()).mode).toBe('fl2v');
            const create = page.locator('[data-composer-mode="create"]');
            await expect(create).toBeVisible();
            await expect(create).toHaveAttribute('aria-pressed', 'true');
            for (let click = 0; click < 3; click++) await create.click();
            await page.locator('[data-composer-mode="extend"]').click();
            await expect.poll(async () => (await state()).mode).toBe('extend');
            await create.click();
            await create.click();
            await expect(create).toHaveAttribute('aria-pressed', 'true');
            await expect.poll(async () => (await state()).mode).toBe('fl2v');
            assert.equal((await state()).assets[first]?.[0]?.assetId, first);
            assert.equal((await state()).assets[last]?.[0]?.assetId, last);
          }
          assert.deepEqual(errors, []);
          assert.deepEqual(forbidden, []);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
