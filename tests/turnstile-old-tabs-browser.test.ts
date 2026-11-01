import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect, type Page } from '@playwright/test';
import { createTurnstileMigrationFixture } from './helpers/turnstile-migration-fixture';

test('retained tabs survive cutover and rollback, then recover by explicit reload when A is retired', { timeout: 60_000 }, async t => {
  const component = 'frontend/app/(core)/admin/turnstile-diagnostic/_components/TurnstileDiagnostic.client.tsx';
  assert.ok(existsSync(component), 'a separate no-payment diagnostic UI must exist');
  const f = await createTurnstileMigrationFixture();
  t.after(() => f.cleanup());
  const { POST } = await f.load('frontend/app/api/admin/turnstile-diagnostic/route.ts');
  const { GET } = await f.load('frontend/app/api/turnstile/config/route.ts');
  const { POST: reload } = await f.load('frontend/app/api/turnstile/reload/route.ts');
  const { NextRequest } = createRequire(resolve('frontend/package.json'))('next/server');
  const bundle = join(f.folder, 'browser.js');
  await build({ stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import {TurnstileDiagnostic} from " + JSON.stringify(resolve(component)) + "; createRoot(document.getElementById('root')).render(React.createElement(TurnstileDiagnostic,window.diagnosticConfig));", resolveDir: resolve('frontend'), loader: 'tsx' }, outfile: bundle,
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'no-payments-in-diagnostic-ui', setup(b) { b.onResolve({ filter: /stripe|WalletExpressCheckout|useHostedWalletCheckout/ }, args => { throw new Error('Payment UI dependency forbidden: ' + args.path); }); }}] });
  const requests: Array<{ path: string; body?: Record<string, unknown> }> = [];
  const errors: string[] = [];
  let configurationUnavailable = false;
  let reloadUnavailable = false;
  let recoveryRequests = 0;
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/browser.js') { res.setHeader('content-type', 'text/javascript'); res.end(readFileSync(bundle)); return; }
      const requestUrl = new URL(req.url ?? '/', 'http://' + req.headers.host);
      if (requestUrl.pathname === '/') {
        // Honor Vercel's pin for documents as well as custom fetches. A plain reload
        // must keep serving A until the user-triggered recovery clears the cookie.
        const pinned = req.headers.cookie?.includes('__vdpl=stale-deployment') || requestUrl.searchParams.has('dpl');
        const config = { activeSiteKey: pinned ? 'public-A' : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, widgets: [{ generation: 'legacy', siteKey: 'public-A' }, { generation: 'secondary', siteKey: 'public-B' }] };
        res.setHeader('content-type', 'text/html');
        res.end('<div id="root"></div><script>window.diagnosticConfig=' + JSON.stringify(config) + '</script><script src="/browser.js"></script>');
        return;
      }
      if (req.url === '/api/turnstile/config' && req.method === 'GET') {
        assert.equal(req.headers.cookie, undefined, 'public config must omit deployment-pinning and authentication cookies');
        const response = configurationUnavailable ? Response.json({}, { status: 503 }) : GET();
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      if (req.url === '/api/turnstile/reload' && req.method === 'POST') {
        recoveryRequests++;
        const response = reloadUnavailable ? new Response(null, { status: 503 }) : reload(new Request('http://' + req.headers.host + req.url, { method: 'POST', headers: req.headers as HeadersInit }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      requests.push({ path: req.url ?? '', body: JSON.parse(body || '{}') });
      assert.equal(req.url, '/api/admin/turnstile-diagnostic', 'no wallet, session or top-up route may be reached');
      const request = new NextRequest('http://' + req.headers.host + req.url, { method: 'POST', body, headers: { ...req.headers, 'x-test-role': 'admin' } });
      const response = await POST(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch (error) { errors.push(String(error)); res.writeHead(500); res.end('{}'); }
  });
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise<void>(resolveClose => server.close(() => resolveClose())));
  // NextRequest normalizes loopback IPs to localhost; use that canonical host in the browser too.
  const origin = 'http://localhost:' + (server.address() as { port: number }).port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  let generated = 0;
  const forbiddenRequests: string[] = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.turnstile={render(el,options){window.expireDiagnosticToken=options["expired-callback"];options.callback((options.sitekey==="public-A"?"A:":"B:")+"browser-' + (++generated) + '-"+crypto.randomUUID());return "widget"},remove(){}};' });
    }
    forbiddenRequests.push(url); return route.abort();
  });
  const oldTab = await context.newPage();
  await oldTab.goto(origin);
  await oldTab.getByLabel('Simulate an old tab (omit widget identifier)').check();
  assert.equal(requests.length, 0, 'opening the diagnostic must never submit automatically');
  async function validate(page: Page, fresh = false) {
    await page.getByRole('button', { name: fresh ? 'New challenge' : 'Load challenge', exact: true }).click();
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/admin/turnstile-diagnostic'));
    await page.getByRole('button', { name: 'Validate', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, await response.text());
    await page.getByTestId('diagnostic-result').filter({ hasText: 'captcha_passed' }).waitFor();
    assert.match(await page.getByTestId('diagnostic-result').innerText(), /"captchaPassed": true/);
  }
  await validate(oldTab);
  assert.equal(Object.hasOwn(requests[0].body!, 'captchaSiteKey'), false);
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-B';
  assert.equal(await oldTab.getByLabel('Widget', { exact: true }).count(), 1, JSON.stringify(await oldTab.locator('label').allTextContents()));
  assert.equal(await oldTab.getByLabel('Widget', { exact: true }).inputValue(), 'public-A');
  await validate(oldTab, true);
  const newTab = await context.newPage();
  await newTab.goto(origin);
  assert.equal(await newTab.getByLabel('Widget', { exact: true }).inputValue(), 'public-B');
  await newTab.getByLabel('Checkout mode').selectOption('express_checkout');
  await validate(newTab);
  assert.equal(requests.at(-1)?.body?.captchaSiteKey, 'public-B');
  await newTab.getByRole('button', { name: 'Replay last token' }).click();
  await newTab.getByTestId('diagnostic-result').filter({ hasText: 'captcha_token_replayed' }).waitFor();
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'public-A';
  await validate(newTab, true);
  await validate(oldTab, true);
  await newTab.getByRole('button', { name: 'New challenge', exact: true }).click();
  await expect(newTab.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  await newTab.evaluate(() => (window as unknown as { expireDiagnosticToken: () => void }).expireDiagnosticToken());
  await expect(newTab.getByRole('button', { name: 'Validate', exact: true })).toBeDisabled();
  assert.deepEqual(errors, []);
  assert.deepEqual(forbiddenRequests, []);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE captcha_passed')).rows[0].n, 5);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE stripe_checkout_session_id IS NOT NULL')).rows[0].n, 0);
  assert.equal(requests.length, 6);

  // Keep the already-loaded A widget and its token through the retirement.
  Object.assign(process.env, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-B', TURNSTILE_WIDGET_MODE: 'secondary_only' });
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_LEGACY_SITE_KEY;
  await context.addCookies([{ name: '__vdpl', value: 'stale-deployment', url: origin, httpOnly: true }]);
  await context.addCookies([{ name: 'session', value: 'preserve-me', url: origin, httpOnly: true }]);
  await oldTab.evaluate(() => history.replaceState(history.state, '', '/?keep=1#billing-history-title'));
  const beforeRetirement = requests.length;
  await oldTab.evaluate(() => window.dispatchEvent(new Event('focus')));
  await oldTab.getByRole('button', { name: 'Reload page', exact: true }).waitFor({ timeout: 1500 });
  assert.equal(await oldTab.getByRole('button', { name: 'Validate', exact: true }).isDisabled(), true);
  assert.equal(requests.length, beforeRetirement, 'detecting retirement must not submit any checkout or diagnostic');
  let reloads = 0;
  oldTab.on('request', request => { if (request.isNavigationRequest() && request.frame() === oldTab.mainFrame()) reloads++; });
  reloadUnavailable = true;
  await oldTab.getByRole('button', { name: 'Reload page', exact: true }).click();
  await oldTab.getByRole('alert').filter({ hasText: 'The page could not be updated' }).waitFor();
  assert.equal(reloads, 0, 'failed pin clearing must not reload into the same obsolete deployment');
  reloadUnavailable = false;
  await Promise.all([
    oldTab.waitForEvent('load'),
    oldTab.getByRole('button', { name: 'Reload page', exact: true }).click(),
  ]);
  assert.equal(reloads, 1);
  assert.equal(recoveryRequests, 2, 'recovery runs only on the two explicit clicks');
  assert.equal((await context.cookies()).some(cookie => cookie.name === '__vdpl'), false);
  assert.equal((await context.cookies()).find(cookie => cookie.name === 'session')?.value, 'preserve-me');
  await expect(oldTab.getByLabel('Widget', { exact: true })).toHaveValue('public-B');
  assert.equal(oldTab.url(), origin + '/?keep=1#billing-history-title');
  assert.equal(requests.length, beforeRetirement, 'a reload must not resume a payment or validation automatically');
  await validate(oldTab);
  await oldTab.getByLabel('Checkout mode').selectOption('express_checkout');
  await validate(oldTab, true);
  await oldTab.getByRole('button', { name: 'Replay last token' }).click();
  await oldTab.getByTestId('diagnostic-result').filter({ hasText: 'captcha_token_replayed' }).waitFor();
  assert.equal(reloads, 1, 'neither success nor replay may trigger another reload');

  // An explicit URL pin must be removed too, without dropping unrelated URL state.
  const urlPinnedTab = await context.newPage();
  await urlPinnedTab.goto(origin + '/?keep=2&dpl=stale-deployment#billing-history-title');
  assert.equal(await urlPinnedTab.getByLabel('Widget', { exact: true }).inputValue(), 'public-A');
  await urlPinnedTab.getByRole('button', { name: 'Load challenge', exact: true }).click();
  await Promise.all([
    urlPinnedTab.waitForEvent('load'),
    urlPinnedTab.getByRole('button', { name: 'Reload page', exact: true }).click(),
  ]);
  await expect(urlPinnedTab.getByLabel('Widget', { exact: true })).toHaveValue('public-B');
  assert.equal(urlPinnedTab.url(), origin + '/?keep=2#billing-history-title');
  assert.equal(requests.length, beforeRetirement + 3, 'URL recovery must not submit a validation');

  configurationUnavailable = true;
  const beforeUnavailable = requests.length;
  await newTab.getByRole('button', { name: 'New challenge', exact: true }).click();
  await newTab.getByRole('button', { name: 'Retry verification', exact: true }).waitFor();
  assert.equal(await newTab.getByRole('button', { name: 'Validate', exact: true }).isDisabled(), true);
  configurationUnavailable = false;
  await newTab.getByRole('button', { name: 'Retry verification', exact: true }).click();
  await expect(newTab.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
  assert.equal(requests.length, beforeUnavailable, 'retrying configuration must not submit a validation');
  assert.deepEqual(errors, []);
  assert.deepEqual(forbiddenRequests, []);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE captcha_passed')).rows[0].n, 7);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM checkout_attempts WHERE stripe_checkout_session_id IS NOT NULL')).rows[0].n, 0);
});
