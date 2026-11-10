import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture, referencePickerAuthModules } from './helpers/workspace-reference-browser-fixture';

test('portrait and landscape placeholders keep the final reader framing while the original loads', { timeout: 90000 }, async () => {
  // The standalone fixture strips CSS @imports; include the same lightbox styles
  // that the real application loads from globals.css.
  const source = `import 'yet-another-react-lightbox/styles.css';import{createRoot}from'react-dom/client';import{ProgressiveMediaReader}from'./components/library/ProgressiveMediaReader.client';createRoot(document.getElementById('root')).render(<main style={{width:'min(778px,100%)'}}><ProgressiveMediaReader asset={globalThis.fixtureConfig.asset} locale="en" label="Fixture image"/></main>);`;
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1024, 1536], [1536, 1024]]) {
      const fixture = await startWorkspaceReferenceFixture({ source, config: { asset: { id: 'photo', kind: 'image', width, height, url: 'https://media.fixture.test/full.svg', thumbUrl: 'https://media.fixture.test/small.svg' } }, hostModules: referencePickerAuthModules('gallery-owner', 'fixture-only') });
      const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      const svg = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#849aaa"/></svg>`;
      await page.route('**/small.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: svg(width / 2, height / 2) }));
      await page.route('**/full.svg', async route => { await pending; await route.fulfill({ contentType: 'image/svg+xml', body: svg(width, height) }); });
      try {
        await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
        const poster = page.locator('.app-library-reader-placeholder img');
        await expect(poster).toBeVisible();
        await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        const painted = await poster.evaluate((img: HTMLImageElement) => {
          const box = img.getBoundingClientRect(), ratio = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
          const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
          return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h, elementHeight: box.height };
        });
        const viewport = await page.locator('.app-library-reader').boundingBox();
        assert.ok(viewport && painted.elementHeight <= viewport.height, 'the portrait placeholder must not overflow the reader');
        release();
        await expect(page.locator('.app-library-reader-placeholder')).toHaveCount(0);
        const final = await page.locator('.yarl__slide_image').boundingBox();
        assert.ok(final);
        for (const dimension of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(final[dimension] - painted[dimension]) <= 2, `${dimension}: no thumbnail-to-image jump (${JSON.stringify({ painted, final })})`);
      } finally { release(); await page.close(); await fixture.close(); }
    }
  } finally { await browser.close(); }
});
