import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';
import { buildHomePriceDemo } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-price-demo-data';

const frontend = join(process.cwd(), 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));

test('home demo shows only the exact quote and keeps its button inside the marketing frame', { timeout: 120_000 }, async () => {
  const source = `import {createRoot} from 'react-dom/client';
    import {HomePriceAppSurface} from './components/marketing/home/HomePriceAppSurface.client';
    const root=createRoot(document.getElementById('root'));
    globalThis.renderDemo=props=>root.render(<HomePriceAppSurface {...props}/>);`;
  const bundle = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: frontend }, write: false, outfile: 'demo.js',
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', minify: true,
    tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' } });
  // Marketing deliberately does not load the authenticated app stylesheet.
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/marketing-home.css']
    .map(path => readFile(join(frontend, path), 'utf8')));
  // This fixture injects the production config with absolute content paths.
  // Remove file-level config selection; public-prose-styles tests the real @config boundary.
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: tailwindConfig.content.map(pattern => join(frontend, pattern)),
  })]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const server = createServer((req, res) => {
    const name = req.url;
    res.setHeader('content-type', name === '/demo.js' ? 'text/javascript' : name === '/style.css' ? 'text/css' : 'text/html');
    res.end(name === '/demo.js' ? bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text : name === '/style.css' ? css.css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '') :
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="marketing-site"><div class="price-app-frame" style="max-width:760px;margin:16px"><div id="root"></div></div><script src="/demo.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch();
  const evidence: unknown[] = [];
  try {
    for (const width of [320, 390, 768, 1440]) for (const locale of ['en', 'fr', 'es'] as const) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on('pageerror', error => console.error(error.message));
      await page.addInitScript(() => { (window as any).process = {env:{NODE_ENV:'production'}}; (window as any).__name = (value:unknown) => value; });
      await page.goto(`http://127.0.0.1:${address.port}`);
      const [model] = buildHomePriceDemo(locale);
      const boxes: unknown[] = [];
      for (const step of model.steps) {
        await page.evaluate(props => (window as any).renderDemo(props), { model, step, locale });
        await page.locator('.app-generation-price').filter({hasText: (step.amountCents / 100).toFixed(2)}).waitFor();
        const state = await page.locator('.app-generation-action').evaluate(button => {
          const b = button.getBoundingClientRect(), frame = document.querySelector('.price-app-frame')!.getBoundingClientRect();
          const settings = document.querySelector('[data-settings-density] button')!.getBoundingClientRect();
          return { text: (button as HTMLElement).innerText, x:b.x, y:b.y, width:b.width, height:b.height,
            frameWidth:frame.width, sameBaseline:Math.abs((b.top+b.height/2) - (settings.top+settings.height/2)) < 1, fullWidth:b.width > frame.width-48,
            inside: b.left >= frame.left && b.right <= frame.right,
            overflow: document.documentElement.scrollWidth > innerWidth,
            sizingVisible: [...button.querySelectorAll('.app-generation-quote-size')].some(el => getComputedStyle(el).visibility !== 'hidden') };
        });
        evidence.push({ width, locale, step, state });
        assert.equal(state.sizingVisible, false, `Sizing labels must be invisible on marketing: ${JSON.stringify(state)}`);
        assert.doesNotMatch(state.text, /Calculating|unavailable|Calcul…|indisponible|Calculando|no disponible/);
        if (state.frameWidth >= 600) assert.equal(state.sameBaseline, true, `Generate and settings share a baseline: ${JSON.stringify(state)}`);
        else assert.equal(state.fullWidth, true, 'The narrow layout has a deliberate full-width action');
        assert.equal(state.inside, true); assert.equal(state.overflow, false);
        boxes.push([state.x, state.y, state.width, state.height]);
      }
      assert.deepEqual(boxes[1], boxes[0]); assert.deepEqual(boxes[2], boxes[0]);
      if (process.env.HOME_REVIEW_EVIDENCE_DIR) {
        await mkdir(process.env.HOME_REVIEW_EVIDENCE_DIR, { recursive:true });
        await page.screenshot({ path: join(process.env.HOME_REVIEW_EVIDENCE_DIR, `price-${locale}-${width}.png`) });
      }
      await page.close();
    }
  } finally {
    if (process.env.HOME_REVIEW_EVIDENCE_DIR) {
      await mkdir(process.env.HOME_REVIEW_EVIDENCE_DIR, { recursive:true });
      await writeFile(join(process.env.HOME_REVIEW_EVIDENCE_DIR, 'price-layout.json'), JSON.stringify(evidence,null,2));
    }
    await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
