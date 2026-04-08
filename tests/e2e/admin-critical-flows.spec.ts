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
