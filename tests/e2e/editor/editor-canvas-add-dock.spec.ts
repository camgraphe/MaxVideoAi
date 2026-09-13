import { expect, test } from '@playwright/test';
import { openMinimalEditorWorkspace } from './editor-helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 844 }, { width: 844, height: 390 }]) {
  test(`Canvas creation dock keeps five 44px commands and working grouped actions at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMinimalEditorWorkspace(page);
    const dock = page.locator('[data-canvas-floating-toolbar]');
    await expect(dock.getByRole('button')).toHaveCount(5);
    const dockBox = (await dock.boundingBox())!;
    expect(dockBox.height).toBe(44);
    expect(dockBox.x).toBeGreaterThanOrEqual(0);
    expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(viewport.width);
    for (const button of await dock.getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await dock.getByRole('button', { name: 'Selection', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Marquee select canvas nodes', exact: true }).click();
    await dock.getByRole('button', { name: 'Selection', exact: true }).click();
    await expect(page.getByRole('menuitemradio', { name: 'Marquee select canvas nodes', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    const add = dock.getByRole('button', { name: 'Add', exact: true });
    await add.focus();
    await page.keyboard.press('Enter');
    const palette = page.getByRole('menu', { name: 'Add', exact: true });
    const paletteBox = (await palette.boundingBox())!;
    const canvasBox = (await page.locator('[data-studio-canvas-shell]').boundingBox())!;
    expect(paletteBox.x).toBeGreaterThanOrEqual(0);
    expect(paletteBox.y).toBeGreaterThanOrEqual(0);
    expect(paletteBox.y).toBeGreaterThanOrEqual(canvasBox.y);
    expect(paletteBox.x + paletteBox.width).toBeLessThanOrEqual(viewport.width);
    const before = await page.locator('.react-flow__node').count();
    await page.locator('[data-canvas-toolbar-preset-id="generate-video"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
    await expect(add).toBeFocused();
    await dock.getByRole('button', { name: 'Undo canvas edit', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(before);
    await dock.getByRole('button', { name: 'Redo canvas edit', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
    await add.click();
    const validation = palette.getByRole('menuitem', { name: /Denoise.*Validation/ });
    await validation.scrollIntoViewIfNeeded();
    await expect(validation).toHaveAttribute('href', '/app/tools/denoise');
    await expect(validation).toHaveAttribute('target', '_blank');
    await expect(palette.getByRole('menuitem', { name: /Storyboard/ })).toHaveAttribute('href', '/app/tools/storyboard');
    await page.keyboard.press('Escape');
    await expect(add).toBeFocused();
  });
}

test.describe('touch canvas creation', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('a tap adds exactly one source without requiring a second canvas tap', async ({ page }) => {
    await openMinimalEditorWorkspace(page);
    const before = await page.locator('.react-flow__node').count();
    await page.locator('[data-canvas-toolbar-menu-id="add"]').tap();
    await page.locator('[data-canvas-toolbar-block-id="image"]').tap();
    await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
    await expect(page.locator('#canvas-toolbar-add-menu')).toBeHidden();
  });
});
