import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import test from 'node:test';
import { chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { listFalEngines } from '../frontend/src/config/falEngines';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const evidenceDirectory = process.env.COMPOSER_QUOTE_EVIDENCE_DIR;
const recordBaseline = process.env.COMPOSER_QUOTE_BASELINE === '1';
const fixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { Composer } from './components/Composer';
  import { CoreSettingsBar } from './components/CoreSettingsBar';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [phase,setPhase] = useState('pricing');
    globalThis.updateQuote = next => setTimeout(() => setPhase(next), 10);
    const pricing = phase === 'pricing' || phase === 'refresh';
    const price = phase === 'quote' ? 1.23 : phase === 'longQuote' ? 12345.67 : phase === 'refresh' ? 1.23 : null;
    return <I18nProvider locale={config.locale} dictionary={config.dictionary} fallback={{}}>
      <main className="app-workspace-main">
        <h1>Composer quote layout fixture</h1>
        <Composer density={config.density} engine={config.engine} prompt="A night scene" onPromptChange={() => {}}
          promptRequired assetFields={[]} assets={{}} price={price} currency="USD" isPricing={pricing}
          isLoading={phase === 'sending'} disableGenerate={phase === 'unavailable'}
          pendingGenerations={config.pending ? [{id:'one',engineLabel:config.engine.label,prompt:'A night scene',durationSec:5}] : []}
          onGenerate={() => { globalThis.submissions += 1; }}
          settingsBar={<CoreSettingsBar density="workspace" engine={config.engine} mode={config.branch === 'image' ? 't2i' : 't2v'}
            durationSec={5} onDurationChange={() => {}} resolution={config.branch === 'image' ? '2K' : '720p'} onResolutionChange={() => {}}
            aspectRatio="16:9" onAspectRatioChange={() => {}} fps={24} onFpsChange={() => {}} />}
          optionsControl={<button className="app-options-button" aria-label="Options">+</button>} />
        <div data-rail-sentinel className="app-empty-preview">Following gallery</div>
      </main>
      <output hidden data-phase>{phase}</output>
    </I18nProvider>;
  }
  globalThis.submissions = 0;
  createRoot(document.getElementById('root')).render(<Fixture />);
`;

async function startFixture() {
  const bundle = await build({ stdin: { contents: fixtureSource, loader: 'tsx', resolveDir: frontend },
    outdir: '/composer-quote-fixture', write: false, bundle: true, platform: 'browser', format: 'iife',
    jsx: 'automatic', minify: true, tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' } });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css']
    .map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig, content: [
    ...tailwindConfig.content.map(pattern => join(frontend, pattern)), { raw: fixtureSource, extension: 'tsx' },
  ] })]).process(styles.join('\n').replace(/@import[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const files = new Map(bundle.outputFiles.map(file => [basename(file.path), file.text]));
  files.set('styles.css', css.css);
  const script = [...files.keys()].find(name => name.endsWith('.js'))!;
  const server = createServer((request, response) => {
    const name = basename(new URL(request.url ?? '/', 'http://fixture').pathname);
    if (files.has(name)) {
      response.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }); response.end(files.get(name));
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body class="app-experience"><div id="root"></div></body></html>');
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, script,
    async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const box = (selector: string) => rect(document.querySelector(selector)!);
    const action = document.querySelector<HTMLButtonElement>('.app-generation-action')!;
    const toolbar = document.querySelector('.app-composer-toolbar')!;
    const bounds = toolbar.getBoundingClientRect();
    const controls = [...toolbar.querySelectorAll('button:not(.app-generation-popover button)')].map(rect);
    const overflows = controls.some(r => r.x < bounds.x - 1 || r.x + r.width > bounds.right + 1);
    const overlaps = controls.some((left, i) => controls.slice(i + 1).some(right =>
      left.x < right.x + right.width - 1 && left.x + left.width > right.x + 1 && left.y < right.y + right.height - 1 && left.y + left.height > right.y + 1));
    return { toolbar: box('.app-composer-toolbar'), submit: box('.app-composer-submit'), button: rect(action),
      rail: box('[data-rail-sentinel]'), settings: [...toolbar.querySelectorAll('button:not(.app-generation-action):not(.app-generation-count)')].map(rect),
      disabled: action.disabled, busy: action.getAttribute('aria-busy'), text: action.innerText, overflows, overlaps,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}

test('asynchronous quote states preserve workspace controls and following gallery geometry', { timeout: 240_000 }, async t => {
  const fixture = await startFixture();
  const browser = await chromium.launch({ headless: true });
  const results: unknown[] = [];
  const scenarios = recordBaseline ? [{ width: 390, locale: 'en' as const, branch: 'video' as const, pending: false }]
    : [320, 390, 768, 1440].flatMap(width => (['en', 'fr', 'es'] as const).flatMap(locale =>
      (['video', 'image'] as const).flatMap(branch => [false, true].map(pending => ({ width, locale, branch, pending })))));
  try {
    for (const [index, scenario] of scenarios.entries()) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: 844 }, reducedMotion: scenario.pending ? 'reduce' : 'no-preference' });
      const page = await context.newPage(); const errors: string[] = [];
      const cdp = await context.newCDPSession(page);
      const accessibility: Record<string, unknown> = {};
      const statusCopy = { en: ['Calculating…', 'Price unavailable'], fr: ['Calcul…', 'Prix indisponible'], es: ['Calculando…', 'Precio no disponible'] }[scenario.locale];
      async function checkAccessibility(phase: string) {
        if (recordBaseline) return;
        const tree = await cdp.send('Accessibility.getFullAXTree');
        const exposed = tree.nodes.filter(node => !node.ignored);
        const expected = phase === 'quote' ? '$1.23' : phase === 'longQuote' ? '$12,345.67' : statusCopy[phase === 'unavailable' ? 1 : 0];
        const text = exposed.find(node => node.role?.value === 'StaticText' && node.name?.value === expected);
        assert.ok(text, `${JSON.stringify(scenario)} ${phase}: true quote/status must be exposed to assistive technology`);
        let ancestor = text;
        while (ancestor && ancestor.role?.value !== 'status') ancestor = tree.nodes.find(node => node.nodeId === ancestor!.parentId)!;
        assert.ok(ancestor && !ancestor.ignored, `${phase}: the quote live region must remain exposed inside the disabled button`);
        assert.equal(ancestor.properties?.find(property => property.name === 'live')?.value.value, 'polite');
        for (const hidden of statusCopy.filter(value => value !== expected)) {
          assert.equal(exposed.filter(node => node.role?.value === 'StaticText' && node.name?.value === hidden).length, 0, `${phase}: sizing text must stay out of the accessibility tree`);
        }
        assert.equal(exposed.filter(node => node.role?.value === 'StaticText' && node.name?.value === expected).length, 1, 'only the current quote/status is announced');
        accessibility[phase] = tree;
      }
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        (globalThis as any).process = { env: { NODE_ENV: 'production' } };
        (globalThis as any).__name = (value: unknown) => value;
        (globalThis as any).layoutShifts = [];
        new PerformanceObserver(list => (globalThis as any).layoutShifts.push(...list.getEntries().map((entry: any) => ({
          startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput,
          sources: entry.sources?.map((source: any) => ({ element: source.node?.nodeName, text: source.node?.textContent?.slice(0, 100), previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })),
        })))).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${fixture.url}/app${scenario.branch === 'image' ? '/image' : ''}`);
      const engine = listFalEngines().find(entry => entry.id === (scenario.branch === 'image' ? 'seedream' : 'veo-3-1'))!.engine;
      const dictionary = JSON.parse(await readFile(join(frontend, `messages/${scenario.locale}.json`), 'utf8'));
      await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, { ...scenario, engine, dictionary, density: 'workspace' });
      await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
      try { await page.locator('.app-generation-action').waitFor(); }
      catch (error) { throw new Error(`Composer did not render: ${errors.join('; ')}; ${error}`); }
      await page.waitForTimeout(600); // All subsequent transitions have no recent browser input.
      const snapshots: Record<string, Awaited<ReturnType<typeof geometry>>> = { pricing: await geometry(page) };
      await checkAccessibility('pricing');
      const start = await page.evaluate(() => performance.now());
      const capture = evidenceDirectory && (scenario.width === 390 && scenario.locale === 'en' && scenario.branch === 'video' && !scenario.pending
        || scenario.width === 320 && scenario.locale === 'es' && scenario.branch === 'image' && scenario.pending);
      if (capture) { await mkdir(evidenceDirectory!, { recursive: true }); await page.screenshot({ path: join(evidenceDirectory!, `${recordBaseline ? 'before' : 'after'}-${index}-pricing.png`) }); }
      for (const phase of ['quote', 'refresh', 'longQuote', 'unavailable']) {
        await page.evaluate(next => (globalThis as any).updateQuote(next), phase);
        await page.waitForFunction(next => document.querySelector('[data-phase]')?.textContent === next, phase);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        snapshots[phase] = await geometry(page);
        await checkAccessibility(phase);
        if (capture && phase !== 'refresh') await page.screenshot({ path: join(evidenceDirectory!, `${recordBaseline ? 'before' : 'after'}-${index}-${phase}.png`) });
      }
      const shifts = await page.evaluate(start => (globalThis as any).layoutShifts.filter((entry: any) => entry.startTime >= start && !entry.hadRecentInput), start);
      results.push({ scenario, snapshots, shifts, accessibility, errors });
      assert.deepEqual(errors, []);
      assert.equal(snapshots.pricing.disabled, true); assert.equal(snapshots.refresh.disabled, true);
      assert.equal(snapshots.pricing.busy, null); assert.equal(snapshots.refresh.busy, null);
      assert.match(snapshots.quote.text!, /\$1\.23/); assert.match(snapshots.longQuote.text!, /\$12,345\.67/);
      assert.doesNotMatch(snapshots.refresh.text!, /\$1\.23/); assert.equal(snapshots.quote.disabled, false);
      assert.match(await page.locator('.app-quote-status:not([aria-hidden="true"])').last().innerText(), /unavailable|indisponible|no disponible/);
      if (!recordBaseline) {
        for (const [phase, snapshot] of Object.entries(snapshots)) {
          for (const part of ['toolbar', 'submit', 'button', 'rail', 'settings'] as const) assert.deepEqual(snapshot[part], snapshots.pricing[part], JSON.stringify({ scenario, phase, part, snapshots, shifts }));
          assert.equal(snapshot.overflows, false, `${JSON.stringify(scenario)} ${phase}: controls overflow`);
          assert.equal(snapshot.overlaps, false, `${JSON.stringify(scenario)} ${phase}: controls overlap`);
          assert.equal(snapshot.documentOverflow, false, `${JSON.stringify(scenario)} ${phase}: document overflow`);
        }
        assert.deepEqual(shifts, [], `${JSON.stringify(scenario)}: asynchronous quote layout shifts`);
        assert.ok(await page.locator('.app-quote-status:not([aria-hidden="true"])').isVisible(), 'unavailable status remains readable');
        if (scenario.pending) {
          const activity = page.locator('.app-generation-count');
          await activity.focus(); await page.keyboard.press('Enter'); await page.getByRole('dialog').waitFor();
          await page.keyboard.press('Escape'); assert.equal(await activity.evaluate(element => document.activeElement === element), true);
          assert.equal(await page.evaluate(() => (globalThis as any).submissions), 0, 'activity never submits generation');
          assert.equal(await page.locator('.app-generation-spinner').first().evaluate(element => getComputedStyle(element).animationDuration), '0s');
        }
      }
      await context.close();
    }
    t.diagnostic(JSON.stringify({ browser: browser.version(), scenarios: results.length, recordBaseline }));
  } finally {
    if (evidenceDirectory) { await mkdir(evidenceDirectory, { recursive: true }); await writeFile(join(evidenceDirectory, `composer-quote-${recordBaseline ? 'before' : 'after'}.json`), JSON.stringify(results, null, 2)); }
    await browser.close(); await fixture.close();
  }
});
