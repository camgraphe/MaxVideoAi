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

  test('pricing cockpit compares costs and previews a policy change', async ({ page }) => {
    const confirmRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/admin/pricing/confirm')) confirmRequests.push(request.url());
    });
    await openAdminRoute(page, '/admin/pricing');
    await expect(page.getByRole('heading', { level: 1, name: 'Model pricing' })).toBeVisible();
    await expect(page.getByText('Supplier cost and customer price', { exact: true })).toBeVisible();
    const inventory = page.getByTestId('pricing-policy-inventory');
    await expect(inventory.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await expect(inventory.locator('tbody tr').first().locator('td').last()).toContainText(/\$\d+\.\d{2}/);
    await expect(inventory).not.toContainText('$NaN');
    await page.getByLabel('Search policy selectors').fill('seedance-2-5');
    await inventory.locator('tbody tr').first().getByRole('button').click();
    await expect(page.getByText('Policy inspector', { exact: true })).toBeVisible();
    const margin = page.getByLabel('Margin (%)');
    await margin.fill(String(Number(await margin.inputValue()) + 5));
    await page.getByRole('button', { name: 'Preview policy change' }).click();
    const preview = page.getByRole('dialog');
    await expect(preview.getByText('Canonical server preview')).toBeVisible();
    await preview.getByRole('button', { name: 'Cancel' }).click();
    expect(confirmRequests).toEqual([]);
  });

  test('site placements support drag order and cancel without publishing changes', async ({ page }) => {
    const mutations: string[] = [];
    // Keep the opening separate from the two reorderable cards, and intercept
    // every playlist mutation so this interaction cannot publish any change.
    const items = ['Opening lead', 'Opening portrait', 'Opening side A', 'Opening side B',
      'First drag fixture', 'Second drag fixture'].map((prompt, index) => ({
      id: `drag-fixture-${index}`, engineId: 'wan-3', engineLabel: 'Wan 3', prompt,
      videoUrl: '/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4', createdAt: '2026-09-29T00:00:00Z',
      outputWidth: index === 1 ? 720 : 1280, outputHeight: index === 1 ? 1280 : 720,
    }));
    const ids = items.map(item => item.id);
    const snapshot = { available: true, supported: true, openingAvailable: true, slug: 'family-fixture',
      isPublic: true, revision: 'r1', config: { mode: 'manual', openingIds: ids.slice(0, 4),
        orderedIds: ids, excludedIds: [] } };
    await page.route(/\/api\/admin\/playlists(?:\/[^?#]*)?(?:\?[^#]*)?$/, async (route) => {
      if (route.request().method() !== 'GET') {
        mutations.push(route.request().method());
        await route.abort();
        return;
      }
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/curation')) {
        await route.fulfill({ json: { ok: true, snapshot, initialIds: ids, selectedItems: items, selectedTotal: ids.length } });
      } else if (path.endsWith('/curation/candidates')) {
        await route.fulfill({ json: { ok: true, items, total: items.length, nextCursor: null } });
      } else {
        await route.continue();
      }
    });
    await openAdminRoute(page, '/admin/playlists');
    await expect(page.locator('[data-destination-picker]')).toBeVisible();
    const opening = page.locator('[data-opening-board] [data-opening-slot]');
    await expect(opening).toHaveCount(4);
    const openingBefore = await opening.allTextContents();
    const rows = page.locator('[data-selected-grid] [data-curation-item]');
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText('First drag fixture', { exact: true })).toBeVisible();
    const order = () => rows.evaluateAll(cards => cards.map(card => card.getAttribute('data-curation-item')));
    const before = await order();
    await rows.first().dragTo(rows.nth(1), {
      sourcePosition: { x: 8, y: 35 },
      targetPosition: { x: 150, y: 65 },
    });
    await expect(page.locator('[data-draft-status]')).toHaveText('Unsaved changes');
    await expect.poll(order).toEqual([...before].reverse());
    await expect(opening).toHaveText(openingBefore);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(order).toEqual(before);
    await expect(page.locator('[data-draft-status]')).toHaveText('Saved');
    await expect(opening).toHaveText(openingBefore);
    expect(mutations).toEqual([]);
  });

  test('gallery workbench keeps media visible, navigable and safe across widths', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const mutations: string[] = [];
    const mediaRequests: string[] = [];
    const candidateRequests: string[] = [];
    page.on('request', request => {
      if (request.url().endsWith('.mp4')) mediaRequests.push(request.url());
      if (request.url().includes('/curation/candidates')) candidateRequests.push(request.url());
    });
    const poster = (label: string, color: string) => `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="52%" text-anchor="middle" fill="white" font-size="80">${label}</text></svg>`
    )}`;
    const items = ['Lead', 'Portrait', 'Side A', 'Side B', 'Tail one', 'Tail two', 'Tail three', 'Tail four', 'Tail five', 'Tail six'].map((label, index) => ({
      id: ['lead', 'portrait', 'side-a', 'side-b', 'tail-1', 'tail-2', 'tail-3', 'tail-4', 'tail-5', 'tail-6'][index],
      engineId: 'wan-3', engineLabel: 'Wan 3', prompt: label,
      videoUrl: '/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4',
      thumbUrl: poster(label, index === 1 ? '#7356b8' : '#3157a7'), createdAt: '2026-09-29T00:00:00Z',
      outputWidth: index === 1 ? 720 : 1280, outputHeight: index === 1 ? 1280 : 720,
    }));
    const ids = items.map(item => item.id);
    const snapshot = { available: true, supported: true, openingAvailable: true, slug: 'family-fixture',
      isPublic: true, revision: 'r1', config: { mode: 'manual', openingIds: ids.slice(0, 4), orderedIds: ids,
        excludedIds: [] } };
    await page.route(/\/api\/admin\/playlists\/[^/]+\/curation\/candidates/, async route => {
      const query = new URL(route.request().url()).searchParams;
      const exact = query.getAll('ids');
      const filtered = exact.length ? items.filter(item => exact.includes(item.id)) :
        query.get('format') === '9:16' ? items.filter(item => item.id === 'portrait') : items;
      await route.fulfill({ json: { ok: true, items: filtered, total: filtered.length, nextCursor: null } });
    });
    await page.route(/\/api\/admin\/playlists\/[^/]+\/curation$/, async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ json: { ok: true, snapshot, initialIds: ids, selectedItems: items, selectedTotal: 10 } });
      } else if (method === 'POST') {
        mutations.push(method);
        await route.fulfill({ json: { ok: true, preview: { items, token: 'preview-fixture', revision: 'r1', effective: {
          total: 10, currentTotal: 10, firstPageIds: ids, addedCount: 0, removedCount: 0,
          suppressedSourceSlugs: [], openingFormats: ['16:9', '9:16', '16:9', '16:9'], warnings: [],
        } } } });
      } else {
        mutations.push(method);
        expect(JSON.parse(route.request().postData() ?? '{}').token).toBe('preview-fixture');
        await route.fulfill({ json: { ok: true, snapshot: { ...snapshot, revision: 'r2' } } });
      }
    });
    await page.route(/\/api\/admin\/video-seo\/[^/]+\/status$/, async route => {
      await route.fulfill({ json: { ok: true, status: 'not_selected', inVideoSitemap: false } });
    });
    await openAdminRoute(page, '/admin/playlists');
    const picker = page.locator('[data-destination-picker]');
    if (!(await picker.count())) test.skip(true, 'requires at least one connected destination');
    const board = page.locator('[data-opening-board]');
    await expect(board.locator('[data-opening-slot]')).toHaveCount(4);
    await expect(page.locator('[data-selected-grid] [data-curation-item]')).toHaveCount(6);
    await expect(page.locator('[data-explorer-overlay]')).toHaveCount(0);
    await page.setViewportSize({ width: 1152, height: 950 });
    await picker.locator('button[aria-haspopup]').click();
    const destinationMenu = page.getByRole('dialog', { name: 'Site destinations' });
    await expect(destinationMenu).toBeVisible();
    const firstDestinationHit = await destinationMenu.locator('button[data-destination-id]').first().evaluate(button => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    });
    expect(firstDestinationHit, 'destination choices are not covered by save controls').toBe(true);
    const firstFamily = destinationMenu.locator('[data-destination-group="families"] button[data-destination-id]').first();
    const familyLabel = await firstFamily.locator('span').nth(1).innerText();
    await firstFamily.click();
    await expect(destinationMenu).toHaveCount(0);
    await expect(picker.locator('button[aria-haspopup]')).toContainText(familyLabel);
    expect(mediaRequests).toHaveLength(0);
    expect(candidateRequests).toHaveLength(0);
    for (const width of [688, 960, 1440, 375]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
      const geometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        pickerTop: document.querySelector('[data-destination-picker]')!.getBoundingClientRect().top,
        boardTop: document.querySelector('[data-opening-board]')!.getBoundingClientRect().top,
        boardBottom: document.querySelector('[data-opening-board]')!.getBoundingClientRect().bottom,
      }));
      expect(geometry.overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      expect(geometry.pickerTop).toBeLessThan(geometry.boardTop);
      if (width === 688 || width === 960) expect(geometry.boardTop).toBeLessThan(400);
      if (width >= 960) expect(geometry.boardBottom - geometry.boardTop, `compact opening at ${width}px`).toBeLessThanOrEqual(width >= 1280 ? 460 : 310);
      const selectedColumns = await page.locator('[data-selected-grid] [data-curation-item]').evaluateAll(cards =>
        new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size);
      expect(selectedColumns, `selected card columns at ${width}px`).toBe(width >= 1280 ? 4 : width >= 900 ? 3 : width >= 640 ? 2 : 1);
      if (width === 375) {
        const pickerWidths = await picker.evaluate(element => ({
          card: element.getBoundingClientRect().width,
          trigger: element.querySelector('button[aria-haspopup]')!.getBoundingClientRect().width,
        }));
        expect(pickerWidths.trigger / pickerWidths.card, 'mobile destination stays readable').toBeGreaterThan(0.85);
      }
      const slotsHaveVisibleControls = await board.locator('[data-opening-slot]').evaluateAll(cards => cards.every(card => {
        const cardBox = card.getBoundingClientRect();
        const footerBox = card.lastElementChild!.getBoundingClientRect();
        return footerBox.top < cardBox.bottom - 1 && footerBox.bottom <= cardBox.bottom + 1;
      }));
      expect(slotsHaveVisibleControls, `opening controls remain visible at ${width}px`).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const desktopCapture = testInfo.outputPath('gallery-workbench-desktop.png');
    await page.screenshot({ path: desktopCapture });
    await testInfo.attach('Desktop gallery workbench', { path: desktopCapture, contentType: 'image/png' });
    await board.getByRole('button', { name: 'Mobile preview' }).click();
    const previewColumnCount = await board.locator('[data-opening-slot]').evaluateAll(cards =>
      new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size);
    expect(previewColumnCount, 'mobile preview uses two columns even in a wide browser').toBe(2);
    await board.getByRole('button', { name: 'Desktop preview' }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileCapture = testInfo.outputPath('gallery-workbench-mobile.png');
    await page.screenshot({ path: mobileCapture });
    await testInfo.attach('Mobile gallery workbench', { path: mobileCapture, contentType: 'image/png' });
    const add = page.getByRole('button', { name: 'Add videos', exact: true });
    await add.click();
    const explorer = page.getByRole('dialog', { name: 'Add videos' });
    await expect(explorer).toBeVisible();
    await expect.poll(() => candidateRequests.length).toBeGreaterThan(0);
    expect(Math.round((await explorer.boundingBox())!.width)).toBeGreaterThanOrEqual(374);
    await page.keyboard.press('Escape');
    await expect(explorer).toHaveCount(0);
    await expect(add).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await add.click();
    await expect(explorer).toBeVisible();
    const candidateColumns = await explorer.locator('[data-media-id]').evaluateAll(cards =>
      new Set(cards.map(card => Math.round(card.getBoundingClientRect().left))).size);
    expect(candidateColumns, 'search results retain readable two-column cards').toBe(2);
    await page.keyboard.press('Escape');
    await expect(explorer).toHaveCount(0);
    const inspect = page.getByRole('button', { name: 'Inspect video' }).first();
    await inspect.click();
    const inspector = page.getByRole('dialog', { name: 'Video details' });
    await expect(inspector).toBeVisible();
    await expect(inspector.locator('video')).toHaveCount(0);
    await expect(inspector).toContainText('Not selected for Video SEO');
    await inspector.getByRole('button', { name: 'Play video' }).click();
    await expect(inspector.locator('video[preload="none"]')).toBeVisible();
    await expect(inspector.locator('video')).toBeFocused();
    await expect.poll(() => mediaRequests.length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(inspector).toHaveCount(0);
    await expect(inspect).toBeFocused();
    const selected = page.locator('[data-curation-item="tail-1"]');
    await selected.locator('summary').click();
    await selected.getByRole('button', { name: 'Move item 1 down' }).click();
    await page.getByRole('button', { name: 'Preview changes' }).click();
    const preview = page.getByRole('dialog', { name: 'Page preview' });
    await expect(preview).toContainText('First page · up to 24 videos');
    await preview.getByRole('button', { name: 'Save this selection' }).click();
    await expect(page.locator('[data-draft-status]')).toHaveText('Saved');
    expect(mutations).toEqual(['POST', 'PUT']);
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
  // Match the suite's readiness allowance; cold inventory reads exceeded 10 s in CI.
  const deadline = Date.now() + 15_000;
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
  const deadline = Date.now() + 15_000;
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
