// Read-only instrumentation. This is a causal diagnostic, not a release benchmark.
const [base, output] = process.argv.slice(2);
if (!['1', 'true'].includes(process.env.CI)) throw new Error('Gallery layout diagnostic is CI-only');
if (base !== 'http://127.0.0.1:3212') throw new Error('Gallery layout diagnostic requires the disposable loopback target');
if (!output || !process.env.CHROME_PATH) throw new Error('OUTPUT and CI CHROME_PATH are required');
const { chromium } = await import('@playwright/test');
const { installGalleryDiagnostic } = await import('./instrumentation.mjs');
const { mkdirSync, writeFileSync } = await import('node:fs');
const { join } = await import('node:path');
mkdirSync(output, { recursive: true });
const contexts = {};
const rows = [];
try {
  for (const cohort of ['normal', 'reduced']) {
    contexts[cohort] = await chromium.launchPersistentContext(join(output, `profile-${cohort}`), {
      executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'],
      viewport: { width: 1350, height: 940 }, deviceScaleFactor: 1,
      reducedMotion: cohort === 'reduced' ? 'reduce' : 'no-preference',
    });
    await contexts[cohort].addInitScript(installGalleryDiagnostic);
  }
  // Seed excluded, then six warm visits per separate profile. Alternate cohort order.
  for (let visit = 0; visit <= 6; visit++) {
    for (const cohort of visit % 2 ? ['reduced', 'normal'] : ['normal', 'reduced']) {
      const page = await contexts[cohort].newPage();
      const cdp = await contexts[cohort].newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const network = [], consoleErrors = [];
      for (const method of ['Network.responseReceived', 'Network.requestServedFromCache', 'Network.loadingFailed']) {
        cdp.on(method, params => network.push({ method, params }));
      }
      page.on('pageerror', e => consoleErrors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      const name = `${cohort}-${visit === 0 ? 'seed' : `warm-${visit}`}`;
      const response = await page.goto(`${base}/examples`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (response?.status() !== 200) throw new Error(`${name}: HTTP ${response?.status()}`);
      await page.waitForTimeout(15000);
      const events = await page.evaluate(() => window.__galleryDiagnostic);
      await page.screenshot({ path: join(output, `${name}.png`) });
      const shifts = events.filter(e => e.type === 'layout-shift' && !e.hadRecentInput);
      const row = { name, cohort, seed: visit === 0, status: response.status(), shifts,
        maxShift: Math.max(0, ...shifts.map(e => e.value)), totalShift: shifts.reduce((a, e) => a + e.value, 0),
        mediaResponses: network.filter(e => e.params.type === 'Media').length,
        cachedResponses: network.filter(e => e.params.response?.fromDiskCache).length, consoleErrors };
      rows.push(row);
      writeFileSync(join(output, `${name}.json`), JSON.stringify({ row, events, network }, null, 2));
      writeFileSync(join(output, 'summary.json'), JSON.stringify(rows, null, 2));
      console.log(JSON.stringify({ name, shifts: shifts.length, maxShift: row.maxShift, mediaResponses: row.mediaResponses }));
      await page.close();
    }
  }
} finally {
  for (const context of Object.values(contexts)) await context.close();
}
