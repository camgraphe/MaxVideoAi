import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';

test(
  'marketing admin handles original copies and private publication imports',
  { timeout: 120000 },
  async () => {
    const frontend = join(process.cwd(), 'frontend');
    const requireFrontend = createRequire(join(frontend, 'package.json'));
    const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingMediaLibrary} from './app/(core)/admin/marketing-media/_components/MarketingMediaLibrary.client';createRoot(document.getElementById('root')).render(<main className="admin-workspace p-4"><MarketingMediaLibrary initialVideoId="stable-video"/></main>);`;
    const bundle = await build({
      absWorkingDir: frontend,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      jsx: 'automatic',
      define: { 'process.env': '{"NODE_ENV":"production"}' },
      write: false,
      stdin: { contents: source, loader: 'tsx', resolveDir: frontend },
      tsconfig: join(frontend, 'tsconfig.json'),
      plugins: [
        {
          name: 'auth-transport',
          setup(b) {
            b.onResolve({ filter: /^@\/lib\/authFetch$/ }, () => ({ path: 'auth', namespace: 'test' }));
            b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
              contents: 'export const authFetch=(...args)=>fetch(...args);',
            }));
          },
        },
      ],
    });
    const styles = await Promise.all(
      ['app/globals.css', 'src/styles/tokens.css', 'components/admin-system/shell/admin-workspace.css'].map((path) =>
        readFile(join(frontend, path), 'utf8'),
      ),
    );
    const css = await requireFrontend('postcss')([
      requireFrontend('tailwindcss')({
        ...tailwindConfig,
        content: [
          ...tailwindConfig.content.map((pattern: string) => join(frontend, pattern)),
          { raw: source, extension: 'tsx' },
        ],
      }),
    ]).process(styles.join('\n').replace(/@(import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
    const server = createServer((req, res) => {
      const script = req.url === '/fixture.js',
        style = req.url === '/fixture.css';
      res.setHeader('Content-Type', script ? 'text/javascript' : style ? 'text/css' : 'text/html');
      res.end(
        script
          ? bundle.outputFiles[0].text
          : style
            ? css.css
            : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>',
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const width of [390, 1440]) {
        let items: any[] = [];
        let posts = 0;
        let mediaRequests = 0;
        await page.unrouteAll({ behavior: 'wait' });
        await page.route('**/api/admin/**', async (route) => {
          const req = route.request();
          let body: unknown = { ok: true, items, nextOffset: null };
          let status = 200;
          if (req.method() === 'POST') {
            posts++;
            await new Promise((r) => setTimeout(r, 200));
            if (posts === 1) {
              status = 502;
              body = { ok: false, error: 'Reference unavailable. Retry the copy.' };
            } else {
              items = [
                {
                  videoId: 'stable-video',
                  state: 'ready',
                  visibility: 'public',
                  prompt: 'Exact original prompt',
                  engineLabel: 'Luma',
                  sizeBytes: 123456,
                  createdAt: '2026-10-22',
                  videoUrl: '/fixture.mp4',
                  placements: [{ kind: 'playlist', label: 'Homepage collection', href: '/admin/playlists' }],
                },
              ];
              body = { ok: true, item: items[0] };
            }
          }
          if (req.method() === 'DELETE') {
            status = 409;
            body = { ok: false, error: 'This media is still used on the site.' };
          }
          await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.route('**/*.mp4', (route) => {
          mediaRequests++;
          return route.abort();
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`http://127.0.0.1:${address.port}`);
        await page.getByText('No marketing media yet.').waitFor();
        await page.getByLabel(/permission to use/).check();
        await page.getByRole('button', { name: 'Add to marketing media', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Copying…' }).isDisabled(), true);
        await page.getByRole('alert').filter({ hasText: 'Reference unavailable' }).waitFor();
        assert.equal(await page.getByLabel('Video ID or link').inputValue(), 'stable-video');
        await page.getByRole('button', { name: 'Add to marketing media', exact: true }).click();
        await page.getByRole('link', { name: 'Reuse settings' }).waitFor();
        assert.equal(
          await page.getByRole('link', { name: 'Reuse settings' }).getAttribute('href'),
          '/app?from=stable-video',
        );
        assert.equal(await page.getByRole('button', { name: 'Delete copy', exact: true }).isDisabled(), true);
        assert.equal(mediaRequests, 0, 'no original video request before explicit Play');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await mkdir('output/marketing-media', { recursive: true });
        await page.screenshot({ path: `output/marketing-media/admin-${width}.png`, fullPage: true });
      }
      await exercisePublicationImport(page, `http://127.0.0.1:${address.port}`);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  },
);

async function exercisePublicationImport(page: Page, url: string) {
  const failed = { videoId: 'partial-import', sourceKind: 'import', state: 'failed', visibility: 'private', prompt: '',
    engineLabel: 'Recast', sizeBytes: 0, createdAt: '2026-11-07', placements: [] };
  const original = { ...failed, videoId: 'ordinary-copy', sourceKind: 'job' };
  let items = [failed, original];
  let listReads = 0;
  const previewIds: string[] = [];
  const importBodies: unknown[] = [];
  const oldPreview = Promise.withResolvers<void>();
  const oldPreviewHandled = Promise.withResolvers<void>();
  const rejectedImport = Promise.withResolvers<void>();
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    let body: unknown;
    let status = 200;
    let stale = false;
    if (request.method() === 'GET') {
      listReads++;
      body = { ok: true, items, nextOffset: null };
    } else {
      const payload = request.postDataJSON();
      const id = payload.manifest.id;
      if (new URL(request.url()).searchParams.has('preview')) {
        previewIds.push(id);
        stale = id === 'stale';
        if (stale) await oldPreview.promise;
        body = { ok: true, preview: { videoId: id, name: id === 'stale' ? 'Stale film' : 'Reviewed film',
          durationSec: 8, resolution: '1920 × 1080', width: 1920, height: 1080, fileCount: 3 } };
      } else {
        importBodies.push(payload);
        if (importBodies.length === 1) {
          await rejectedImport.promise;
          status = 502;
          body = { ok: false, error: 'Source unavailable. Retry with the same manifest.' };
        } else {
          const item = { ...failed, state: 'ready', visibility: importBodies.length > 2 ? 'public' : 'private' };
          items = [item, original];
          body = { ok: true, item };
        }
      }
    }
    try {
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    } finally {
      if (stale) oldPreviewHandled.resolve();
    }
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(url);
  const failedRow = page.getByRole('article').filter({ hasText: failed.videoId });
  const originalRow = page.getByRole('article').filter({ hasText: original.videoId });
  const disclosure = page.locator('details').filter({ has: page.getByText('Import publication', { exact: true }) });
  const file = page.getByLabel('Publication manifest');
  await originalRow.getByRole('button', { name: 'Retry copy', exact: true }).waitFor();
  assert.equal(await failedRow.getByRole('button', { name: 'Retry copy', exact: true }).count(), 0);
  await expect(file).toBeHidden();
  await failedRow.getByRole('button', { name: 'Retry import', exact: true }).click({ timeout: 5_000 });
  await expect(file).toBeVisible();
  await expect(disclosure).toContainText('same manifest');
  const choose = (json: string) => file.setInputFiles({ name: 'publication.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await choose('{');
  await expect(disclosure.getByRole('alert')).toContainText('valid JSON');
  assert.deepEqual(previewIds, []);
  const nearLimit = { id: 'near-limit', pad: '' };
  nearLimit.pad = 'x'.repeat(2 * 1024 ** 2 - Buffer.byteLength(JSON.stringify({ manifest: nearLimit })));
  await choose(JSON.stringify(nearLimit));
  await expect(disclosure.getByRole('alert')).toContainText('2 MiB', { timeout: 5_000 });
  assert.deepEqual(previewIds, []);
  const submit = disclosure.getByRole('button', { name: 'Import private copy' });
  const permission = disclosure.getByRole('checkbox');
  await expect(submit).toBeDisabled();
  await choose('{"id":"stale"}');
  await expect.poll(() => previewIds).toEqual(['stale']);
  await expect(permission).toBeDisabled();
  await choose(JSON.stringify({ id: failed.videoId }));
  await expect(disclosure).toContainText('Reviewed film');
  await expect(disclosure).toContainText(failed.videoId);
  await expect(disclosure).toContainText('8 seconds');
  await expect(disclosure).toContainText('1920 × 1080');
  await expect(disclosure).toContainText('Required files');
  await expect(disclosure.getByText('3', { exact: true })).toBeVisible();
  oldPreview.resolve();
  await oldPreviewHandled.promise;
  await expect(disclosure.getByText('Stale film')).toHaveCount(0);
  await expect(submit).toBeDisabled();
  assert.deepEqual(importBodies, []);
  await permission.check();
  await submit.evaluate(button => {
    const form = (button as HTMLButtonElement).form!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(disclosure.getByRole('button', { name: 'Importing…' })).toBeDisabled();
  await expect(file).toBeDisabled();
  await expect(permission).toBeDisabled();
  await expect.poll(() => importBodies.length).toBe(1);
  rejectedImport.resolve();
  await expect(disclosure.getByRole('alert')).toContainText('Source unavailable');
  await expect(permission).toBeChecked();
  await expect(file).toBeEnabled();
  const readsBeforeRetry = listReads;
  await submit.click();
  await expect(disclosure.getByRole('status')).toContainText('Private copy saved');
  await expect(failedRow.getByRole('button', { name: 'Publish on site' })).toBeVisible();
  assert.deepEqual(importBodies, Array(2).fill({ manifest: { id: failed.videoId }, permissionConfirmed: true }));
  assert.ok(listReads > readsBeforeRetry, 'the site library was fetched after successful import');
  await choose(JSON.stringify({ id: failed.videoId }));
  await expect(permission).toBeEnabled();
  await expect(permission).not.toBeChecked();
  await permission.check();
  await submit.click();
  await expect(disclosure.getByRole('status')).toContainText('already public');
  await expect(failedRow.getByRole('button', { name: 'Make private' })).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
