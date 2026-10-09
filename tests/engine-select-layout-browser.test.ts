import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import test from 'node:test';
import { chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';

const root = process.cwd();
const frontend = join(root, 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const postcss = requireFrontend('postcss');
const tailwind = requireFrontend('tailwindcss');
const evidenceDirectory = process.env.ENGINE_SELECT_EVIDENCE_DIR;
const baseline = process.env.ENGINE_SELECT_LAYOUT_BASELINE === '1';

// The selectors and their children are real. Only the surrounding preview shell
// replaces media/auth/network work; its local module and app CSS remain real.
const fixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { EngineSettingsBar } from './components/EngineSettingsBar';
  import { EngineSelect } from './src/components/ui/EngineSelect';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  import { ensureEngineRegistryMeta, getCachedEngineRegistryMeta } from './src/components/ui/engine-select/engine-select-helpers';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [engineId, setEngineId] = useState(() => config.restored ? localStorage.getItem('fixture.engine') : config.engineId);
    globalThis.selectedEngineId = engineId;
    const props = { engines: config.engines, engineId, onEngineChange: setEngineId, mode: config.branch === 'image' ? 't2i' : 't2v',
      onModeChange() {}, showModeSelect: false, showBillingNote: false, variant: 'bar', controlPresentation: 'workspace',
      density: 'compact', className: 'min-w-0 flex-1', disabledEngineReasons: config.disabledEngineReasons };
    const controls = config.branch === 'image'
      ? <div className="app-image-model-selector min-w-0"><EngineSelect {...props} modeLayout="stacked" /></div>
      : <div className="modelStrip"><div className="modelSelector"><EngineSettingsBar {...props} showModeBadge={false} /></div>
          <div className="commands"><button aria-label="Model review">+</button></div></div>;
    return <I18nProvider locale={config.locale} dictionary={config.dictionary} fallback={{}}>
      <main className="app-workspace-main">
        <h1>Engine selector geometry fixture</h1>
        <section data-selector-shell className={config.branch === 'starter' ? 'app-preview-frame is-workspace' : config.branch === 'image' ? 'app-image-workspace-surface' : 'app-model-strip'}>
          {controls}
        </section>
        <div data-following-content className="app-empty-preview">Following preview content</div>
      </main>
    </I18nProvider>;
  }
  globalThis.registryReady = () => Boolean(getCachedEngineRegistryMeta());
  globalThis.engineFixtureStart = async () => {
    if (config.cached) await ensureEngineRegistryMeta();
    createRoot(document.getElementById('root')).render(<Fixture />);
  };
`;

async function startFixture() {
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, splitting: true, format: 'esm', platform: 'browser',
    jsx: 'automatic', minify: true, define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { contents: fixtureSource, loader: 'tsx', resolveDir: frontend, sourcefile: 'engine-select-fixture.tsx' },
    outdir: '/engine-select-fixture', chunkNames: '[name]-[hash]', write: false, metafile: true,
    tsconfig: join(frontend, 'tsconfig.json'),
  });
  const files = new Map(bundle.outputFiles.map(file => [basename(file.path), file.text]));
  const entry = Object.entries(bundle.metafile!.outputs).find(([, output]) => output.entryPoint?.endsWith('engine-select-fixture.tsx'));
  assert.ok(entry, 'the component fixture entry must exist');
  const entryName = basename(entry[0]);
  const registryChunk = [...files.keys()].find(name => name.startsWith('falEngines-'));
  assert.ok(registryChunk, 'the full registry must remain a deferred chunk');
  const styles = await Promise.all([
    readFile(join(frontend, 'app/globals.css'), 'utf8'),
    readFile(join(frontend, 'src/styles/tokens.css'), 'utf8'),
    readFile(join(frontend, 'src/styles/skeleton.css'), 'utf8'),
    readFile(join(frontend, 'src/styles/app-experience.css'), 'utf8'),
    readFile(join(frontend, 'app/(core)/(workspace)/app/_components/workspace-model-review.module.css'), 'utf8'),
  ]);
  const css = await postcss([tailwind({ ...tailwindConfig, content: [
    ...tailwindConfig.content.map((pattern: string) => join(frontend, pattern)),
    { raw: fixtureSource, extension: 'tsx' },
  ] })]).process(styles.join('\n').replace(/@import[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  files.set('styles.css', css.css);
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://fixture').pathname;
    const name = basename(pathname);
    if (files.has(name)) {
      response.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript', 'cache-control': 'no-store' });
      response.end(files.get(name));
    } else if (pathname.endsWith('.svg')) {
      try {
        const source = await readFile(join(frontend, 'public', pathname));
        response.writeHead(200, { 'content-type': 'image/svg+xml' });
        response.end(source);
      } catch { response.writeHead(404); response.end(); }
    } else {
      response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Engine selector layout fixture</title><link rel="stylesheet" href="/styles.css"></head><body class="app-experience"><div id="root"></div></body></html>');
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    url: `http://127.0.0.1:${address.port}`, registryChunk, entryName,
    initialBytes: bundle.outputFiles.filter(file => !file.path.includes(`/${registryChunk}`)).reduce((sum, file) => sum + file.contents.length, 0),
    async close() { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}

type Scenario = { width: number; locale: 'en' | 'fr' | 'es'; engineId: string; branch: 'starter' | 'empty' | 'image'; restored?: boolean; cached?: boolean; repeat?: number; onlyEngineIds?: string[]; pausedEngineIds?: string[] };
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      model: box('[data-selector-shell] button[aria-haspopup="dialog"]'),
      variant: box('[data-selector-shell] button[aria-haspopup="listbox"]'),
      shell: box('[data-selector-shell]'), following: box('[data-following-content]'),
      name: document.querySelector('[data-selector-shell] button[aria-haspopup="dialog"] p')?.textContent,
      variantText: document.querySelector('[data-selector-shell] button[aria-haspopup="listbox"]')?.textContent,
      selected: (globalThis as any).selectedEngineId,
    };
  });
}

test('deferred registry metadata keeps workspace model/variant geometry stable without recent input', { timeout: 240_000 }, async t => {
  const fixture = await startFixture();
  const browser = await chromium.launch({ headless: true });
  if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
  const results: unknown[] = [];
  const scenarios: Scenario[] = baseline
    ? [0, 1, 2].map(repeat => ({ width: 390, locale: 'en', engineId: 'veo-3-1', branch: 'starter', repeat }))
    : [
        ...[0, 1, 2].map(repeat => ({ width: 390, locale: 'en', engineId: 'veo-3-1', branch: 'starter', repeat } as Scenario)),
        ...[320, 390, 768, 1440].flatMap(width => (['en', 'fr', 'es'] as const).flatMap(locale => [
          { width, locale, engineId: 'minimax-h3-max', branch: 'empty', restored: true } as Scenario,
          { width, locale, engineId: 'pika-text-to-video', branch: 'starter' } as Scenario,
        ])),
        { width: 390, locale: 'fr', engineId: 'veo-3-1', branch: 'starter', cached: true },
        { width: 390, locale: 'es', engineId: 'gpt-image-2-5-flare', branch: 'image', restored: true },
        { width: 320, locale: 'en', engineId: 'gpt-image-2-5-sunburst', branch: 'image' },
        { width: 390, locale: 'en', engineId: 'minimax-h3-max', branch: 'empty', onlyEngineIds: ['minimax-h3-max'] },
        { width: 390, locale: 'en', engineId: 'minimax-h3-max', branch: 'empty', onlyEngineIds: ['minimax-h3-max', 'minimax-h3'], pausedEngineIds: ['minimax-h3'] },
      ];
  try {
    for (const [index, scenario] of scenarios.entries()) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: 844 }, isMobile: scenario.width < 768, hasTouch: true });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      if (scenario.repeat !== undefined) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
      }
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let requested!: () => void;
      const registryRequested = new Promise<void>(resolve => { requested = resolve; });
      await page.route(`**/${fixture.registryChunk}`, async route => {
        requested();
        if (!scenario.cached) await gate;
        await route.continue();
      });
      await page.addInitScript(() => {
        (globalThis as any).process = { env: { NODE_ENV: 'production' } };
        (globalThis as any).__name = (value: unknown) => value;
        (globalThis as any).layoutEntries = [];
        (globalThis as any).longTasks = [];
        (globalThis as any).lcpEntries = [];
        new PerformanceObserver(list => (globalThis as any).layoutEntries.push(...list.getEntries().map((entry: any) => ({
          startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput,
          sources: entry.sources?.map((source: any) => ({ text: source.node?.textContent?.slice(0, 100), previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })),
        })))).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => (globalThis as any).longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver(list => (globalThis as any).lcpEntries.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, size: (entry as any).size })))).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      await page.goto(`${fixture.url}/${scenario.branch === 'image' ? 'app/image' : 'app'}`);
      assert.equal(await page.title(), 'Engine selector layout fixture');
      const dictionary = JSON.parse(await readFile(join(frontend, `messages/${scenario.locale}.json`), 'utf8'));
      const engines = getBaseEnginesByCategory(scenario.branch === 'image' ? 'image' : 'video')
        .filter(engine => !scenario.onlyEngineIds || scenario.onlyEngineIds.includes(engine.id))
        .map(engine => scenario.pausedEngineIds?.includes(engine.id) ? { ...engine, availability: 'paused' as const } : engine);
      await page.evaluate(config => {
        (globalThis as any).fixtureConfig = config;
        if (config.restored) localStorage.setItem('fixture.engine', config.engineId);
      }, { ...scenario, engines, dictionary, disabledEngineReasons: { 'veo-3-1-fast': 'Reference unavailable in this fixture' } });
      await page.addScriptTag({ type: 'module', url: `${fixture.url}/${fixture.entryName}` });
      try { await page.waitForFunction(() => Boolean((globalThis as any).engineFixtureStart)); }
      catch (error) { throw new Error(`Fixture did not start: ${errors.join('; ')}; ${error}`); }
      await page.evaluate(() => (globalThis as any).engineFixtureStart());
      await page.locator('[data-selector-shell] button[aria-haspopup="dialog"]').waitFor();
      if (!scenario.cached) await registryRequested;
      // No clicks/taps or synthetic input anywhere before the late metadata.
      await page.waitForTimeout(600);
      const before = await geometry(page);
      const releaseTime = await page.evaluate(() => performance.now());
      release();
      await page.waitForFunction(() => (globalThis as any).registryReady());
      await page.waitForTimeout(150);
      const after = await geometry(page);
      const entries = await page.evaluate(() => ({ layout: (globalThis as any).layoutEntries, longTasks: (globalThis as any).longTasks, lcp: (globalThis as any).lcpEntries }));
      const metadataShifts = entries.layout.filter((entry: any) => entry.startTime >= releaseTime && !entry.hadRecentInput);
      results.push({ scenario, before, after, releaseTime, ...entries, metadataShifts, errors });
      if (evidenceDirectory && index < 3) await page.screenshot({ path: join(evidenceDirectory, `engine-select-${baseline ? 'before' : 'after'}-${index}.png`) });
      assert.deepEqual(errors, []);
      assert.equal(after.selected, scenario.engineId);
      const entry = listFalEngines().find(entry => entry.id === scenario.engineId)!;
      assert.equal(after.name, entry.marketingName, 'final names stay unchanged');
      const group = entry.surfaces.app.variantGroup;
      const expectedVariants = engines.filter(engine => engine.availability !== 'paused' && group && listFalEngines().find(entry => entry.id === engine.id)?.surfaces.app.variantGroup === group);
      assert.equal(Boolean(after.variant), expectedVariants.length > 1, 'variant choices stay available only for groups with multiple eligible inputs');
      if (after.variant) assert.equal(after.variantText, entry.surfaces.app.variantLabel);
      if (!baseline) {
        assert.deepEqual(after.model, before.model, JSON.stringify({ scenario, before, after, metadataShifts }));
        assert.deepEqual(after.variant, before.variant);
        assert.deepEqual(after.shell, before.shell);
        assert.deepEqual(after.following, before.following);
        assert.equal(after.variantText, before.variantText);
        assert.equal(metadataShifts.length, 0, 'late metadata must not cause an eligible layout shift');
        if (scenario.engineId === 'pika-text-to-video') assert.equal(after.variant, null, 'no permanent empty variant slot');
      }
      if (!baseline && index === 0) {
        const variant = page.locator('[data-selector-shell] button[aria-haspopup="listbox"]');
        await variant.focus();
        await page.keyboard.press('ArrowDown');
        await page.getByRole('listbox').waitFor();
        assert.equal(await page.getByRole('option', { name: 'Fast', exact: true }).isDisabled(), true);
        await page.keyboard.press('Escape');
        const model = page.locator('[data-selector-shell] button[aria-haspopup="dialog"]');
        await model.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await model.getAttribute('aria-expanded'), 'false');
      }
      await context.close();
    }
    t.diagnostic(JSON.stringify({ browser: browser.version(), initialBytes: fixture.initialBytes, scenarios: results.length, baseline }));
  } finally {
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(join(evidenceDirectory, `engine-select-${baseline ? 'before' : 'after'}.json`), JSON.stringify({ initialBytes: fixture.initialBytes, results }, null, 2));
    }
    await browser.close();
    await fixture.close();
  }
});
