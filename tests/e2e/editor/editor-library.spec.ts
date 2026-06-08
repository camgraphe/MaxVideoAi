import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  clickCanvasNode,
  openFreshEditorWorkspace,
  switchEditorFocus,
  trackEditorClientErrors,
} from './editor-helpers';

const transparentPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function mockScrollableImageLibrary(page: Page): Promise<void> {
  const assets = Array.from({ length: 54 }, (_, index) => {
    const suffix = String(index).padStart(2, '0');
    return {
      id: `test-image-${suffix}`,
      url: `https://cdn.maxvideoai.test/library/asset-${suffix}.png`,
      thumbUrl: transparentPng,
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080,
      source: index % 2 === 0 ? 'generated' : 'upload',
    };
  });

  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, outputs: assets }),
    });
  });
}

test('asset library modal scrolls through a full app media library', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await mockScrollableImageLibrary(page);
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await clickCanvasNode(page, 'asset-product-image');
  await page.getByRole('button', { name: 'Replace media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select image' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('54 assets');
  const library = dialog.getByRole('region', { name: 'Library' });
  const firstAsset = dialog.getByRole('button', { name: 'Use asset-00.png' });
  const lastAsset = dialog.getByRole('button', { name: 'Use asset-53.png' });
  await expect(firstAsset).toBeVisible();

  const gridMetrics = await library.evaluate((element) => {
    const firstAssetButton = element.querySelector('button[aria-label^="Use "]');
    const grid = firstAssetButton?.parentElement as HTMLElement | null;
    if (!grid) return null;
    const styles = window.getComputedStyle(grid);
    const scrollTopBefore = grid.scrollTop;
    grid.scrollTop = grid.scrollHeight;
    return {
      clientHeight: grid.clientHeight,
      overflowY: styles.overflowY,
      scrollTopAfter: grid.scrollTop,
      scrollTopBefore,
      scrollHeight: grid.scrollHeight,
    };
  });
  expect(gridMetrics).not.toBeNull();
  expect(gridMetrics?.overflowY).toBe('auto');
  expect(gridMetrics?.scrollHeight ?? 0).toBeGreaterThan(gridMetrics?.clientHeight ?? 0);
  expect(gridMetrics?.scrollTopAfter ?? 0).toBeGreaterThan(gridMetrics?.scrollTopBefore ?? 0);

  await expect(lastAsset).toBeVisible();
  assertNoEditorClientErrors(errors);
});
