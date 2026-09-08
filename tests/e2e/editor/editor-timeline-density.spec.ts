import { expect, test } from '@playwright/test';
import { openMinimalEditorWorkspace } from './editor-helpers';

for (const viewport of [{ width: 1166, height: 1003 }, { width: 390, height: 844 }]) {
  test(`timeline tracks stay compact at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMinimalEditorWorkspace(page);

    const tracks = page.locator('[data-timeline-track-label]');
    await expect(tracks).toHaveCount(3);
    for (const track of await tracks.all()) {
      expect((await track.boundingBox())!.height).toBeLessThanOrEqual(64);
    }
  });
}

test('the expanded track menu stays fully reachable in short landscape view', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openMinimalEditorWorkspace(page);

  const actions = page.locator('[data-timeline-track-actions="audio-2"]');
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeVisible();
  await actions.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu').filter({ has: page.locator('[data-timeline-menu-toggle-lock="audio-2"]') });
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  await expect(menu.getByRole('menuitem', { name: /Delete/i })).toBeVisible();
});
