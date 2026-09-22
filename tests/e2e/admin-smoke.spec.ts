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
    heading: 'Overview',
    section: 'Recent wallet activity',
  },
  {
    path: '/admin/insights',
    heading: 'Workspace insights',
    section: 'Trend Workspace',
  },
  {
    path: '/admin/jobs',
    heading: 'Generations',
    section: 'Review generation outcomes and resolve incidents.',
  },
  {
    path: '/admin/transactions',
    heading: 'Transactions',
    section: 'Wallet credits, generation charges and refunds.',
  },
  {
    path: '/admin/video-seo',
    heading: 'Video SEO watch pages',
    section: 'Indexed Watch Pages',
  },
  {
    path: '/admin/settings',
    heading: 'Settings',
    section: 'Existing database overrides remain active',
  },
  {
    path: '/admin/membership',
    heading: 'Membership history',
    section: 'Membership discounts are retired.',
  },
  {
    path: '/admin/billing-products',
    heading: 'Billing products',
    section: 'Live fixed-product inventory',
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
    await expect(page.locator('body')).toContainText('Indexed Watch Pages');

    assertNoClientErrors(errors);
  });

  test('admin home remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin');

    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    await expect(page.locator('body')).toContainText('New users');
    await expect(page.locator('body')).toContainText('Unresolved failures');
    await expect(page.locator('body')).toContainText('Wallet top-ups');
    await expect(page.locator('body')).toContainText('Recent wallet activity');
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();

    assertNoClientErrors(errors);
  });

  test('overview switches between Today and a rolling 24 hours', async ({ page }) => {
    const errors = trackClientErrors(page);
    await openAdminRoute(page, '/admin');
    await expect(page.getByLabel('Reporting period')).toHaveValue('today');
    await page.getByLabel('Reporting period').selectOption('24h');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?range=24h$/);
    await expect(page.getByLabel('Reporting period')).toHaveValue('24h');
    await expect(page.locator('body')).toContainText('Europe/Madrid');
    assertNoClientErrors(errors);
  });
});
