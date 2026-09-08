import { expect, test } from '@playwright/test';
import { canvasNodeControls, openMinimalEditorWorkspace } from './editor-helpers';

test('keyboard creation completes once and explicit settings can close while preserving selection', async ({ page }) => {
  await openMinimalEditorWorkspace(page);
  const nodes = page.locator('.react-flow__node');
  const before = await nodes.count();
  const trigger = page.locator('[data-canvas-toolbar-menu-id="add"]');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const create = page.locator('[data-canvas-toolbar-preset-id="generate-video"]');
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(nodes).toHaveCount(before + 1);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  const settings = (await canvasNodeControls(page)).locator('[data-canvas-node-inspect-button]');
  await settings.click();
  await expect(page.locator('[data-canvas-inspector-close]')).toBeVisible();
  await page.locator('[data-canvas-inspector-close]').click();
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(settings).toBeFocused();
});

test('track actions are reachable without a context click', async ({ page }) => {
  await openMinimalEditorWorkspace(page);
  await page.locator('[data-timeline-track-actions="video"]').click();
  await page.getByRole('menuitem', { name: /Add.*track/i }).click();
  await expect(page.locator('[data-timeline-track-label="video-2"]')).toBeVisible();
});

test('mobile settings opens the inspector immediately and preserves selection on close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMinimalEditorWorkspace(page);
  const settings = (await canvasNodeControls(page)).locator('[data-canvas-node-inspect-button]');
  await settings.click();
  await expect(page.locator('[data-canvas-inspector-close]')).toBeVisible();
  await expect(page.locator('[data-studio-canvas-inspector="true"]')).toBeVisible();
  await page.locator('[data-canvas-inspector-close]').click();
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(settings).toBeFocused();
});

test('connection choices connect without dragging, disconnect and undo without removing sources', async ({ page }) => {
  await openMinimalEditorWorkspace(page);
  const selectedNode = await canvasNodeControls(page);
  await selectedNode.locator('[data-canvas-node-actions-button]').click();
  await selectedNode.getByRole('menuitem', { name: 'Connections', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connections', exact: true });
  await dialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(dialog).toBeFocused();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await dialog.getByRole('button', { name: /Prompt/ }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close connections' }).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
