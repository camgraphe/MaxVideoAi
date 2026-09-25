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
    heading: 'Insights',
    section: 'Activity over time',
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
    path: '/admin/seo',
    heading: 'Search performance',
    section: 'Google Search Console',
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

  test('old SEO and theme bookmarks reach their replacement pages', async ({ page }) => {
    await openAdminRoute(page, '/admin/settings');
    await page.goto('/admin/seo/gsc?range=28d');
    await expect(page).toHaveURL(/\/admin\/seo$/);
    await expect(page.getByRole('link', { name: /Google Search Console/ })).toHaveAttribute(
      'href',
      'https://search.google.com/search-console'
    );

    await page.goto('/admin/theme');
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.locator('body')).toContainText('Existing database overrides remain active');

    for (const path of [
      '/api/admin/seo/gsc/refresh',
      '/api/admin/seo/url-inspection/inspect',
      '/api/admin/seo/actions/export',
    ]) {
      const response = await page.context().request.post(path, { data: {} });
      expect(response.status()).toBe(410);
    }
    const themeResponse = await page.context().request.put('/api/admin/theme-tokens', { data: {} });
    expect(themeResponse.status()).toBe(410);
  });

  test('failed service notice disable keeps the edited notice visible', async ({ page }) => {
    test.skip(!process.env.DATABASE_URL, 'Service notice editing requires the database fixture');
    await openAdminRoute(page, '/admin/system');
    const enabled = page.getByRole('checkbox', { name: 'Show the notice in the workspace' });
    await enabled.check();
    await page.route('**/api/admin/service-notice', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Save failed' }) });
    });
    await page.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(enabled).toBeChecked();
    await expect(page.getByText('Save failed')).toBeVisible();
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

  test('settings stays navigable at 200 percent zoom', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await openAdminRoute(page, '/admin/settings');
    await page.evaluate(() => {
      document.documentElement.style.zoom = '200%';
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const width = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.viewport);
    await page.getByRole('main').getByRole('link', { name: /Service notice/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Service notice' })).toBeVisible();
  });

  test('overview keeps the internal activity filter across periods and Insights', async ({ page }) => {
    await openAdminRoute(page, '/admin?range=24h');
    await expect(page.getByRole('link', { name: 'Internal activity excluded' })).toBeVisible();

    await page.getByRole('link', { name: 'Internal activity excluded' }).click();
    await expect(page).toHaveURL(/\/admin\?range=24h&excludeAdmin=0$/);
    await page.getByLabel('Reporting period').selectOption('today');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?range=today&excludeAdmin=0$/);

    await page.getByLabel('Overview views').getByRole('link', { name: 'Insights' }).click();
    await expect(page).toHaveURL(/\/admin\/insights\?excludeAdmin=0$/);
    await expect(page.getByRole('link', { name: 'Include internal activity' })).toBeVisible();
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
