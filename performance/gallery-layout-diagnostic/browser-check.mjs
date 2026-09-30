// Read-only instrumentation. This is a causal diagnostic, not a release benchmark.
const [base, output] = process.argv.slice(2);
if (!['1', 'true'].includes(process.env.CI)) throw new Error('Gallery layout diagnostic is CI-only');
if (base !== 'http://127.0.0.1:3212') throw new Error('Gallery layout diagnostic requires the disposable loopback target');
if (!output || !process.env.CHROME_PATH) throw new Error('OUTPUT and CI CHROME_PATH are required');
const { chromium } = await import('@playwright/test');
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
    await contexts[cohort].addInitScript(() => {
      const events = [];
      window.__galleryDiagnostic = events;
      const record = (type, data) => { if (events.length < 12000) events.push({ t: performance.now(), type, ...data }); };
      const selector = '[class*="examples-masonry_card__"]';
      const rect = node => {
        if (!(node instanceof Element)) return null;
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const identify = node => {
        if (!(node instanceof Element)) return null;
        const card = node.closest(selector);
        return { tag: node.tagName, className: String(node.className), href: card?.querySelector('a')?.getAttribute('href'), rect: rect(node) };
      };
      const snapshot = reason => {
        const gallery = document.querySelector('[class*="examples-masonry_gallery__"]');
        const cards = [...document.querySelectorAll(selector)];
        record('geometry', {
          reason, viewport: { innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
          gallery: rect(gallery), videos: document.querySelectorAll('video').length,
          cards: cards.map(card => {
            const style = getComputedStyle(card), parent = getComputedStyle(card.parentElement);
            return { ...identify(card), frame: card.dataset.frame, inline: card.getAttribute('style'),
              parentInline: card.parentElement.getAttribute('style'), parentRect: rect(card.parentElement),
              aspectRatio: style.aspectRatio, width: style.width, height: style.height,
              flex: parent.flex, maxWidth: parent.maxWidth, ratio: parent.getPropertyValue('--video-ratio'),
              imageComplete: card.querySelector('img')?.complete, video: card.querySelector('video') ? {
                paused: card.querySelector('video').paused, width: card.querySelector('video').videoWidth,
                height: card.querySelector('video').videoHeight, readyState: card.querySelector('video').readyState,
              } : null };
          }),
        });
      };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) record('layout-shift', {
          value: entry.value, startTime: entry.startTime, hadRecentInput: entry.hadRecentInput,
          sources: entry.sources.map(source => ({ node: identify(source.node), previousRect: source.previousRect, currentRect: source.currentRect })),
        });
      }).observe({ type: 'layout-shift', buffered: true });
      const observed = new WeakSet();
      const resize = new ResizeObserver(entries => {
        record('resize', { nodes: entries.map(entry => ({ node: identify(entry.target), contentRect: entry.contentRect.toJSON() })) });
        snapshot('resize');
      });
      const observeCards = () => {
        for (const card of document.querySelectorAll(selector)) for (const node of [card, card.parentElement]) {
          if (!observed.has(node)) { observed.add(node); resize.observe(node); }
        }
      };
      const mutation = new MutationObserver(records => {
        const relevant = records.filter(r => r.target instanceof Element && (
          r.target.closest('#gallery') || ['HTML', 'BODY', 'LINK', 'STYLE'].includes(r.target.tagName)
        ));
        if (relevant.length) record('mutation', { nodes: relevant.slice(0, 80).map(r => ({
          node: identify(r.target), kind: r.type, attribute: r.attributeName, oldValue: r.oldValue,
          newValue: r.attributeName ? r.target.getAttribute(r.attributeName) : null,
          added: [...r.addedNodes].filter(n => n instanceof Element).map(n => identify(n)),
          removed: [...r.removedNodes].filter(n => n instanceof Element).map(n => identify(n)),
        })) });
        observeCards();
      });
      mutation.observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['style', 'class', 'src', 'sizes'] });
      for (const event of ['load', 'loadedmetadata', 'playing', 'pause', 'error']) document.addEventListener(event, e => {
        if (e.target instanceof Element && e.target.closest('#gallery')) record(`media-${event}`, { node: identify(e.target) });
      }, true);
      document.addEventListener('DOMContentLoaded', () => { observeCards(); snapshot('DOMContentLoaded'); });
      document.fonts?.addEventListener('loadingdone', () => { record('fonts-loaded', {}); snapshot('fonts-loaded'); });
      const start = performance.now();
      const sample = () => {
        snapshot('sample');
        if (performance.now() - start < 14000) setTimeout(sample, performance.now() - start < 5000 ? 100 : 500);
      };
      setTimeout(sample, 0);
    });
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
