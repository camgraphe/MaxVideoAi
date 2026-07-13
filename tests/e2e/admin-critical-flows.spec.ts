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
    await page.getByLabel('Find user').fill(lookupValue);
    await page.getByRole('button', { name: 'Open user' }).click();

    await expect(page).toHaveURL(/\/admin\/users\?search=/);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('search'))
      .toBe(lookupValue);
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
    await expect
      .poll(() => new URL(page.url()).searchParams.get('search'))
      .toBe(userId);

    const row = page.locator('tbody tr').filter({ hasText: userId }).first();
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'View' }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/users/${userId}$`));
    await expect(page.locator('body')).toContainText('Member Pulse');

    assertNoClientErrors(errors);
  });

  test('jobs filters are shareable and reset cleanly', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/jobs');
    const jobId = await firstRowJobId(page);
    expect(jobId).not.toBe('');

    await page.getByLabel('Job ID').fill(jobId);
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('jobId'))
      .toBe(jobId);
    await expect(page.locator('tbody tr').filter({ hasText: jobId }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Reset' }).click();
    await expect(page).toHaveURL(/\/admin\/jobs$/);
    await expect.poll(() => new URL(page.url()).searchParams.get('jobId')).toBe(null);

    assertNoClientErrors(errors);
  });

  test('transactions ledger search narrows the current slice', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/transactions');
    const receiptId = await firstRowReceiptId(page);
    expect(receiptId).not.toBe('');

    await page.getByLabel('Search loaded rows').fill(receiptId);
    await expect(page.locator('body')).toContainText(new RegExp(`Currently showing \\d+ of \\d+ loaded transactions\\.`));
    await expect(page.locator('tbody tr').first()).toContainText(`#${receiptId}`);

    assertNoClientErrors(errors);
  });

  test('pricing policy filters, selects, previews, and cancels without applying', async ({ page }) => {
    const errors = trackClientErrors(page);

    await openAdminRoute(page, '/admin/pricing');
    const pricingState = await waitForPricingPolicyState(page);
    if (pricingState === 'timeout') {
      throw new Error('Timed out waiting for the pricing policy inventory to render.');
    }
    if (pricingState === 'unavailable') {
      test.skip(true, 'requires configured pricing policy database access');
    }
    if (pricingState === 'empty') {
      test.skip(true, 'requires canonical pricing inventory data');
    }
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    const engineInput = page.getByLabel('Engine');
    const engine = await engineInput.inputValue();
    if (engine) {
      await page.getByLabel('Search policy selectors').fill(engine);
      await expect(page.locator('tbody tr').first()).toContainText(engine);
      await page.getByLabel('Search policy selectors').fill('');
    }

    const flatMarginInput = page.getByLabel('Flat margin (cents)');
    const currentFlatMargin = Number(await flatMarginInput.inputValue());
    await flatMarginInput.fill(String(currentFlatMargin + 1));
    let releasePreview!: () => void;
    const previewGate = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await page.route('**/api/admin/pricing/preview', async (route) => {
      await previewGate;
      await route.continue();
    });
    await page.getByRole('button', { name: 'Preview policy change' }).click();
    try {
      await expect(flatMarginInput).toBeDisabled();
      await expect(page.getByLabel('Search policy selectors')).toBeDisabled();
      await expect(page.getByLabel('Policy source')).toBeDisabled();
      await expect(firstRow.getByRole('button')).toBeDisabled();
    } finally {
      releasePreview();
    }

    const dialog = page.getByRole('dialog', { name: /update|create/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Canonical server preview')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm and apply now' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

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
    if (await page.getByText('Supabase service role key is missing.').isVisible().catch(() => false)) {
      return 'warning' as const;
    }

    if (await page.getByText('No users found').first().isVisible().catch(() => false)) {
      return 'empty' as const;
    }

    if ((await page.locator('tbody tr').count()) > 0) {
      return 'rows' as const;
    }

    await page.waitForTimeout(250);
  }

  return 'empty' as const;
}

async function waitForPricingPolicyState(page: Page) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (await page.getByText(/Unable to load pricing policy|database is unavailable/i).first().isVisible().catch(() => false)) {
      return 'unavailable' as const;
    }
    if ((await page.locator('tbody tr').count()) > 0) {
      return 'rows' as const;
    }
    if (await page.getByText('No canonical pricing policy rows are available.').isVisible().catch(() => false)) {
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
    if (await page.getByText(/billing product database is unavailable/i).first().isVisible().catch(() => false)) {
      return 'unavailable' as const;
    }
    if ((await inventoryTable.locator('tbody tr').count()) > 0) return 'rows' as const;
    if (await page.getByText('No billing product inventory is available.').isVisible().catch(() => false)) {
      return 'empty' as const;
    }
    await page.waitForTimeout(250);
  }
  return 'timeout' as const;
}
