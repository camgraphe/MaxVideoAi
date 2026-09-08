import { expect, test } from '@playwright/test';
import { openFreshEditorWorkspace } from './editor-helpers';

test('Studio exposes the app menu and a persistent saved exit without a Mock control', async ({ page }) => {
  await openFreshEditorWorkspace(page, { testSimulation: false });

  const header = page.locator('header').first();
  await expect(header.getByRole('button', { name: 'Toggle mock generation' })).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Exit to projects' })).toBeVisible();

  const menuButton = header.getByRole('button', { name: 'Open MaxVideoAI menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const menu = page.getByRole('dialog', { name: 'MaxVideoAI' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Studio' })).toHaveAttribute('href', '/app/studio/projects');
  await expect(menu.getByRole('link', { name: 'Video' })).toHaveAttribute('href', '/app');
  await expect(menu.getByText('Preferences', { exact: true })).toBeVisible();
  await expect(menu.getByText('Language', { exact: true })).toBeVisible();
  await expect(menu.getByText('Appearance', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test('Studio app-menu navigation uses the saved workspace exit boundary', async ({ page }) => {
  await openFreshEditorWorkspace(page, { testSimulation: false });

  await page.getByRole('button', { name: 'Open MaxVideoAI menu' }).click();
  await page.getByRole('dialog', { name: 'MaxVideoAI' }).getByRole('link', { name: 'Studio' }).click();

  await expect(page).toHaveURL(/\/app\/studio\/projects(?:\?|$)/);
});
