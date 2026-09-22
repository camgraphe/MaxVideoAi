import { expect, test, type Page } from '@playwright/test';
import {
  assertNoClientErrors,
  firstRowJobId,
  firstRowReceiptId,
  firstRowUserId,
  openAdminRoute,
  trackClientErrors,
} from './admin-helpers';

test.describe('admin critical flows', () => {
  test.describe.configure({ mode: 'serial' });

  test('quick user handoff opens a filtered directory', async ({ page }) => {
    const errors = trackClientErrors(page);
    const lookupValue = 'member@example.com';

    await openAdminRoute(page, '/admin');
    await page.getByLabel('Quick search').fill(lookupValue);
    await page.getByRole('button', { name: 'Go' }).click();

    await expect(page).toHaveURL(/\/admin\/users\?search=/);
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(lookupValue);
    await expect(page.getByPlaceholder('Search by email or Supabase user ID')).toHaveValue(lookupValue);

    assertNoClientErrors(errors);
  });

  test('users search can drill down to member detail', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/users');
    const directoryState = await waitForUserDirectoryState(page);
    if (directoryState !== 'rows') {
      test.skip(true, 'requires Supabase service role data');
    }

    const userId = await firstRowUserId(page);
    expect(userId).not.toBe('');

    await page.getByPlaceholder('Search by email or Supabase user ID').fill(userId);
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(userId);

    const row = page.locator('tbody tr').filter({ hasText: userId }).first();
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/users/${userId}$`));
    await expect(page.locator('body')).toContainText('Account summary');

    assertNoClientErrors(errors);
  });

  test('jobs filters are shareable and reset cleanly', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/jobs');
    const jobId = await firstRowJobId(page);
    expect(jobId).not.toBe('');

    await page.getByLabel('Job ID').fill(jobId);
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect.poll(() => new URL(page.url()).searchParams.get('jobId')).toBe(jobId);
    await expect(page.locator('tbody tr').filter({ hasText: jobId }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Reset' }).click();
    await expect(page).toHaveURL(/\/admin\/jobs$/);
    await expect.poll(() => new URL(page.url()).searchParams.get('jobId')).toBe(null);

    assertNoClientErrors(errors);
  });

  test('transactions history search is shareable and resolves receipt links', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/transactions');
    const period = page.getByLabel('Transaction period');
    await expect(period).toHaveValue('all');
    const receiptId = await firstRowReceiptId(page);
    expect(receiptId).not.toBe('');

    await page.getByLabel('Search transaction history').fill(receiptId);
    await page.getByRole('button', {name:'Search',exact:true}).click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('q')).toBe(receiptId);
    await expect(page.locator('tbody tr').first()).toContainText(`#${receiptId}`);
    await page.goto(`/admin/transactions?receipt=${receiptId}`);
    await expect(page.getByRole('heading', { name: `Receipt #${receiptId}`, exact: true })).toBeVisible();

    assertNoClientErrors(errors);
  });

  test('retired pricing editor redirects without commercial API activity', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/pricing/')) requests.push(request.url());
    });
    await openAdminRoute(page, '/admin/settings');
    await page.goto('/admin/pricing');
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('site placements support drag order and cancel without publishing changes', async ({ page }) => {
    const mutations: string[] = [];
    // Supply browser-only media for the selected destination. This interaction
    // must run even when the database's first collection is empty, without writes.
    await page.route(/\/api\/admin\/playlists\/[^/]+$/, async (route) => {
      if (route.request().method() !== 'GET') {
        mutations.push(route.request().method());
        await route.abort();
        return;
      }
      const playlistId = new URL(route.request().url()).pathname.split('/').at(-1);
      await route.fulfill({
        json: {
          ok: true,
          items: ['First drag fixture', 'Second drag fixture'].map((prompt, orderIndex) => ({
            playlistId,
            videoId: `drag-fixture-${orderIndex}`,
            orderIndex,
            pinned: false,
            createdAt: '2026-09-22T00:00:00Z',
            engineLabel: 'Test media',
            prompt,
            visibility: 'public',
            indexable: true,
            isPublishedOnSite: true,
          })),
        },
      });
    });
    await page.route(/\/api\/admin\/playlists\/[^/]+\/items(?:\/.*)?$/, async (route) => {
      mutations.push(route.request().method());
      await route.abort();
    });
    await openAdminRoute(page, '/admin/playlists');
    await page.getByLabel('Site destinations', { exact: true }).getByRole('button').first().click();
    const rows = page.locator('article[draggable]');
    await expect(rows).toHaveCount(2);
    await expect(page.getByText('First drag fixture', { exact: false })).toBeVisible();
    const before = await rows.allTextContents();
    await rows.first().dragTo(rows.nth(1), {
      sourcePosition: { x: 8, y: 35 },
      targetPosition: { x: 150, y: 65 },
    });
    await expect(page.getByText('Unsaved order changes', { exact: true })).toBeVisible();
    expect(await rows.allTextContents()).not.toEqual(before);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(rows).toHaveText(before);
    expect(mutations).toEqual([]);
  });

  test('retired membership tiers remain readable without editing or applying changes', async ({ page }) => {
    const errors = trackClientErrors(page);
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/membership') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        mutations.push(request.method());
      }
    });

    await openAdminRoute(page, '/admin/membership');
    await expect(page.getByRole('heading', { level: 1, name: 'Membership history' })).toBeVisible();
    await expect(page.getByText('Membership discounts are retired.', { exact: false })).toBeVisible();
    const membershipState = await waitForMembershipState(page);
    expect(membershipState).not.toBe('timeout');
    const inventory = page.getByTestId('membership-tier-inventory');
    if (membershipState === 'rows') {
      await expect(inventory.locator('dl')).toHaveCount(3);
      await expect(inventory).toContainText('Historical discount:');
    }
    await expect(inventory.locator('input, select, textarea')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /preview all tier changes|confirm and apply|rollback/i })
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
    expect(mutations).toEqual([]);
    assertNoClientErrors(errors);
  });

  test('billing products filter, preview, and cancel without applying', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/billing-products');
    const productState = await waitForBillingProductState(page);
    if (productState === 'timeout') throw new Error('Timed out waiting for billing products to render.');
    if (productState === 'unavailable') test.skip(true, 'requires configured billing product database access');
    if (productState === 'empty') test.skip(true, 'requires live billing product rows');

    const inventoryTable = page.getByTestId('billing-products-inventory');
    const firstRow = inventoryTable.locator('tbody tr').first();
    await firstRow.click();
    const productKey = (await firstRow.locator('span.font-mono').textContent())?.trim() ?? '';
    if (productKey) {
      await page.getByLabel('Search billing products').fill(productKey);
      await expect(inventoryTable.locator('tbody tr').first()).toContainText(productKey);
      await page.getByLabel('Search billing products').fill('');
    }

    const priceInput = page.getByLabel('Billing product unit price (cents)');
    const currentPrice = Number(await priceInput.inputValue());
    await priceInput.fill(String(currentPrice + 1));
    await page.getByRole('button', { name: 'Preview billing product change' }).click();

    const dialog = page.getByRole('dialog', { name: /update/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Canonical server preview')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm and apply now' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    assertNoClientErrors(errors);
  });
});

async function waitForUserDirectoryState(page: Page) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (
      await page
        .getByText('Supabase service role key is missing.')
        .isVisible()
        .catch(() => false)
    ) {
      return 'warning' as const;
    }

    if (
      await page
        .getByText('No users found')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return 'empty' as const;
    }

    if ((await page.locator('tbody tr').count()) > 0) {
      return 'rows' as const;
    }

    await page.waitForTimeout(250);
  }

  return 'empty' as const;
}

async function waitForMembershipState(page: Page) {
  const deadline = Date.now() + 10_000;
  const inventory = page.getByTestId('membership-tier-inventory');

  while (Date.now() < deadline) {
    if (
      await page
        .getByText(/membership database is unavailable/i)
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return 'unavailable' as const;
    }
    if ((await inventory.locator('dl').count()) === 3) return 'rows' as const;
    if (
      await page
        .getByText('No membership inventory is available.')
        .isVisible()
        .catch(() => false)
    ) {
      return 'empty' as const;
    }
    await page.waitForTimeout(250);
  }

  return 'timeout' as const;
}

async function waitForBillingProductState(page: Page) {
  const deadline = Date.now() + 10_000;
  const inventoryTable = page.getByTestId('billing-products-inventory');
  while (Date.now() < deadline) {
    if (
      await page
        .getByText(/billing product database is unavailable/i)
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return 'unavailable' as const;
    }
    if ((await inventoryTable.locator('tbody tr').count()) > 0) return 'rows' as const;
    if (
      await page
        .getByText('No billing product inventory is available.')
        .isVisible()
        .catch(() => false)
    ) {
      return 'empty' as const;
    }
    await page.waitForTimeout(250);
  }
  return 'timeout' as const;
}
