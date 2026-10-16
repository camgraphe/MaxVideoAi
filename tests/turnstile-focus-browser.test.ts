import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('returning from a CAPTCHA iframe preserves an accepted token but still detects retirement', { timeout: 30_000 }, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'turnstile-focus-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const bundle = join(folder, 'browser.js');
  const component = resolve('frontend/app/(core)/admin/turnstile-diagnostic/_components/TurnstileDiagnostic.client.tsx');
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {TurnstileDiagnostic} from ${JSON.stringify(component)}; createRoot(document.getElementById('root')).render(React.createElement(TurnstileDiagnostic,{activeSiteKey:'public-B',widgets:[{generation:'secondary',siteKey:'public-B'}]}));`, resolveDir: resolve('frontend'), loader: 'tsx' }, outfile: bundle,
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' } });
  let accepted = true;
  let unavailable = false;
  const submissions: unknown[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === '/browser.js') { res.setHeader('content-type', 'text/javascript'); res.end(await readFile(bundle)); return; }
    if (req.url === '/api/turnstile/config') {
      res.writeHead(unavailable ? 503 : 200, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
      res.end(JSON.stringify({ activeSiteKey: accepted ? 'public-B' : 'public-C', acceptedSiteKeys: [accepted ? 'public-B' : 'public-C'] })); return;
    }
    if (req.url === '/api/admin/turnstile-diagnostic') {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      submissions.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ result: { action: 'allow', reason: 'captcha_passed', captchaPassed: true } })); return;
    }
    res.setHeader('content-type', 'text/html'); res.end('<div id="root"></div><script src="/browser.js"></script>');
  });
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise<void>(resolveClose => server.close(() => resolveClose())));
  const origin = 'http://localhost:' + (server.address() as { port: number }).port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const unexpected: string[] = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) return route.fulfill({ contentType: 'text/javascript', body: `
      const frames = new Map(); window.oldWidgetCallbacks = []; window.turnstile = {
        render(el, options) {
          window.lateTurnstileError = options['error-callback'];
          window.oldWidgetCallbacks.push(options);
          const id = crypto.randomUUID(), frame = document.createElement('iframe'); frame.title = 'Human verification';
          frame.src = 'https://challenges.cloudflare.com/test-frame?id=' + id;
          const receive = event => { if (event.source === frame.contentWindow && event.origin === 'https://challenges.cloudflare.com') options.callback('test-token-' + id); };
          window.addEventListener('message', receive); el.appendChild(frame); frames.set(id, {frame, receive}); return id;
        },
        remove(id) { const widget = frames.get(id); if (widget) { window.removeEventListener('message', widget.receive); widget.frame.remove(); frames.delete(id); } }
      };` });
    if (url.startsWith('https://challenges.cloudflare.com/test-frame')) return route.fulfill({ contentType: 'text/html', body: '<button onclick="parent.postMessage(\'verified\',\'*\')">Verify human</button>' });
    unexpected.push(url); return route.abort();
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Load challenge', exact: true }).click();
  const verify = () => page.frameLocator('iframe[title="Human verification"]').getByRole('button', { name: 'Verify human' }).click();
  await verify();
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  const recheck = page.waitForResponse(response => response.url() === origin + '/api/turnstile/config');
  await page.getByRole('heading', { name: 'Turnstile validation diagnostic' }).click();
  await recheck;
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  assert.equal(submissions.length, 0, 'focus checks must not submit a validation');
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await page.getByTestId('diagnostic-result').filter({ hasText: 'captcha_passed' }).waitFor();
  assert.equal(submissions.length, 1);

  await page.getByRole('button', { name: 'New challenge', exact: true }).click();
  await verify();
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  accepted = false;
  await page.getByRole('heading', { name: 'Turnstile validation diagnostic' }).click();
  await page.getByRole('button', { name: 'Reload page', exact: true }).waitFor();
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { lateTurnstileError: () => void }).lateTurnstileError());
  await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toBeVisible();
  assert.equal(submissions.length, 1, 'retirement must invalidate without an automatic submission');

  accepted = true;
  // Recover through a foreground check in the same component lifetime. A
  // parent reset would cancel the whole old effect and miss stale callbacks.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await verify();
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const old = (window as unknown as { oldWidgetCallbacks: Array<{ callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }> }).oldWidgetCallbacks.at(-2)!;
    old.callback('late-old-token'); old['expired-callback'](); old['error-callback']();
  });
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await page.getByTestId('diagnostic-result').filter({ hasText: 'captcha_passed' }).waitFor();
  assert.equal(submissions.length, 2);
  assert.notEqual((submissions.at(-1) as { captchaToken: string }).captchaToken, 'late-old-token');
  await page.getByRole('button', { name: 'New challenge', exact: true }).click();
  await verify();
  unavailable = true;
  await page.getByRole('heading', { name: 'Turnstile validation diagnostic' }).click();
  await page.getByRole('button', { name: 'Retry verification', exact: true }).waitFor();
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeDisabled();
  assert.equal(submissions.length, 2, 'an unavailable configuration cannot authorize a token');
  assert.deepEqual(unexpected, []);
});
