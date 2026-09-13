import { expect, test } from '@playwright/test';
import { openFreshEditorWorkspace, switchEditorFocus } from './editor-helpers';

test('mobile Project media import owns the top layer and a complete keyboard focus cycle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/media-library/assets?**', (route) => route.fulfill({
    json: { ok: true, assets: [], nextCursor: null, hasMore: false },
  }));
  await page.route('**/api/media-library/recent-outputs?**', (route) => route.fulfill({
    json: { ok: true, outputs: [], nextCursor: null, hasMore: false },
  }));

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Project media', exact: true }).click();

  const opener = page.getByRole('button', { name: 'Import media', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  const close = dialog.getByRole('button', { name: 'Close project media library' });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();

  const closeOwnsPointer = await close.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return hit === button || button.contains(hit);
  });
  expect(closeOwnsPointer).toBe(true);

  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
