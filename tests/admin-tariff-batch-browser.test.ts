import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { withTariffBatchFixture } from './helpers/tariff-batch-postgres-fixture';
import { klingBatchClasses } from '../frontend/server/pricing-admin/tariff-batches/kling';
import { previewTariffBatch, confirmTariffBatch, readTariffBatch, reconcileTariffBatch, listTariffBatches } from '../frontend/server/pricing-admin/tariff-batches/service';

const frontend = join(process.cwd(), 'frontend'), requireFrontend = createRequire(join(frontend, 'package.json'));
const actor = '11111111-1111-4111-8111-111111111111';
test('native batch UI applies one real transaction and recovers a lost response on reload without resubmitting', { timeout: 120_000 }, async () => withTariffBatchFixture(async ({ db }) => {
  const source = `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {TariffBatchPanel} from './app/(core)/admin/pricing/_components/TariffBatchPanel.client';
    createRoot(document.getElementById('root')).render(<main className="admin-workspace p-4"><TariffBatchPanel /></main>);`;
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env': '{"NODE_ENV":"production"}' }, write: false, stdin: { contents: source, loader: 'tsx', resolveDir: frontend }, tsconfig: join(frontend, 'tsconfig.json') });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'components/admin-system/shell/admin-workspace.css'].map(p => readFile(join(frontend, p), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: [...tailwindConfig.content.map((p: string) => join(frontend, p)), { raw: source, extension: 'tsx' }],
  })]).process(styles.join('\n').replace(/@(import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const posts: string[] = []; let dropConfirm = true; let currentActor = actor;
  const server = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
        if (req.method === 'POST') posts.push(req.url);
        const path = req.url.split('?')[0]; let payload;
        if (path.endsWith('/preview')) payload = { operation: await previewTariffBatch(body, currentActor) };
        else if (path.endsWith('/confirm')) {
          payload = { operation: await confirmTariffBatch(body.operationId, body.fingerprint, currentActor, () => {}) };
          // A gateway loses the successful body. Unlike a bare socket close, this prevents Chromium's automatic transport retry.
          if (dropConfirm) { dropConfirm = false; res.statusCode = 503; res.end(''); return; }
        } else if (path.endsWith('/status')) payload = { operation: await readTariffBatch(new URL(req.url, 'http://localhost').searchParams.get('operationId')!, currentActor) };
        else if (path.endsWith('/reconcile')) payload = { operation: await reconcileTariffBatch(body.operationId, currentActor) };
        else payload = { actorId: currentActor, enabled: true, classes: klingBatchClasses().map(({ key, selector }) => ({ key, selector })), operations: await listTariffBatches(currentActor) };
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, ...payload })); return;
      }
      res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : req.url === '/fixture.css' ? 'text/css' : 'text/html');
      res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text : req.url === '/fixture.css' ? css.css : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');
    } catch (error) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, message: (error as Error).message })); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.locator('summary').filter({ hasText: /^Tariff batches$/ }).click({ timeout: 5000 }).catch(async e => { throw new Error(`${e.message}; browser errors: ${errors.join('; ')}; body: ${await page.locator('body').innerText()}`); });
    await page.getByRole('button', { name: 'Select all 226 classes', exact: true }).click();
    await page.getByLabel('Reason for change').fill('Local browser qualification');
    await page.getByRole('button', { name: 'Preview batch', exact: true }).click();
    await page.getByText('226 create · 0 update · 0 unchanged · 0 conflict', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-batch-review-row]').count(), 226);
    // Any draft change revokes the previously reviewed approval.
    await page.getByLabel('LIST multiplier').fill('1.60');
    assert.equal(await page.getByRole('button', { name: 'Confirm batch', exact: true }).count(), 0);
    await page.getByLabel('LIST multiplier').fill('1.50');
    await page.getByRole('button', { name: 'Preview batch', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm batch', exact: true }).click();
    await page.getByText(/Response unavailable/).waitFor({timeout: 5000}).catch(async e => { throw new Error(`${e.message}; posts=${JSON.stringify(posts)}; body=${(await page.locator('body').innerText()).slice(0,1500)}`); });
    assert.equal(posts.filter(p => p.endsWith('/confirm')).length, 1);
    assert.equal(await page.getByRole('button', {name: 'New batch', exact: true}).count(), 0);
    await page.reload();
    await page.getByText('Committed', { exact: true }).first().waitFor();
    assert.equal(posts.filter(p => p.endsWith('/confirm')).length, 1);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '226');
    await page.getByRole('button', { name: 'New batch', exact: true }).click();
    await page.getByLabel('Price input').selectOption('explicit');
    await page.getByLabel('Exact batch JSON').fill(JSON.stringify({ schemaVersion: 1, modelId: 'kling-v4', intent: 'replace_selected', reason: 'Explicit local replacement',
      pricing: { kind: 'explicit' }, selections: [{ selector: klingBatchClasses()[0].selector, price: { kind: 'fixed', customerCents: 999 } }] }));
    await page.getByRole('button', { name: 'Preview batch', exact: true }).click();
    await page.getByText('0 create · 1 update · 0 unchanged · 0 conflict', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm batch', exact: true }).click();
    await page.getByText('Committed', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Preview rollback', exact: true }).first().click();
    await page.getByText('0 create · 1 update · 0 unchanged · 0 conflict', { exact: true }).waitFor();
    assert.equal(posts.filter(p => p.endsWith('/confirm')).length, 2, 'rollback is preview-only until explicit confirmation');
    await page.getByText('Complete before and after plan', {exact: true}).click();
    assert.match(await page.locator('[data-batch-plan]').innerText(), /"previousCell"/);
    assert.match(await page.locator('[data-batch-plan]').innerText(), /"version"/);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no document overflow at ${width}`);
      if (process.env.TARIFF_BATCH_EVIDENCE_DIR) { await mkdir(process.env.TARIFF_BATCH_EVIDENCE_DIR, { recursive: true });
        await page.screenshot({ path: join(process.env.TARIFF_BATCH_EVIDENCE_DIR, `batch-${width}.png`), fullPage: true }); }
    }
    const firstActorSaved = await page.evaluate(actor => localStorage.getItem(`admin.tariff-batch.operation.v1.${actor}`), actor);
    assert.ok(firstActorSaved);
    currentActor = '22222222-2222-4222-8222-222222222222';
    await page.reload();
    await page.locator('summary').filter({hasText: /^Tariff batches$/}).click();
    await page.getByRole('button', {name: 'Select all 226 classes', exact: true}).waitFor();
    assert.equal(await page.getByText(/Confirmation outcome pending/).count(), 0);
    assert.equal(await page.evaluate(actor => localStorage.getItem(`admin.tariff-batch.operation.v1.${actor}`), actor), firstActorSaved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(done => server.close(() => done())); }
}));
