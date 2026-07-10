import { expect, test, type Page } from '@playwright/test';
import {
  openFreshEditorWorkspace,
  switchEditorFocus,
} from './editor-helpers';

async function expectHorizontalTimeline(page: Page): Promise<void> {
  const viewport = page.locator('[class*="timelineViewport"]').first();
  await expect(viewport).toBeVisible();
  const dimensions = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
}

test('Studio desktop keeps Project media, viewer, inspector, and timeline visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect(page.getByRole('complementary', { name: 'Project media library' })).toBeVisible();
  await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clip inspector' })).toBeVisible();
  await expect(page.getByLabel('Video timeline')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Project media', exact: true })).toBeHidden();
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`Studio tablet ${viewport.width}x${viewport.height} uses accessible side drawers`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshEditorWorkspace(page);
    await switchEditorFocus(page, 'Viewer');

    const mediaToggle = page.getByRole('button', { name: 'Project media', exact: true });
    const inspectorToggle = page.getByRole('button', { name: 'Clip inspector', exact: true });
    await expect(mediaToggle).toBeVisible();
    await expect(inspectorToggle).toBeVisible();
    await expect(mediaToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(page.getByTestId('editor-video-viewer')).toBeVisible();

    await mediaToggle.click();
    const mediaPanel = page.locator('#studio-project-media-panel');
    const closeMediaPanel = mediaPanel.getByRole('button', { name: 'Close dialog: Project media' });
    await expect(mediaPanel).toBeVisible();
    await expect(mediaPanel).not.toHaveAttribute('aria-modal', 'true');
    await expect(closeMediaPanel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => mediaPanel.evaluate((panel) => panel.contains(document.activeElement))).toBe(false);
    await closeMediaPanel.focus();
    await page.keyboard.press('Escape');
    await expect(mediaPanel).toBeHidden();
    await expect(mediaToggle).toBeFocused();
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test(`Studio mobile ${viewport.width}x${viewport.height} keeps one primary surface and a scrollable timeline`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshEditorWorkspace(page);
    await switchEditorFocus(page, 'Viewer');

    const mediaToggle = page.getByRole('button', { name: 'Project media', exact: true });
    const inspectorToggle = page.getByRole('button', { name: 'Clip inspector', exact: true });
    await expect(mediaToggle).toBeVisible();
    await expect(inspectorToggle).toBeVisible();
    await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(page.locator('#studio-inspector-panel')).toBeHidden();
    await expectHorizontalTimeline(page);

    await inspectorToggle.click();
    const inspectorPanel = page.locator('#studio-inspector-panel');
    await expect(inspectorPanel).toBeVisible();
    await expect(page.locator('#studio-project-media-panel')).toBeHidden();
    await expect(inspectorPanel.getByRole('button', { name: 'Close dialog: Clip inspector' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(inspectorPanel).toBeHidden();
    await expect(inspectorToggle).toBeFocused();
  });
}
