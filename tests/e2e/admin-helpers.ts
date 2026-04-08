import { expect, type Page } from '@playwright/test';

export type ClientErrors = {
  consoleErrors: string[];
  pageErrors: string[];
};

export function trackClientErrors(page: Page): ClientErrors {
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

  return { consoleErrors, pageErrors };
}

export async function openAdminRoute(page: Page, path: string) {
  await page.goto(`/api/dev/admin-session?redirectTo=${encodeURIComponent(path)}`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(path)}(?:\\?.*)?$`));
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

export function assertNoClientErrors(errors: ClientErrors) {
  expect(errors.pageErrors, `Unexpected page errors:\n${errors.pageErrors.join('\n')}`).toEqual([]);
  expect(errors.consoleErrors, `Unexpected console errors:\n${errors.consoleErrors.join('\n')}`).toEqual([]);
}

export async function firstRowUserId(page: Page) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible();
  return ((await row.locator('td').nth(1).textContent()) ?? '').trim();
}

export async function firstRowJobId(page: Page) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible();
  return ((await row.locator('td').nth(1).locator('p.font-mono').first().textContent()) ?? '').trim();
}

export async function firstRowReceiptId(page: Page) {
  const row = page.locator('tbody tr').first();
  await expect(row).toBeVisible();
  const receipt = ((await row.locator('td').first().locator('p').first().textContent()) ?? '').trim();
  return receipt.replace(/^#/, '');
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
