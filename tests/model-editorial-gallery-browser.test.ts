import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import records from '../frontend/config/gpt26-editorial-images.json';
import { parseGpt26EditorialImages } from '../frontend/lib/gpt26-editorial-images';
import { listModelEditorialImages, toGpt26EditorialImages } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const evidenceDirectory = process.env.NOV05_MEDIA_EVIDENCE_DIR;
const source = `
  import {createRoot} from 'react-dom/client';
  import {I18nProvider} from './lib/i18n/I18nProvider';
  import {ModelEditorialImageGallery} from './app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelEditorialImageGallery.client';
  const c=globalThis.fixtureConfig;
  createRoot(document.getElementById('root')).render(<I18nProvider locale={c.locale} dictionary={{}}>
    <main className="mx-auto max-w-6xl p-5"><ModelEditorialImageGallery images={c.images} title={c.title} intro={c.intro}
      anchorId="model-examples" workspaceLabel={c.workspaceLabel} afterGallery={c.afterGallery}/></main>
  </I18nProvider>);
`;

async function startFixture() {
  const bundle = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: frontend }, outdir: '/editorial-media-fixture',
    write: false, bundle: true, platform: 'browser', format: 'esm', splitting: true, jsx: 'automatic', minify: true,
    tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    plugins: [{ name: 'route-context-only', setup(builder) {
      builder.onResolve({ filter: /^@\/i18n\/navigation$/ }, () => ({ path: 'link', namespace: 'route-context' }));
      builder.onLoad({ filter: /.*/, namespace: 'route-context' }, () => ({ loader: 'tsx', resolveDir: frontend, contents:
        `export function Link({href,prefetch,...props}) {return <a href={typeof href==='string'?href:href.pathname} {...props}/>;}` }));
    } }],
  });
  const styles = await readFile(join(frontend, 'app/globals.css'), 'utf8');
  const tokens = await readFile(join(frontend, 'src/styles/tokens.css'), 'utf8');
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: [...tailwindConfig.content.map(pattern => join(frontend, pattern)), { raw: source, extension: 'tsx' }],
  })]).process(`${styles}\n${tokens}`.replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const files = new Map(bundle.outputFiles.map(file => [basename(file.path), file.text]));
  files.set('styles.css', css.css);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://fixture');
    // The fixture exercises the real Next Image URL selection, not its server optimizer.
    if (url.pathname === '/_next/image') { response.writeHead(302, { location: url.searchParams.get('url')! }); response.end(); return; }
    const name = basename(url.pathname);
    if (files.has(name)) { response.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }); response.end(files.get(name)); return; }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

test('editorial image readers defer originals, preserve shared-source edits and retain modal navigation', { timeout: 240_000 }, async t => {
  const fixture = await startFixture();
  const browser = await chromium.launch({ headless: true });
  const originals = parseGpt26EditorialImages(records);
  const evidence: unknown[] = [];
  try {
    if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
    for (const locale of ['en', 'fr', 'es'] as const) for (const variant of ['flare', 'sunburst']) for (const width of [390, 1440]) {
      const content = JSON.parse(await readFile(`content/models/${locale}/gpt-image-2-6-${variant}.json`, 'utf8'));
      const images = toGpt26EditorialImages(originals.filter(image => image.engineId === `gpt-image-2-6-${variant}`), locale, content.examples.editorialImages, originals);
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      if (!evidenceDirectory) await context.route('https://media.maxvideoai.com/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=', 'base64') }));
      const page = await context.newPage();
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', request => requests.push(request.url()));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(fixture.url);
      await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, { locale, images,
        title: content.examples.section.title, intro: content.examples.section.intro,
        workspaceLabel: content.examples.section.recreateLabel, afterGallery: content.prompting.imageExamples.intro });
      await page.addScriptTag({ type: 'module', url: `${fixture.url}/stdin.js` });
      const buttons = page.locator('#model-examples button');
      await buttons.first().waitFor({timeout: 10000}).catch(error => { throw new Error(`${error.message}; browser errors: ${JSON.stringify(errors)}`); });
      assert.equal(await buttons.count(), 2);
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#model-examples img')].every(image => image.complete && image.naturalWidth > 0));
      assert.ok(!requests.some(url => originals.some(image => url.includes(image.original.sha256))), 'initial cards never fetch a full PNG');
      assert.equal(await page.locator('#model-examples a').getAttribute('href'), `/app/image?engine=gpt-image-2-6-${variant}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (evidenceDirectory && locale === 'fr') await page.screenshot({ path: join(evidenceDirectory, `${variant}-${width}-gallery.png`), fullPage: true });
      await buttons.nth(1).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[role="dialog"] img')].every(image => image.complete && image.naturalWidth > 0));
      assert.deepEqual(await dialog.locator('img').evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).src)), [images[1].source!.original.url, images[1].original.url]);
      assert.match(await dialog.locator('figcaption').first().innerText(), /Flare/);
      assert.equal(await dialog.locator('a').getAttribute('href'), images[1].original.url);
      assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
      if (evidenceDirectory && locale === 'fr') await page.screenshot({ path: join(evidenceDirectory, `${variant}-${width}-edit.png`) });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await buttons.nth(1).evaluate(node => node === document.activeElement), true);
      assert.deepEqual(errors, []);
      evidence.push({ locale, variant, width, originalsDeferred: true, commonSource: images[1].source!.original.sha256, modalClosedWithFocusRestored: true });
      await context.close();
    }
    const nano = listModelEditorialImages('nano-banana-2-1', 'en');
    assert.equal(nano.length, 14);
    assert.ok(nano.every(image => image.workspaceHref === '/app/image?engine=nano-banana-2-1' && !image.source));
    if (evidenceDirectory) await writeFile(join(evidenceDirectory, 'browser-evidence.json'), JSON.stringify({ browser: browser.version(), scope: 'Real gallery/modal components; fixture routes and image optimizer redirect. Not a full production page or CWV measurement.', cases: evidence }, null, 2));
    t.diagnostic(`${evidence.length} desktop/mobile/localized image cases; exact original source and modal focus verified`);
  } finally { await browser.close(); await fixture.close(); }
});
