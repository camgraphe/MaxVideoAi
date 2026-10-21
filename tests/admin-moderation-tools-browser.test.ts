import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const toolLabels = ['Upscale', 'Background removal', 'Character', 'Storyboard', 'Angle', 'Restore video', 'Denoise', 'Fix blur', 'Smooth motion'];
const toolIds = ['upscale', 'background-removal', 'character', 'storyboard', 'angle', 'restore-video', 'denoise', 'fix-blur', 'smooth-motion'];

test('moderation exposes each tool through one collapsible control without losing the active filter', { timeout: 120_000 }, async () => {
  const source = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ModerationTableHeader } from './components/admin/moderation/ModerationTableHeader';
    function Fixture() {
      const [surface, setSurface] = useState('video');
      const [bucket, setBucket] = useState('not-published');
      const [loading, setLoading] = useState(false);
      return <main className="admin-workspace p-4">
        <ModerationTableHeader embedded bucket={bucket} surface={surface} isLoadingBucket={loading} viewMode="wall"
          stats={{total: 1, publishedCount: 0, legacyMismatchCount: 0, notPublishedCount: 1, seoWatchCount: 0}}
          onSetViewMode={() => {}} onLoadBucket={(nextBucket, options) => {setBucket(nextBucket); if(options?.surface) setSurface(options.surface);}}
        />
        <output aria-label="Current filter">{surface}:{bucket}</output>
        <button onClick={() => setLoading(value => !value)}>Toggle loading</button>
      </main>;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
  `;
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env': '{"NODE_ENV":"production"}' }, write: false,
    stdin: { contents: source, loader: 'tsx', resolveDir: frontend }, tsconfig: join(frontend, 'tsconfig.json'),
  });
  const styles = await Promise.all([
    readFile(join(frontend, 'app/globals.css'), 'utf8'),
    readFile(join(frontend, 'src/styles/tokens.css'), 'utf8'),
    readFile(join(frontend, 'components/admin-system/shell/admin-workspace.css'), 'utf8'),
  ]);
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: [...tailwindConfig.content.map((pattern: string) => join(frontend, pattern)), { raw: source, extension: 'tsx' }],
  })]).process(styles.join('\n').replace(/@(import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const server = createServer((request, response) => {
    const isScript = request.url === '/fixture.js';
    const isCss = request.url === '/fixture.css';
    response.setHeader('Content-Type', isScript ? 'text/javascript' : isCss ? 'text/css' : 'text/html');
    response.end(isScript ? bundle.outputFiles[0].text : isCss ? css.css : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${address.port}`);
      const tools = page.getByRole('button', { name: 'Tools', exact: true });
      await tools.waitFor({ timeout: 3000 }).catch(error => { throw new Error(`${error.message}; page errors: ${pageErrors.join('; ')}`); });
      assert.equal(await tools.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.getByRole('button', { name: 'Character', exact: true }).count(), 0);
      await tools.focus();
      await page.keyboard.press('Enter');
      assert.equal(await tools.getAttribute('aria-expanded'), 'true');
      for (let index = 0; index < toolLabels.length; index++) {
        await page.getByRole('button', { name: toolLabels[index], exact: true }).click();
        assert.equal(await page.getByLabel('Current filter').textContent(), `${toolIds[index]}:not-published`);
      }
      await page.getByRole('button', { name: 'All', exact: true }).click();
      assert.equal(await page.getByLabel('Current filter').textContent(), 'smooth-motion:all');
      await tools.click();
      assert.equal(await tools.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.getByRole('button', { name: 'Smooth motion', exact: true }).count(), 0);
      assert.match(await page.locator('header').innerText(), /Smooth motion/);
      await tools.click();
      await page.getByRole('button', { name: 'Toggle loading' }).click();
      assert.equal(await page.getByRole('button', { name: 'Upscale', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Toggle loading' }).click();
      await page.getByRole('button', { name: 'Video', exact: true }).click();
      assert.equal(await page.getByLabel('Current filter').textContent(), 'video:all');
      assert.equal(await tools.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no overflow at ${width}px`);
      if (process.env.MODERATION_EVIDENCE_DIR) {
        await mkdir(process.env.MODERATION_EVIDENCE_DIR, { recursive: true });
        await tools.click();
        await page.getByRole('button', { name: 'Upscale', exact: true }).click();
        await page.locator('header').screenshot({ path: join(process.env.MODERATION_EVIDENCE_DIR, `tools-${width}.png`) });
        await tools.click();
        await page.locator('header').screenshot({ path: join(process.env.MODERATION_EVIDENCE_DIR, `collapsed-${width}.png`) });
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
