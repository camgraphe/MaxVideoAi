import { expect, test } from '@playwright/test';
import { openMinimalEditorWorkspace } from './editor-helpers';

for (const viewport of [
  { width: 1440, height: 900 }, { width: 390, height: 844 },
  { width: 320, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 },
]) {
  test(`Canvas menu opens within viewport and returns keyboard focus ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMinimalEditorWorkspace(page);
    const trigger = page.locator('#canvas-navigator-popover-trigger');
    await trigger.click();
    const panel = page.locator('#canvas-navigator-popover');
    await expect(panel).toBeVisible();
    const assertContained = async () => {
      const geometry = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(geometry.height).toBeGreaterThan(100);
    };
    await page.screenshot({ path: testInfo.outputPath('canvas-menu-open.png') });
    await assertContained();
    // Reach both sections using real screen-sized controls, then prove the final
    // template action remains reachable through the panel's native scrolling.
    await panel.getByRole('group').getByRole('button').nth(1).click();
    const lastAction = panel.locator('[data-canvas-template-id]').last().getByRole('button').last();
    await lastAction.scrollIntoViewIfNeeded();
    await lastAction.click({ trial: true });
    await assertContained();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
