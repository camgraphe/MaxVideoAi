import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  openFreshEditorWorkspace,
  switchEditorFocus,
  trackEditorClientErrors,
  type EditorClientErrors,
} from './editor-helpers';

const clientErrorsByPage = new WeakMap<Page, EditorClientErrors>();
const screenshotDirectory = join(process.cwd(), 'output/playwright/task-11');

test.beforeEach(async ({ page }) => {
  clientErrorsByPage.set(page, trackEditorClientErrors(page));
});

test.afterEach(async ({ page }) => {
  const errors = clientErrorsByPage.get(page);
  expect(errors).toBeDefined();
  if (errors) assertNoEditorClientErrors(errors);
});

async function expectThemeTokenContrast(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const shell = page.locator(`[data-studio-theme="${theme}"]`);
  await expect(shell).toBeVisible();
  const contrast = await shell.evaluate((element) => {
    const styles = getComputedStyle(element);
    const resolveRgb = (value: string): [number, number, number] => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const channels = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [];
      probe.remove();
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
    };
    const luminance = (color: [number, number, number]) => {
      const channels = color.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foreground = luminance(resolveRgb(styles.getPropertyValue('--studio-text').trim()));
    const background = luminance(resolveRgb(styles.getPropertyValue('--studio-bg').trim()));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

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

for (const scenario of [
  { theme: 'light' as const, viewport: { width: 1440, height: 1024 } },
  { theme: 'dark' as const, viewport: { width: 390, height: 844 } },
]) {
  test(`Studio ${scenario.theme} theme stays readable at ${scenario.viewport.width}x${scenario.viewport.height}`, async ({ page }, testInfo) => {
    await page.addInitScript((theme) => {
      window.localStorage.setItem('maxvideoai.studio.theme.v1', theme);
      window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
    }, scenario.theme);
    await page.setViewportSize(scenario.viewport);
    await openFreshEditorWorkspace(page);
    await expectThemeTokenContrast(page, scenario.theme);
    await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
    await expect(page.getByLabel('Video timeline')).toBeVisible();
    if (scenario.viewport.width < 600) {
      await switchEditorFocus(page, 'Viewer');
      await expect(page.getByRole('button', { name: 'Project media', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Clip inspector', exact: true })).toBeVisible();
    }
    await mkdir(screenshotDirectory, { recursive: true });
    const screenshotPath = join(
      screenshotDirectory,
      `${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`task-11-${scenario.theme}-${scenario.viewport.width}x${scenario.viewport.height}`, {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });
}
