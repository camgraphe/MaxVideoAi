import { expect, test } from '@playwright/test';
import { assertNoClientErrors, openAdminRoute, trackClientErrors } from './admin-helpers';

type SmokeRoute = {
  path: string;
  heading: string;
  section: string;
};

const smokeRoutes: SmokeRoute[] = [
  {
    path: '/admin',
    heading: 'Welcome back, Admin',
    section: 'Monthly stats',
  },
  {
    path: '/admin/insights',
    heading: 'Workspace insights',
    section: 'Trend Workspace',
  },
  {
    path: '/admin/jobs',
    heading: 'Jobs',
    section: 'Job Workspace',
  },
  {
    path: '/admin/transactions',
    heading: 'Transactions',
    section: 'Transaction Workspace',
  },
  {
    path: '/admin/video-seo',
    heading: 'Video SEO watch pages',
    section: 'Watch Page Inventory',
  },
];

test.describe('admin smoke', () => {
  test.describe.configure({ mode: 'serial' });

  for (const route of smokeRoutes) {
    test(`${route.path} renders without client errors`, async ({ page }) => {
      const errors = trackClientErrors(page);
      await openAdminRoute(page, route.path);

      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      await expect(page.locator('body')).toContainText(route.section);

      assertNoClientErrors(errors);
    });
  }

  test('video seo remains stable in dark theme', async ({ page }) => {
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin/video-seo');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await expect(page.getByRole('heading', { level: 1, name: 'Video SEO watch pages' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Watch Page Inventory');

    assertNoClientErrors(errors);
  });

  test('admin home remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin');

    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back, Admin' })).toBeVisible();
    await expect(page.locator('body')).toContainText('New users');
    await expect(page.locator('body')).toContainText('Active users');
    await expect(page.locator('body')).toContainText('Top ups');
    await expect(page.locator('body')).toContainText('Monthly stats');
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();

    assertNoClientErrors(errors);
  });

  test('admin hub supports 24h and 90d stat ranges', async ({ page }) => {
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin?range=90d');

    await expect(page.getByRole('link', { name: 'Last 90 days' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Last 24 hours' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Last 30 days' })).toBeVisible();
    await expect(page.locator('body')).toContainText('payments in 90d');

    await page.getByRole('link', { name: 'Last 24 hours' }).click();
    await expect(page).toHaveURL(/\/admin\?range=24h$/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('payments in 24h');

    assertNoClientErrors(errors);
  });

  test('admin hub can exclude admin metrics while preserving range', async ({ page }) => {
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin?range=90d');

    await expect(page.getByRole('link', { name: 'Admin excluded' })).toBeVisible();
    await page.getByRole('link', { name: 'Admin excluded' }).click();
    await expect(page).toHaveURL(/\/admin\?range=90d&excludeAdmin=0$/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Include admin' })).toBeVisible();

    await page.getByRole('link', { name: 'Last 24 hours' }).click();
    await expect(page).toHaveURL(/\/admin\?range=24h&excludeAdmin=0$/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('payments in 24h');

    assertNoClientErrors(errors);
  });
});
