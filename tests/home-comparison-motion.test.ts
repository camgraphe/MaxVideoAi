import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';

const frontend = join(process.cwd(), 'frontend');
const evidenceDirectory = process.env.HOME_SCORES_EVIDENCE_DIR;
const initialMetrics = [
  { id: 'quality', label: 'Quality', tooltip: 'Editorial quality.', leftValue: 8.4, rightValue: 9.2 },
  { id: 'zero', label: 'Zero', leftValue: 0, rightValue: 0 },
  { id: 'missing', label: 'Missing', leftValue: null, rightValue: null },
];
const opponent = { slug: 'first', name: 'First model', logo: '/first.svg', overall: 8.1, criteriaCount: 3, scores: [9.2, 0, null] };

// Exercise the real owner, shared scoreboard and browser CSS calculation. Only
// the clock, RAF queue and observer notification are controlled test boundaries.
const fixtureSource = `
  import React, { act, Profiler } from 'react';
  import { createRoot } from 'react-dom/client';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { HomeComparisonScores } from './components/marketing/home/HomeComparisonScores.client';
  import { PairedScores } from './components/marketing/PairedScores';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const realNow = performance.now.bind(performance);
  let clock = 0, nextFrame = 0, reduced = false;
  const frames = new Map(), callbacks = new Map(), listeners = new Set(), observers = [];
  const frameSamples = [], commits = [];
  const motion = {
    get matches() { return reduced; },
    addEventListener(type, listener) { listeners.add(listener); },
    removeEventListener(type, listener) { listeners.delete(listener); },
  };
  window.matchMedia = () => motion;
  window.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.target = null; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  window.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); callbacks.set(id, callback); return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const root = createRoot(document.getElementById('root'));
  function element(props) { return <HomeComparisonScores {...props} />; }
  function render(props) { act(() => root.render(<Profiler id="HomeComparisonScores" onRender={(id,phase,actualDuration) => commits.push({ id, phase, actualDuration })}>{element(props)}</Profiler>)); }
  globalThis.scoreFixture = {
    render,
    ssr: props => renderToStaticMarkup(element(props)),
    shared: metrics => renderToStaticMarkup(<PairedScores metrics={metrics} />),
    enter(index = observers.length - 1, isIntersecting = true) {
      const observer = observers[index];
      act(() => {
        const now = performance.now;
        performance.now = () => clock;
        try { observer.callback([{ target: observer.target, isIntersecting, intersectionRatio: isIntersecting ? 0.5 : 0 }], observer); }
        finally { performance.now = now; }
      });
    },
    step(timestamp) {
      clock = timestamp;
      const pending = [...frames]; frames.clear();
      for (const [id, callback] of pending) {
        const before = realNow();
        act(() => callback(timestamp));
        frameSamples.push({ id, timestamp, callbackDurationMs: realNow() - before });
      }
    },
    stale(id, timestamp) { act(() => callbacks.get(id)?.(timestamp)); },
    motion(value) { reduced = value; act(() => listeners.forEach(listener => listener())); },
    unmount() { act(() => root.unmount()); },
    resetMeasurements() { frameSamples.length = 0; commits.length = 0; },
    measurements() { return { commits: [...commits], frames: [...frameSamples] }; },
    lifecycle() { return { pending: [...frames.keys()], listenerCount: listeners.size, observers: observers.map(observer => ({ threshold: observer.options.threshold, disconnected: observer.disconnected })) }; },
  };
`;

async function positions(page: Page) {
  return page.locator('.paired-dot').evaluateAll(markers => markers.map(marker => {
    const track = marker.parentElement!;
    return parseFloat(getComputedStyle(marker).left) / parseFloat(getComputedStyle(track).width) * 100;
  }));
}

async function assertPositions(page: Page, expected: number[]) {
  const actual = await positions(page);
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 0.02, `marker ${index}: expected ${expected[index]}%, received ${value}%`));
}

test('home score motion preserves actual positions and avoids React commits on animation frames', { timeout: 60_000 }, async t => {
  const owners = ['frontend/components/marketing/home/HomeComparisonScores.client.tsx', 'frontend/components/marketing/PairedScores.tsx'];
  const sourceFiles = new Map(await Promise.all(owners.map(async path => [path, await readFile(path, 'utf8')] as const)));
  const bundle = await build({
    stdin: { contents: fixtureSource, loader: 'tsx', resolveDir: frontend },
    write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"test"' },
  });
  const css = (await Promise.all(['src/styles/marketing-redesign.css', 'src/styles/marketing-home.css']
    .map(path => readFile(join(frontend, path), 'utf8')))).join('\n');
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  async function mount(reduced = false) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().resourceType() === 'document'
      ? route.fulfill({ contentType: 'text/html', body: '<html><head><title>Home score motion fixture</title></head><body class="marketing-site"><div id="root" style="width:600px"></div></body></html>' })
      : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"></svg>' }));
    await page.goto('http://home-scores.test/');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: 'globalThis.process = { env: { NODE_ENV: "test" } };' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(value => (window as any).scoreFixture.motion(value), reduced);
    return page;
  }
  const props = { label: 'Editorial /10', metrics: initialMetrics, right: opponent, overallLabel: 'Overall score', leftOverall: 8.4 };
  try {
    await t.test('initial SSR/no-JavaScript positions and default shared output remain final, including unavailable scores', async () => {
      const page = await mount();
      try {
        const invalid = [...initialMetrics, { id: 'invalid', label: 'Invalid', leftValue: Number.NaN, rightValue: 11 }, { id: 'negative', label: 'Negative', leftValue: -1, rightValue: Number.POSITIVE_INFINITY }];
        const html = await page.evaluate(input => (window as any).scoreFixture.ssr(input), { ...props, metrics: invalid });
        const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1200, height: 900 } });
        const staticPage = await context.newPage();
        try {
          await staticPage.setContent(`<html><head><style>${css}</style></head><body class="marketing-site"><div style="width:600px">${html}</div></body></html>`);
          await assertPositions(staticPage, [84, 92, 0, 0]);
          assert.match(await staticPage.locator('.paired-values').first().textContent() ?? '', /8\.4.*9\.2/);
          assert.match(await staticPage.locator('.paired-values').nth(3).textContent() ?? '', /—.*—/);
          assert.match(await staticPage.locator('.comparison-overall').textContent() ?? '', /8\.4.*8\.1/);
        } finally { await context.close(); }
        const shared = await page.evaluate(metrics => (window as any).scoreFixture.shared(metrics), initialMetrics);
        assert.deepEqual([...shared.matchAll(/style="left:([^"]+)"/g)].map(match => match[1]), ['84%', '92%', '0%', '0%']);
      } finally { await page.close(); }
    });

    await t.test('one entry retains the fixed left score, cubic midpoint, 1100ms endpoint and zero frame commits', async () => {
      const page = await mount();
      try {
        await page.evaluate(input => (window as any).scoreFixture.render(input), props);
        await page.waitForFunction(() => [...document.images].every(image => image.complete));
        await assertPositions(page, [84, 92, 0, 0]);
        const lifecycle = await page.evaluate(() => (window as any).scoreFixture.lifecycle());
        assert.equal(lifecycle.observers[0].threshold, 0.35);
        await page.evaluate(() => { (window as any).scoreFixture.resetMeasurements(); (window as any).scoreFixture.enter(0, false); });
        await assertPositions(page, [84, 92, 0, 0]);
        await page.evaluate(() => (window as any).scoreFixture.enter(0));
        await assertPositions(page, [84, 0, 0, 0]);
        await page.evaluate(() => { for (let frame = 1; frame <= 33; frame++) (window as any).scoreFixture.step(frame * 1100 / 66); });
        await assertPositions(page, [84, 80.5, 0, 0]);
        await page.evaluate(() => { for (let frame = 34; frame <= 66; frame++) (window as any).scoreFixture.step(frame * 1100 / 66); });
        await assertPositions(page, [84, 92, 0, 0]);
        const measurements = await page.evaluate(() => (window as any).scoreFixture.measurements());
        assert.equal(measurements.frames.length, 66);
        if (evidenceDirectory) {
          await mkdir(evidenceDirectory, { recursive: true });
          await writeFile(join(evidenceDirectory, 'candidate.json'), JSON.stringify({
            source: 'candidate working tree',
            environment: 'Chromium; actual HomeComparisonScores and PairedScores; React test/development Profiler; controlled 66 frame clock; no StrictMode',
            browserVersion: browser.version(),
            sourceSha256: Object.fromEntries([...sourceFiles].map(([path, source]) => [path, createHash('sha256').update(source).digest('hex')])),
            fixtureSha256: createHash('sha256').update(fixtureSource).digest('hex'),
            stylesSha256: createHash('sha256').update(css).digest('hex'),
            scope: 'Owner animation callbacks and React commits only; not field INP or page CWV',
            viewport: { width: 1200, height: 900 }, elapsedMs: 1100, markerEndpoints: await positions(page),
            reactCommitsDuringAnimation: measurements.commits.length, ...measurements,
          }, null, 2));
        }
        t.diagnostic(JSON.stringify({ animationFrames: measurements.frames.length, reactCommitsDuringAnimation: measurements.commits.length }));
        assert.equal(measurements.commits.length, 0, 'animation frames must not render the owner, contender logos or score labels');
        await page.evaluate(() => (window as any).scoreFixture.enter(0));
        await assertPositions(page, [84, 92, 0, 0]);
        assert.deepEqual((await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending, []);
      } finally { await page.close(); }
    });

    await t.test('without an explicit opponent both sides animate without changing readable labels', async () => {
      const page = await mount();
      try {
        await page.evaluate(input => (window as any).scoreFixture.render(input), { label: props.label, metrics: initialMetrics });
        await page.evaluate(() => (window as any).scoreFixture.enter());
        await assertPositions(page, [0, 0, 0, 0]);
        await page.evaluate(() => (window as any).scoreFixture.step(550));
        await assertPositions(page, [73.5, 80.5, 0, 0]);
        assert.match(await page.locator('.paired-values').first().textContent() ?? '', /8\.4.*9\.2/);
        await page.evaluate(() => (window as any).scoreFixture.step(1100));
        await assertPositions(page, [84, 92, 0, 0]);
      } finally { await page.close(); }
    });

    await t.test('mid-animation metric updates retain progress and model replacement invalidates the old frame', async () => {
      const page = await mount();
      try {
        await page.evaluate(input => (window as any).scoreFixture.render(input), props);
        await page.evaluate(() => { (window as any).scoreFixture.enter(); (window as any).scoreFixture.step(550); });
        const updated = { ...props, metrics: [{ ...initialMetrics[0], leftValue: 7.1, rightValue: 6.8 }, ...initialMetrics.slice(1)] };
        await page.evaluate(input => (window as any).scoreFixture.render(input), updated);
        await assertPositions(page, [71, 59.5, 0, 0]);
        assert.equal((await page.evaluate(() => (window as any).scoreFixture.lifecycle())).observers.length, 1, 'parent rerenders and changed scores do not restart entry motion');
        const stale = (await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending[0];
        const replacement = { ...updated, right: { ...opponent, slug: 'replacement', name: 'Replacement model' } };
        await page.evaluate(input => (window as any).scoreFixture.render(input), replacement);
        await assertPositions(page, [71, 68, 0, 0]);
        const afterSwitch = await page.evaluate(() => (window as any).scoreFixture.lifecycle());
        assert.equal(afterSwitch.observers[0].disconnected, true);
        assert.equal(afterSwitch.observers.length, 2);
        assert.deepEqual(afterSwitch.pending, []);
        await page.evaluate(id => (window as any).scoreFixture.stale(id, 900), stale);
        await assertPositions(page, [71, 68, 0, 0]);
        await page.evaluate(() => { (window as any).scoreFixture.enter(1); (window as any).scoreFixture.step(1100); });
        await assertPositions(page, [71, 59.5, 0, 0]);
        await page.evaluate(() => (window as any).scoreFixture.step(1650));
        await assertPositions(page, [71, 68, 0, 0]);
      } finally { await page.close(); }
    });

    await t.test('reduced-motion changes finish and cancel motion without replay, and unmount cancels pending work', async () => {
      const page = await mount();
      try {
        await page.evaluate(input => (window as any).scoreFixture.render(input), props);
        await page.evaluate(() => { (window as any).scoreFixture.enter(); (window as any).scoreFixture.step(275); });
        await assertPositions(page, [84, 53.1875, 0, 0]);
        const stale = (await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending[0];
        await page.evaluate(() => (window as any).scoreFixture.motion(true));
        await assertPositions(page, [84, 92, 0, 0]);
        assert.deepEqual((await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending, []);
        await page.evaluate(id => (window as any).scoreFixture.stale(id, 550), stale);
        await assertPositions(page, [84, 92, 0, 0]);
        await page.evaluate(() => { (window as any).scoreFixture.motion(false); (window as any).scoreFixture.enter(); });
        await assertPositions(page, [84, 92, 0, 0]);
        assert.deepEqual((await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending, []);
        await page.evaluate(input => (window as any).scoreFixture.render(input), { ...props, right: { ...opponent, slug: 'next' } });
        await page.evaluate(() => (window as any).scoreFixture.enter());
        assert.equal((await page.evaluate(() => (window as any).scoreFixture.lifecycle())).pending.length, 1);
        await page.evaluate(() => (window as any).scoreFixture.unmount());
        const unmounted = await page.evaluate(() => (window as any).scoreFixture.lifecycle());
        assert.deepEqual(unmounted.pending, []);
        assert.equal(unmounted.listenerCount, 0);
        assert.ok(unmounted.observers.every((observer: { disconnected: boolean }) => observer.disconnected));
      } finally { await page.close(); }
      const reduced = await mount(true);
      try {
        await reduced.evaluate(input => (window as any).scoreFixture.render(input), props);
        await assertPositions(reduced, [84, 92, 0, 0]);
        assert.deepEqual((await reduced.evaluate(() => (window as any).scoreFixture.lifecycle())).observers, []);
        await reduced.evaluate(() => (window as any).scoreFixture.motion(false));
        await assertPositions(reduced, [84, 92, 0, 0]);
        assert.deepEqual((await reduced.evaluate(() => (window as any).scoreFixture.lifecycle())).pending, []);
      } finally { await reduced.close(); }
    });
    assert.deepEqual(errors, [], 'the rendered owner must have no browser runtime errors');
  } finally { await browser.close(); }
});
