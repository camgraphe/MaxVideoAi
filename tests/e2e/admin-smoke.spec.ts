import { expect, test, type Page } from '@playwright/test';

type SmokeRoute = {
  path: string;
  heading: string;
  section: string;
};

type ClientErrors = {
  consoleErrors: string[];
  pageErrors: string[];
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
      const errors = await openAdminRoute(page, route.path);

      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      await expect(page.locator('body')).toContainText(route.section);

      assertNoClientErrors(errors);
    });
  }

  test('video seo remains stable in dark theme', async ({ page }) => {
    const errors = await openAdminRoute(page, '/admin/video-seo');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await expect(page.getByRole('heading', { level: 1, name: 'Video SEO watch pages' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Watch Page Inventory');

    assertNoClientErrors(errors);
  });

  test('admin home remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await openAdminRoute(page, '/admin');

    await expect(page.getByRole('heading', { level: 1, name: 'Operations control' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Signal Board');
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();

    assertNoClientErrors(errors);
  });
});

async function openAdminRoute(page: Page, path: string): Promise<ClientErrors> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(`/api/dev/admin-session?redirectTo=${encodeURIComponent(path)}`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(path)}$`));
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

  return { consoleErrors, pageErrors };
}

function assertNoClientErrors(errors: ClientErrors) {
  expect(errors.pageErrors, `Unexpected page errors:\n${errors.pageErrors.join('\n')}`).toEqual([]);
  expect(errors.consoleErrors, `Unexpected console errors:\n${errors.consoleErrors.join('\n')}`).toEqual([]);
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
