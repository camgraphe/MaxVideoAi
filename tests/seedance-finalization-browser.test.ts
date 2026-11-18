import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect, type Browser } from '@playwright/test';
import type { SeedanceWorkflowView } from '../frontend/lib/seedance-workflow-contract';

// Real shared library/Studio controls and HTTP requests; no provider or wallet is contacted.
test('library and Studio final controls replace a 1080p quote before submitting 4K in the browser', async () => {
  const bundle = await build({
    absWorkingDir: join(process.cwd(), 'frontend'), bundle: true, write: false, platform: 'browser', format: 'iife',
    jsx: 'automatic', tsconfig: 'tsconfig.json', define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: join(process.cwd(), 'frontend'), loader: 'tsx', contents: `
      import { createRoot } from 'react-dom/client';
      import { SeedanceDraftFinalAction } from './components/library/SeedanceDraftFinalAction.client';
      const locale = new URLSearchParams(location.search).get('locale') || 'en';
      createRoot(document.getElementById('root')).render(<SeedanceDraftFinalAction jobId="draft" locale={locale}
        asAside={locale === 'en'} account={{userId:'owner',token:'fixture-token'}} />);
    ` },
  });
  const script = bundle.outputFiles[0].text;
  const requests: Array<{ path: string; resolution: string }> = [];
  const ready: SeedanceWorkflowView = {
    draft: { jobId: 'draft', status: 'completed', amountCents: 129, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/draft.mp4', thumbUrl: null },
    final: null, eligibility: 'ready', expiresAt: '2099-11-17T00:00:00Z',
    settings: { durationSec: 5, aspectRatio: '16:9', audio: false, resolution: '480p' },
  };
  let view = ready;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://fixture').pathname;
    const json = (value: unknown) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(value)); };
    if (path === '/api/preflight' || path === '/api/generate') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        const payload = JSON.parse(body);
        requests.push({ path, resolution: payload.resolution });
        if (path === '/api/preflight') {
          const totalCents = payload.resolution === '4k' ? 914 : 651;
          json({ ok: true, total: totalCents, currency: 'USD', pricing: { totalCents, currency: 'USD',
            meta: { workflowStep: 'final', pricingMode: 'manual_tariff', customerTariffRevision: 328 } } });
        } else {
          view = { ...ready, eligibility: 'finalized', final: { jobId: 'final', resolution: payload.resolution, status: 'completed',
            amountCents: 914, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/final.mp4', thumbUrl: null } };
          json({ ok: true, jobId: 'final' });
        }
      });
      return;
    }
    if (path.endsWith('/seedance-workflow')) { json(view); return; }
    if (path.startsWith('/api/')) { json({ ok: true, status: 'completed' }); return; }
    response.setHeader('content-type', path === '/fixture.js' ? 'text/javascript' : 'text/html');
    response.end(path === '/fixture.js' ? script : '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script>globalThis.process={env:{NODE_ENV:"production"}}</script><script src="/fixture.js"></script>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    for (const locale of ['en', 'fr', 'es']) {
      const mobile = locale !== 'en', fr = locale === 'fr', es = locale === 'es';
      view = ready; requests.length = 0;
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}/?locale=${locale}`);
      const selector = page.getByRole('combobox', { name: fr ? 'Résolution finale' : es ? 'Resolución final' : 'Final resolution' });
      await expect(selector).toHaveValue('1080p').catch(async failure => {
        throw new Error(`${failure.message}\nBrowser errors: ${JSON.stringify(errors)}\nBody: ${await page.locator('body').innerText()}`);
      });
      await page.getByRole('button', { name: fr ? /Finaliser en 1080p/ : es ? /Finalizar en 1080p/ : /Finalize in 1080p/ }).click();
      await expect(page.getByRole('button', { name: fr ? /Lancer le final/ : es ? /Generar el final/ : /Render final/ })).toBeEnabled();
      await selector.selectOption('4k');
      await expect(page.getByRole('button', { name: fr ? /Lancer le final/ : es ? /Generar el final/ : /Render final/ })).toHaveCount(0);
      assert.deepEqual(requests, [{ path: '/api/preflight', resolution: '1080p' }], 'selection alone cannot submit or request a charge');
      await page.getByRole('button', { name: fr ? /Finaliser en 4K/ : es ? /Finalizar en 4K/ : /Finalize in 4K/ }).click();
      const submit = page.getByRole('button', { name: fr ? /Lancer le final.*9,14/ : es ? /Generar el final.*9,14/ : /Render final.*9\.14/ });
      await expect(submit).toBeEnabled();
      assert.equal(requests.filter(row => row.path === '/api/generate').length, 0);
      await submit.click();
      await expect(page.getByRole('link', { name: fr ? 'Voir le final 4K' : es ? 'Ver el final 4K' : 'View final 4K', exact: true })).toHaveAttribute('href', '/app?job=final');
      await expect(page.getByRole('link', { name: fr ? 'Revoir le Draft 480p' : es ? 'Ver el Draft 480p' : 'View Draft 480p', exact: true })).toHaveAttribute('href', '/app?job=draft');
      assert.deepEqual(requests, [{ path: '/api/preflight', resolution: '1080p' }, { path: '/api/preflight', resolution: '4k' }, { path: '/api/generate', resolution: '4k' }]);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    try { await browser?.close(); }
    finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});
