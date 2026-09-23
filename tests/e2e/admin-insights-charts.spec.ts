import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { assertNoClientErrors, openAdminRoute, trackClientErrors } from './admin-helpers';

const evidenceDir = 'docs/redesign/qa';

test('insights charts keep period, granularity and display choices usable', async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, 'Insights browser review requires an isolated database branch');
  test.setTimeout(120_000);
  const errors = trackClientErrors(page);
  await page.setViewportSize({ width: 1486, height: 1059 });
  await openAdminRoute(page, '/admin/insights');
  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Signups per day/ })).toBeVisible();

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/admin-insights-desktop.png` });

  await page.getByRole('button', { name: 'Custom days' }).click();
  await page.getByLabel('Last number of days').fill('45');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/range=custom.*days=45/);
  await expect(page.getByText('Across 45 days', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await expect(page.getByRole('link', { name: '7-day totals' })).toBeVisible();
  await page.getByRole('link', { name: '7-day totals' }).click();
  await expect(page).toHaveURL(/grain=weekly/);
  await expect(page.getByText('The first bucket covers 3 days.', { exact: false })).toBeVisible();

  await page.getByRole('switch', { name: 'Compare previous period on chart' }).click();
  await expect(page.getByRole('switch', { name: 'Compare previous period on chart' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('navigation', { name: 'Chart metric' }).getByRole('link', { name: 'Top-ups' }).click();
  await expect(page.getByRole('img', { name: /Wallet top-ups/ })).toBeVisible();

  await page.getByRole('button', { name: 'Customize' }).click();
  await page.getByRole('checkbox', { name: 'Show data table' }).check();
  await expect(page.getByRole('table', { name: /Wallet top-ups.*data/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Show data table' }).uncheck();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Customize' }).click();
  await page.screenshot({ path: `${evidenceDir}/admin-insights-mobile.png`, fullPage: true });
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  assertNoClientErrors(errors);
});
