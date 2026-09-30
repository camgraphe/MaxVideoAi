import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [mode, baseline, candidate, output] = process.argv.slice(2);
if (!['prewarm', 'play'].includes(mode) || !baseline || !candidate || !output) {
  throw new Error('Usage: node browser-check.mjs prewarm|play BASELINE_URL CANDIDATE_URL OUTPUT_JSON');
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
const rows = [];
const routes = mode === 'prewarm'
  ? ['/examples', '/examples/wan', '/video/wan-match-cut-film', '/video/3df64f8c-969b-42b0-b83d-71a680503e52']
  : ['/video/wan-match-cut-film', '/video/3df64f8c-969b-42b0-b83d-71a680503e52'];
try {
  for (const device of ['mobile', 'desktop']) {
    for (const route of routes) {
      const cases = [['baseline', baseline], ['candidate', candidate]].flatMap(([variant, base]) =>
        (mode === 'play' && variant === 'candidate' ? ['controls', 'center'] : [mode === 'play' ? 'controls' : 'none'])
          .map(control => [variant, base, control]));
      for (const [variant, base, control] of cases) {
        // A fresh context keeps First Play cold for each version and route.
        const context = await browser.newContext(device === 'mobile'
          ? { viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true }
          : { viewport: { width: 1350, height: 940 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const requests = [];
        page.on('request', request => {
          if (request.resourceType() === 'media' || /\.(mp4|webm)(?:\?|$)/i.test(request.url())) requests.push(request.url());
        });
        try {
          const response = await page.goto(base.replace(/\/$/, '') + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
          if (!response || response.status() >= 400) throw new Error(`${variant} ${device} ${route}: HTTP ${response?.status()}`);
          if (mode === 'prewarm') {
            await page.waitForTimeout(5000);
            const canonicalTag = page.locator('link[rel="canonical"]').first();
            const canonical = await canonicalTag.count() ? await canonicalTag.getAttribute('href') : null;
            rows.push({ variant, device, route, status: response.status(), title: await page.title(), canonical });
            if (variant === 'candidate' && route === '/video/wan-match-cut-film' && !canonical?.endsWith('/video/wan-match-cut-film')) {
              throw new Error(`Candidate landscape canonical mismatch: ${canonical}`);
            }
          } else {
            await page.locator('video').first().waitFor({ state: 'attached', timeout: 15000 });
            await page.waitForTimeout(1500);
            // Make the same real visitor choice in these fresh anonymous contexts.
            // The Lighthouse profiles remain separate and retain the untouched banner.
            await page.getByRole('button', { name: 'Reject all', exact: true }).click({ timeout: 10000 });
            const requestsBeforePlay = [...requests];
            if (requestsBeforePlay.length) throw new Error(`${variant} ${device} ${route}: media requested before Play: ${requestsBeforePlay.join(', ')}`);
            const start = Date.now();
            const playing = page.locator('video').first().evaluate(video => new Promise((resolve, reject) => {
              if (!video.paused && video.readyState >= 3) return resolve(true);
              const timeout = setTimeout(() => reject(new Error('playing event timed out')), 20000);
              video.addEventListener('playing', () => { clearTimeout(timeout); resolve(true); }, { once: true });
              video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(`media error ${video.error?.code}`)); }, { once: true });
            }));
            // Pinned main's gradient overlaps its center button on mobile. Use
            // each real control bar for the paired timing; also test the new
            // center control separately in its own cold context.
            const playButton = variant === 'baseline'
              ? page.locator('main button[aria-label="Play video"]').first()
              : control === 'center' ? page.locator('button.video-reader-centerPlay')
                : page.locator('.video-reader-controls button[aria-label="Play video"]');
            // Attach handlers to both promises immediately so a blocked click cannot
            // be hidden by an unhandled evaluate rejection when the browser closes.
            await Promise.all([playing, playButton.click({ timeout: 10000 })]);
            rows.push({ variant, device, route, control, status: response.status(), requestsBeforePlay, firstPlayMs: Date.now() - start, mediaRequests: requests });
          }
        } catch (error) {
          const screenshot = output.replace(/\.json$/, `-${variant}-${device}-${control}-failure.png`);
          await page.screenshot({ path: screenshot }).catch(() => undefined);
          rows.push({ variant, device, route, control, error: String(error), screenshot, mediaRequests: requests });
          throw new Error(`${variant} ${device} ${route}: ${String(error)}`, { cause: error });
        } finally {
          await page.close();
          await context.close();
        }
      }
    }
  }
} finally {
  writeFileSync(output, JSON.stringify(rows, null, 2) + '\n');
  await browser.close();
}
