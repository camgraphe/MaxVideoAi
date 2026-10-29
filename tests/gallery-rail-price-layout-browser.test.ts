import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import tailwindConfig from '../frontend/tailwind.config';
import { buildGalleryRenderFixture } from './helpers/gallery-rail-render-fixture';

test('original-cost labels preserve the model name in narrow responsive rail cards', { timeout: 120_000 }, async () => {
  const frontend = join(process.cwd(), 'frontend');
  const requireFrontend = createRequire(join(frontend, 'package.json'));
  const script = await buildGalleryRenderFixture();
  const styles = await Promise.all(['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css', 'src/styles/app-experience.css']
    .map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: tailwindConfig.content.map(pattern => join(frontend, pattern)),
  })]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css.css + '</style></head><body class="app-experience"><div class="app-results-rail"><div id="root"></div></div></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  const evidenceDirectory = process.env.GALLERY_PRICE_LAYOUT_EVIDENCE_DIR;
  const measurements: unknown[] = [];
  if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
  try {
    for (const width of [320, 390, 768, 899, 900, 1088]) for (const locale of ['en', 'fr', 'es']) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto(`http://127.0.0.1:${address.port}`);
      await page.evaluate(() => {
        Object.assign(window, { IS_REACT_ACT_ENVIRONMENT: true, process: { env: {} },
          galleryProbe: { counts: { GalleryRail: 0, GalleryRailCards: 0, GroupedJobCard: 0, GroupedJobCardPreviewGrid: 0 }, cards: {}, actions: [], pageRequests: 0 } });
      });
      await page.addScriptTag({ content: script });
      await page.evaluate(locale => {
        const fixture = (window as unknown as { galleryFixture: { act: (fn: () => void) => void; reset: (count: number) => void;
          locale: (value: string) => void; job: (index: number, patch: Record<string, unknown>) => void } }).galleryFixture;
        fixture.act(() => { fixture.reset(1); fixture.locale(locale);
          fixture.job(0, { engineLabel: 'MiniMax H3 Max', finalPriceCents: 206, currency: 'USD' }); });
      }, locale);
      await page.locator('.app-rail-caption strong').waitFor();
      const geometry = await page.locator('.app-rail-caption').evaluate(caption => {
        const model = caption.querySelector('strong')!;
        const cost = caption.lastElementChild!;
        const bounds = caption.getBoundingClientRect(), modelBounds = model.getBoundingClientRect(), costBounds = cost.getBoundingClientRect();
        return { modelWidth: modelBounds.width, modelBottom: modelBounds.bottom, costTop: costBounds.top,
          costText: cost.textContent, overflow: caption.scrollWidth > caption.clientWidth + 1,
          costContained: costBounds.left >= bounds.left && costBounds.right <= bounds.right + 1 };
      });
      assert.ok(geometry.modelWidth >= 80, `${width}px/${locale}: model name squeezed to ${geometry.modelWidth}px`);
      assert.ok(geometry.costTop >= geometry.modelBottom, `${width}px/${locale}: cost must have a separate line`);
      assert.equal(geometry.overflow, false, `${width}px/${locale}: caption overflow`);
      assert.equal(geometry.costContained, true, `${width}px/${locale}: cost leaves the card`);
      assert.match(geometry.costText!, /\$2\.06/);
      measurements.push({ width, locale, ...geometry });
      if (evidenceDirectory && (width === 390 || width === 768)) {
        await page.screenshot({ path: join(evidenceDirectory, `rail-${width}-${locale}.png`) });
      }
      await page.close();
    }
    if (evidenceDirectory) await writeFile(join(evidenceDirectory, 'geometry.json'), JSON.stringify(measurements, null, 2) + '\n');
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
