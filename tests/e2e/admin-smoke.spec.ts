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
    heading: 'Operations control',
    section: 'Signal Board',
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

    await expect(page.getByRole('heading', { level: 1, name: 'Operations control' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Signal Board');
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();

    assertNoClientErrors(errors);
  });
});
