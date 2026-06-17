import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  clickCanvasNode,
  openFreshEditorWorkspace,
  switchEditorFocus,
  trackEditorClientErrors,
} from './editor-helpers';

const transparentPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const transparentPngBody = Buffer.from(transparentPng.split(',')[1] ?? '', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.maxvideoai.test/**', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: transparentPngBody,
    });
  });
});

async function mockScrollableImageLibrary(page: Page): Promise<void> {
  const assets = Array.from({ length: 54 }, (_, index) => {
    const suffix = String(index).padStart(2, '0');
    return {
      id: `test-image-${suffix}`,
      url: `https://cdn.maxvideoai.test/library/asset-${suffix}.png`,
      thumbUrl: transparentPng,
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080,
      source: index % 2 === 0 ? 'generated' : 'upload',
    };
  });

  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, outputs: assets }),
    });
  });
}

test('asset library modal scrolls through a full app media library', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await mockScrollableImageLibrary(page);
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  await clickCanvasNode(page, 'asset-product-image');
  await page.getByRole('button', { name: 'Open Product Image settings' }).click();
  await expect(page.getByRole('complementary', { name: 'Node settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select image' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('54 assets');
  const library = dialog.getByRole('region', { name: 'Library' });
  const firstAsset = dialog.getByRole('button', { name: 'Use asset-00.png' });
  const lastAsset = dialog.getByRole('button', { name: 'Use asset-53.png' });
  await expect(firstAsset).toBeVisible();

  const gridMetrics = await library.evaluate((element) => {
    const firstAssetButton = element.querySelector('button[aria-label^="Use "]');
    const grid = firstAssetButton?.parentElement as HTMLElement | null;
    if (!grid) return null;
    const styles = window.getComputedStyle(grid);
    const scrollTopBefore = grid.scrollTop;
    grid.scrollTop = grid.scrollHeight;
    return {
      clientHeight: grid.clientHeight,
      overflowY: styles.overflowY,
      scrollTopAfter: grid.scrollTop,
      scrollTopBefore,
      scrollHeight: grid.scrollHeight,
    };
  });
  expect(gridMetrics).not.toBeNull();
  expect(gridMetrics?.overflowY).toBe('auto');
  expect(gridMetrics?.scrollHeight ?? 0).toBeGreaterThan(gridMetrics?.clientHeight ?? 0);
  expect(gridMetrics?.scrollTopAfter ?? 0).toBeGreaterThan(gridMetrics?.scrollTopBefore ?? 0);

  await expect(lastAsset).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('Project media grid scrolls internally without shrinking media cards', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  const projectMediaGrid = projectMediaSidebar.locator('[data-project-media-grid="true"]');
  await expect(projectMediaGrid).toBeVisible();

  for (let index = 0; index < 18; index += 1) {
    await projectMediaSidebar.getByRole('button', { name: 'New sequence' }).click();
  }

  await expect(projectMediaGrid.locator('[data-project-media-card="true"]')).toHaveCount(21);
  const beforeMetrics = await projectMediaGrid.evaluate((grid) => {
    const cardHeights = Array.from(grid.querySelectorAll('[data-project-media-card="true"]'))
      .map((card) => Math.round(card.getBoundingClientRect().height));
    const cardWidths = Array.from(grid.querySelectorAll('[data-project-media-card="true"]'))
      .map((card) => Math.round(card.getBoundingClientRect().width));
    const styles = getComputedStyle(grid);
    return {
      cardHeights: Array.from(new Set(cardHeights)),
      cardWidths: Array.from(new Set(cardWidths)),
      clientHeight: grid.clientHeight,
      overflowY: styles.overflowY,
      scrollHeight: grid.scrollHeight,
      scrollbarWidth: styles.scrollbarWidth,
    };
  });

  expect(beforeMetrics.scrollHeight).toBeGreaterThan(beforeMetrics.clientHeight);
  expect(beforeMetrics.overflowY).toBe('auto');
  expect(beforeMetrics.scrollbarWidth).toBe('none');
  expect(Math.min(...beforeMetrics.cardHeights)).toBeGreaterThanOrEqual(110);
  expect(Math.min(...beforeMetrics.cardWidths)).toBeGreaterThanOrEqual(80);

  const gridBox = await projectMediaGrid.boundingBox();
  expect(gridBox).not.toBeNull();
  if (!gridBox) return;

  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.wheel(0, 520);
  await expect.poll(async () => projectMediaGrid.evaluate((grid) => grid.scrollTop)).toBeGreaterThan(0);

  const afterMetrics = await projectMediaGrid.evaluate((grid) => ({
    cardHeights: Array.from(new Set(Array.from(grid.querySelectorAll('[data-project-media-card="true"]'))
      .map((card) => Math.round(card.getBoundingClientRect().height)))),
    cardWidths: Array.from(new Set(Array.from(grid.querySelectorAll('[data-project-media-card="true"]'))
      .map((card) => Math.round(card.getBoundingClientRect().width)))),
  }));
  expect(afterMetrics.cardHeights).toEqual(beforeMetrics.cardHeights);
  expect(afterMetrics.cardWidths).toEqual(beforeMetrics.cardWidths);

  assertNoEditorClientErrors(errors);
});

test('Project media supports Shift range selection, Cmd Ctrl toggle, and confirmed bulk delete', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  const projectMediaGrid = projectMediaSidebar.locator('[data-project-media-grid="true"]');
  await expect(projectMediaGrid).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await projectMediaSidebar.getByRole('button', { name: 'New sequence' }).click();
  }

  const sequence2 = projectMediaGrid.locator('[data-project-media-card="true"]', { hasText: 'Sequence 2' });
  const sequence3 = projectMediaGrid.locator('[data-project-media-card="true"]', { hasText: 'Sequence 3' });
  const sequence4 = projectMediaGrid.locator('[data-project-media-card="true"]', { hasText: 'Sequence 4' });
  await expect(sequence2).toHaveAttribute('data-project-media-card', 'true');
  await expect(sequence2).toHaveAttribute('data-project-media-card-id', /^sequence:/);

  await sequence2.click();
  await sequence4.click({ modifiers: ['Shift'] });
  await expect(projectMediaGrid.locator('[data-project-media-card="true"][data-selected="true"]')).toHaveCount(3);
  await expect(projectMediaGrid.locator('[data-project-media-card="true"][aria-pressed="true"]')).toHaveCount(3);

  await sequence3.click({ modifiers: ['ControlOrMeta'] });
  await expect(projectMediaGrid.locator('[data-project-media-card="true"][data-selected="true"]')).toHaveCount(2);
  await expect(projectMediaGrid.locator('[data-project-media-card="true"][aria-pressed="true"]')).toHaveCount(2);
  await expect(sequence2).toHaveAttribute('aria-pressed', 'true');
  await expect(sequence3).toHaveAttribute('aria-pressed', 'false');
  await expect(sequence4).toHaveAttribute('aria-pressed', 'true');

  let dialogCount = 0;
  page.on('dialog', async (dialog) => {
    dialogCount += 1;
    expect(dialog.message()).toContain('2 sequences');
    await dialog.accept();
  });
  await projectMediaSidebar.getByRole('button', { name: 'Delete' }).click();

  await expect(sequence2).toHaveCount(0);
  await expect(sequence3).toBeVisible();
  await expect(sequence4).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-card="true"][data-selected="true"]')).toHaveCount(0);
  expect(dialogCount).toBe(1);

  assertNoEditorClientErrors(errors);
});

test('Project media import shows localized upload failure and retry path', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets: [] }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, outputs: [] }),
    });
  });
  await page.route('**/api/uploads/image', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'UPLOAD_FAILED' }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await page.getByRole('button', { name: 'Import media' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'upload-failure.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ),
  });

  await expect(dialog.getByRole('alert')).toContainText(/upload|import|retry|try again/i);
  await expect(dialog.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
  assertNoEditorClientErrors(errors, {
    allowedResourceFailures: [{ status: 500, urlPattern: /\/api\/uploads\/image(?:$|\?)/ }],
  });
});

test('Project media import can add multiple library assets at once', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const assets = [
    {
      id: 'batch-image-0',
      url: 'https://cdn.maxvideoai.test/library/batch-image-0.png',
      thumbUrl: transparentPng,
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080,
      source: 'upload',
      createdAt: '2026-06-13T12:02:00.000Z',
    },
    {
      id: 'batch-video-1',
      url: 'https://cdn.maxvideoai.test/library/batch-video-1.mp4',
      thumbUrl: transparentPng,
      kind: 'video',
      mime: 'video/mp4',
      width: 1920,
      height: 1080,
      source: 'generated',
      createdAt: '2026-06-13T12:01:00.000Z',
    },
    {
      id: 'batch-audio-2',
      url: 'https://cdn.maxvideoai.test/library/batch-audio-2.mp3',
      kind: 'audio',
      mime: 'audio/mpeg',
      source: 'upload',
      createdAt: '2026-06-13T12:00:00.000Z',
    },
  ];

  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets, nextCursor: null, hasMore: false }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, outputs: [] }) });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Import media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Select batch-image-0.png' }).click();
  await dialog.getByRole('button', { name: 'Select batch-video-1.mp4' }).click();
  await expect(dialog.getByRole('button', { name: /Import selected.*2/ })).toBeEnabled();
  await dialog.getByRole('button', { name: /Import selected.*2/ }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('2 media assets imported into Project media.')).toBeVisible();
  await expect(page.locator('[data-project-media-asset-id="batch-image-0"]')).toBeVisible();
  await expect(page.locator('[data-project-media-asset-id="batch-video-1"]')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('Project media import pages through the app library and filters by media kind', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const requests: string[] = [];
  const firstPage = Array.from({ length: 4 }, (_, index) => ({
    id: `library-image-${index}`,
    url: `https://cdn.maxvideoai.test/library/image-${index}.png`,
    thumbUrl: transparentPng,
    kind: 'image',
    mime: 'image/png',
    width: 1920,
    height: 1080,
    source: 'upload',
    createdAt: `2026-06-13T12:0${index}:00.000Z`,
  }));
  const secondPage = [{
    id: 'library-video-4',
    url: 'https://cdn.maxvideoai.test/library/video-4.mp4',
    thumbUrl: transparentPng,
    kind: 'video',
    mime: 'video/mp4',
    width: 1920,
    height: 1080,
    source: 'upload',
    createdAt: '2026-06-13T11:59:00.000Z',
  }];
  const videoFirstPage = Array.from({ length: 60 }, (_, index) => {
    const suffix = String(index).padStart(2, '0');
    return {
      id: `library-video-${suffix}`,
      url: `https://cdn.maxvideoai.test/library/video-${suffix}.mp4`,
      thumbUrl: transparentPng,
      kind: 'video',
      mime: 'video/mp4',
      width: 1920,
      height: 1080,
      source: 'upload',
      createdAt: `2026-06-13T11:${String(59 - index).padStart(2, '0')}:00.000Z`,
    };
  });
  const videoSecondPage = [{
    id: 'library-video-60',
    url: 'https://cdn.maxvideoai.test/library/video-60.mp4',
    thumbUrl: transparentPng,
    kind: 'video',
    mime: 'video/mp4',
    width: 1920,
    height: 1080,
    source: 'upload',
    createdAt: '2026-06-13T10:59:00.000Z',
  }];

  await page.route('**/api/media-library/assets?**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const kind = url.searchParams.get('kind');
    const cursor = url.searchParams.get('cursor');
    const source = url.searchParams.get('source');
    if (kind === 'video') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          assets: source === 'angle' ? [] : cursor ? videoSecondPage : videoFirstPage,
          nextCursor: source === 'angle' || cursor ? null : 'video-page-2',
          hasMore: source !== 'angle' && !cursor,
        }),
      });
      return;
    }
    const assets = cursor ? secondPage : firstPage;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets,
        nextCursor: !kind && !cursor ? 'cursor-page-2' : null,
        hasMore: !kind && !cursor,
      }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, outputs: [] }) });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Import media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Search applies to loaded assets');
  await expect.poll(() => Promise.resolve(
    requests.some((search) => search.includes('includeOutputs=true'))
  )).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Select image-0.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Load more' }).click();
  await expect(dialog.getByRole('button', { name: 'Select video-4.mp4' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Angle' }).click();
  await dialog.getByRole('button', { name: 'Video' }).click();
  await expect.poll(() => Promise.resolve(requests.some((search) => search.includes('kind=video')))).toBe(true);
  await expect.poll(() => Promise.resolve(
    requests.some((search) => search.includes('kind=video') && !search.includes('source=angle'))
  )).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Load more' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Load more' }).click();
  await expect.poll(() => Promise.resolve(
    requests.some((search) => search.includes('kind=video') && search.includes('cursor=video-page-2'))
  )).toBe(true);

  await dialog.getByRole('button', { name: 'Generated' }).click();
  await expect.poll(() => Promise.resolve(
    requests.some((search) =>
      search.includes('kind=video') &&
      search.includes('source=generated') &&
      search.includes('includeOutputs=true')
    )
  )).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Load more' })).toBeVisible();

  assertNoEditorClientErrors(errors);
});

test('Project media sidebar filters imported media by kind', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const assets = [
    {
      id: 'filter-image-0',
      url: 'https://cdn.maxvideoai.test/library/filter-image-0.png',
      thumbUrl: transparentPng,
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080,
      source: 'upload',
      createdAt: '2026-06-13T12:02:00.000Z',
    },
    {
      id: 'filter-video-1',
      url: 'https://cdn.maxvideoai.test/library/filter-video-1.mp4',
      thumbUrl: transparentPng,
      kind: 'video',
      mime: 'video/mp4',
      width: 1920,
      height: 1080,
      source: 'upload',
      createdAt: '2026-06-13T12:01:00.000Z',
    },
    {
      id: 'filter-audio-2',
      url: 'https://cdn.maxvideoai.test/library/filter-audio-2.mp3',
      kind: 'audio',
      mime: 'audio/mpeg',
      source: 'upload',
      createdAt: '2026-06-13T12:00:00.000Z',
    },
  ];

  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets, nextCursor: null, hasMore: false }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, outputs: [] }) });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Import media' }).click();

  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Select filter-image-0.png' }).click();
  await dialog.getByRole('button', { name: 'Select filter-video-1.mp4' }).click();
  await dialog.getByRole('button', { name: 'Select filter-audio-2.mp3' }).click();
  await dialog.getByRole('button', { name: /Import selected.*3/ }).click();

  const projectMediaSidebar = page.getByRole('complementary', { name: 'Project media library' });
  const projectMediaGrid = projectMediaSidebar.locator('[data-project-media-grid="true"]');
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-image-0"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-video-1"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-audio-2"]')).toBeVisible();

  const kindFilters = projectMediaSidebar.getByRole('group', { name: 'Project media type filters' });
  await kindFilters.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-image-0"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-video-1"]')).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-audio-2"]')).toHaveCount(0);

  await kindFilters.getByRole('button', { name: 'Video', exact: true }).click();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-image-0"]')).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-video-1"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-audio-2"]')).toHaveCount(0);

  await kindFilters.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-image-0"]')).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-video-1"]')).toHaveCount(0);
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-audio-2"]')).toBeVisible();

  await kindFilters.getByRole('button', { name: 'All media', exact: true }).click();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-image-0"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-video-1"]')).toBeVisible();
  await expect(projectMediaGrid.locator('[data-project-media-asset-id="filter-audio-2"]')).toBeVisible();
  await expect(projectMediaSidebar.getByLabel('Project media view tools')).toHaveCount(0);

  assertNoEditorClientErrors(errors);
});

test('Project media upload patches the Studio library cache for the next import', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const uploadedAsset = {
    id: 'uploaded-cache-image',
    url: 'https://cdn.maxvideoai.test/library/uploaded-cache.png',
    thumbUrl: transparentPng,
    kind: 'image',
    mime: 'image/png',
    width: 1,
    height: 1,
    source: 'upload',
    createdAt: '2026-06-13T12:04:00.000Z',
  };

  await page.route('**/api/media-library/assets?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, assets: [], nextCursor: null, hasMore: false }),
    });
  });
  await page.route('**/api/media-library/recent-outputs?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, outputs: [] }) });
  });
  await page.route('**/api/uploads/image', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, asset: uploadedAsset }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await page.getByRole('button', { name: 'Import media' }).click();

  let dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'uploaded-cache.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-project-media-asset-id="uploaded-cache-image"]')).toBeVisible();

  await page.getByRole('button', { name: 'Import media' }).click();
  dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Select uploaded-cache.png' })).toBeVisible();

  assertNoEditorClientErrors(errors);
});
