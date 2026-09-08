import { expect, test, type Locator, type Page } from '@playwright/test';
import { openMinimalEditorWorkspace } from './editor-helpers';

const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
  { width: 844, height: 390 },
];

async function expectActionInViewport(page: Page, action: Locator) {
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box!.width).toBeGreaterThanOrEqual(43);
  expect(box!.height).toBeGreaterThanOrEqual(43);
}

for (const viewport of viewports) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Studio actions fit ${viewport.width}x${viewport.height} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openMinimalEditorWorkspace(page);
      const themeSwitch = page.getByRole('button', { name: `Switch Studio to ${theme} mode` });
      if (await themeSwitch.isVisible()) await themeSwitch.click();

      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const settings = page.locator('[data-canvas-selection-settings]');
      await expectActionInViewport(page, settings);
      await settings.click();
      const close = page.locator('[data-canvas-inspector-close]');
      await expectActionInViewport(page, close);
      await close.click();
      await expect(settings).toBeFocused();

      const video = page.locator('[data-canvas-toolbar-menu-id="video"]');
      await expectActionInViewport(page, video);
      await video.click();
      const create = page.locator('[data-canvas-toolbar-preset-id="generate-video"]');
      await expectActionInViewport(page, create);
      await testInfo.attach(`studio-${viewport.width}-${viewport.height}-${theme}`, {
        body: await page.screenshot(), contentType: 'image/png',
      });
      await page.keyboard.press('Escape');
      await expect(video).toBeFocused();
    });
  }
}
