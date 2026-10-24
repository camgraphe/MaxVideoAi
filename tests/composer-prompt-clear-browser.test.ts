import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { listFalEngines } from '../frontend/src/config/falEngines';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const fixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { Composer } from './components/Composer';
  import { I18nProvider } from './lib/i18n/I18nProvider';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [prompt, setPrompt] = useState('A night scene\\nWith emoji 🌙 and accents é');
    const [settings, setSettings] = useState({ engine: config.engine, mode: null, multi: false });
    globalThis.replacePrompt = setPrompt;
    globalThis.updateSettings = patch => setSettings(previous => ({...previous, ...patch}));
    return <I18nProvider locale={config.locale} dictionary={config.dictionary} fallback={{}}>
      <main className="app-workspace-main">
        <Composer density={config.density} engine={settings.engine} prompt={prompt} onPromptChange={setPrompt}
          activeManualMode={settings.mode} promptRequired assetFields={[{ field: { id: 'reference_images', label: 'References', type: 'image', maxCount: 1 }, required: false,
            role: 'reference', headerAction: <button type="button" onClick={() => globalThis.characterOpens += 1}>Character Builder</button> }]} assets={{}}
          subjectReferences={{ hasSubjects: false, content: <div>Kling subject editor</div> }}
          promotedActions={[{ id: 'storyboard-launch', label: 'Storyboard', icon: 'sparkles', active: false, onToggle: () => globalThis.storyboardOpens += 1 }]} price={1} currency="USD" isLoading={false}
          onGenerate={() => { globalThis.submissions += 1; }}
          multiPrompt={{ enabled: settings.multi, scenes: [{ id: 'scene', prompt: 'Untouched scene', duration: 5 }],
            totalDurationSec: 5, minDurationSec: 1, maxDurationSec: 10, onToggle: multi => setSettings(previous => ({...previous, multi})),
            onAddScene: () => {}, onRemoveScene: () => {}, onUpdateScene: () => {} }} />
      </main>
    </I18nProvider>;
  }
  globalThis.submissions = 0; globalThis.characterOpens = 0; globalThis.storyboardOpens = 0;
  globalThis.synchronousFocus = [];
  const promptClicks = new WeakMap();
  document.addEventListener('click', event => {
    const button = event.target.closest('button[aria-controls]');
    const input = button && document.getElementById(button.getAttribute('aria-controls'));
    if (input instanceof HTMLTextAreaElement) promptClicks.set(event, input);
  }, true);
  document.addEventListener('click', event => {
    const input = promptClicks.get(event);
    if (input) globalThis.synchronousFocus.push(document.activeElement === input);
  });
  createRoot(document.getElementById('root')).render(<Fixture />);
`;

async function startFixture() {
  const bundle = await build({ stdin: { contents: fixtureSource, loader: 'tsx', resolveDir: frontend },
    outdir: '/composer-prompt-fixture', write: false, bundle: true, platform: 'browser', format: 'iife',
    jsx: 'automatic', minify: true, tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' } });
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css']
    .map(path => readFile(join(frontend, path), 'utf8')));
  // This fixture injects the production config with absolute content paths.
  // Remove file-level config selection; public-prose-styles tests the real @config boundary.
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig, content: [
    ...tailwindConfig.content.map(pattern => join(frontend, pattern)), { raw: fixtureSource, extension: 'tsx' },
  ] })]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
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

test('shared composer clears and safely restores prompts with touch and keyboard', { timeout: 180_000 }, async t => {
  const fixture = await startFixture();
  const evidence = process.env.COMPOSER_PROMPT_EVIDENCE_DIR;
  const browsers = [chromium, webkit];
  try {
    for (const browserType of browsers) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const width of [390, 1440]) for (const locale of ['en', 'fr', 'es'] as const) for (const density of ['workspace', 'default']) {
          const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: width === 390 });
          const page = await context.newPage(); const errors: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          const copy = { en: ['Clear', 'Undo clearing'], fr: ['Effacer', 'Annuler l’effacement'], es: ['Borrar', 'Deshacer borrado'] }[locale];
          await page.addInitScript(() => { (globalThis as any).process = { env: { NODE_ENV: 'production' } }; (globalThis as any).__name = (value: unknown) => value; });
          await page.goto(fixture.url);
          const catalogEngine = listFalEngines().find(entry => entry.id === 'veo-3-1')!.engine;
          const engine = { ...catalogEngine, inputLimits: { ...catalogEngine.inputLimits, promptMaxChars: 1000 } };
          const dictionary = JSON.parse(await readFile(join(frontend, `messages/${locale}.json`), 'utf8'));
          await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, { locale, density, engine, dictionary });
          await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
          const input = page.locator('[data-workspace-prompt]');
          await input.waitFor();
          const original = await input.inputValue();
          const clear = page.getByRole('button', { name: copy[0], exact: true });
          const undo = page.getByRole('button', { name: copy[1], exact: true });
          assert.equal(await clear.count(), 1, `${browserType.name()} ${width} ${locale} ${density}: prompt clear action must be available`);
          assert.equal(await page.locator('.app-prompt-surface').getByRole('button', { name: 'Character Builder' }).count(), 0);
          const character = page.getByRole('button', { name: 'Character Builder', exact: true });
          await character.click();
          assert.equal(await page.evaluate(() => (globalThis as any).characterOpens), 1, 'character tools retain their reference-area action');
          await page.getByRole('button', { name: 'Storyboard', exact: true }).click();
          assert.equal(await page.evaluate(() => (globalThis as any).storyboardOpens), 1);
          const bounds = await clear.boundingBox();
          const labelBounds = await page.locator('label[for]').filter({ hasText: 'Prompt' }).first().boundingBox();
          assert.ok(bounds && labelBounds && bounds.x > labelBounds.x && labelBounds.y >= bounds.y && labelBounds.y < bounds.y + bounds.height, 'clear stays on the prompt-label line at its right');
          assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44, 'clear has a 44px touch target');
          const activate = async (button: typeof clear) => { if (width === 390) await button.tap(); else { await button.focus(); await page.keyboard.press('Enter'); } };
          await input.focus();
          await activate(clear);
          assert.equal(await input.inputValue(), '');
          assert.equal(await input.evaluate(element => document.activeElement === element), true, 'clear returns focus to the actual textarea');
          assert.equal(await clear.count(), 0);
          assert.equal(await undo.count(), 1);
          const undoBounds = await undo.boundingBox();
          assert.ok(undoBounds && undoBounds.height >= 44 && undoBounds.width >= 44);
          if (evidence && locale === 'fr' && density === 'workspace') { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: join(evidence, `${browserType.name()}-${width}-cleared.png`) }); }
          await activate(undo);
          assert.equal(await input.inputValue(), original);
          assert.equal(await input.evaluate(element => document.activeElement === element), true);
          await activate(clear);
          await input.fill('My new prompt');
          assert.equal(await undo.count(), 0, 'undo cannot overwrite new text');
          await input.fill('');
          assert.equal(await undo.count(), 0, 'manual deletion must not revive a stale backup');
          assert.equal(await clear.count(), 0);
          await input.fill('   ');
          await activate(clear); await activate(undo);
          assert.equal(await input.inputValue(), '   ', 'whitespace is preserved exactly');
          await input.fill('Latest draft');
          await activate(clear);
          await page.evaluate(() => (globalThis as any).replacePrompt('External draft'));
          await expect(input).toHaveValue('External draft');
          assert.equal(await input.inputValue(), 'External draft');
          assert.equal(await undo.count(), 0);
          await page.evaluate(engine => (globalThis as any).updateSettings({ mode: 'extend', engine: { ...engine, id: 'sora-2', label: 'Sora 2' } }), engine);
          assert.equal(await input.inputValue(), 'External draft', 'mode/model changes retain prose');
          await activate(clear); await activate(undo);
          assert.equal(await input.inputValue(), 'External draft', 'repeated clearing restores only the latest draft');
          await page.evaluate(() => (globalThis as any).updateSettings({ multi: true }));
          await page.getByRole('button', { name: 'Multi-prompt on', exact: true }).waitFor();
          assert.equal(await clear.count(), 0, 'multi-prompt scenes must not expose a global clear');
          assert.equal(await undo.count(), 0);
          assert.ok(await page.locator('textarea').filter({ hasText: 'Untouched scene' }).count());
          await page.evaluate(() => (globalThis as any).updateSettings({ multi: false }));
          await input.waitFor();
          assert.equal(await input.inputValue(), 'External draft');
          assert.equal(await page.evaluate(() => (globalThis as any).submissions), 0, 'editing never submits a generation');
          const synchronousFocus = await page.evaluate(() => (globalThis as any).synchronousFocus);
          assert.ok(synchronousFocus.length >= 8 && synchronousFocus.every(Boolean), `every clear/undo focuses before the trusted click finishes: ${JSON.stringify(synchronousFocus)}`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          assert.deepEqual(errors, []);
          if (evidence && locale === 'fr' && density === 'workspace') await page.screenshot({ path: join(evidence, `${browserType.name()}-${width}-restored.png`) });
          await context.close();
        }
        t.diagnostic(`${browserType.name()} ${browser.version()}: 12 scenarios passed`);
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
