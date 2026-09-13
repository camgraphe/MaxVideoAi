import { expect, test, type Page } from '@playwright/test';
import { createStarterWorkspaceTemplate } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import { canvasNodeControls, clickTimelineClip, dragTimelineClip, openEditorWorkspace, timelineClipStates } from './editor-helpers';

const videoUrl = '/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4';
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

async function openReviewWorkspace(page: Page) {
  const template = createStarterWorkspaceTemplate('minimal-start');
  const mediaNodes = (['video', 'audio'] as const).map((kind, index) => ({
    id: `review-${kind}`, type: `asset-${kind}`, position: { x: 730, y: index * 260 },
    data: {
      kind: `asset-${kind}`, title: `Review ${kind}`, sourceHandles: [kind === 'video' ? 'video_reference' : 'audio'],
      asset: {
        id: `review-${kind}-asset`, kind, filename: kind === 'video' ? 'review.mp4' : 'review.wav',
        url: kind === 'video' ? videoUrl : '/studio/demo-ambient.wav',
      },
    },
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/legal/cookies/version', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, version: 'studio-local-fixture', publishedAt: null }),
  }));
  await page.addInitScript((state) => {
    localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify(state));
    localStorage.removeItem('maxvideoai.editor.projects.v1');
    localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
  }, {
    ...template, nodes: [...template.nodes, ...mediaNodes], activeTemplateId: template.id,
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    timelineItems: [{ id: 'review-clip', outputNodeId: 'review-video', track: 'video', title: 'Review clip', startSec: 0, durationSec: 6, mediaKind: 'video', mediaUrl: videoUrl }],
  });
  await openEditorWorkspace(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
}

async function activateTimelineWithHistory(page: Page) {
  await dragTimelineClip(page, 'review-clip', 40);
  await clickTimelineClip(page, 'review-clip');
  await expect(page.locator('[data-active-editor-surface]')).toHaveAttribute('data-active-editor-surface', 'timeline');
  return timelineClipStates(page);
}

for (const entry of ['node actions', 'input connector']) {
  test(`connections from ${entry} restore the canvas undo target after timeline selection`, async ({ page }) => {
    await openReviewWorkspace(page);
    const timelineBefore = await activateTimelineWithHistory(page);
    if (entry === 'node actions') {
      const node = await canvasNodeControls(page);
      await node.locator('[data-canvas-node-actions-button]').click();
      await node.getByRole('menuitem', { name: 'Connections', exact: true }).click();
    } else {
      // The Prompt slot is full; its management action must remain enabled.
      await page.locator('[data-canvas-connect-handle="prompt"]').click();
    }
    const dialog = page.getByRole('dialog', { name: 'Connections', exact: true });
    await expect(page.locator('[data-active-editor-surface]')).toHaveAttribute('data-active-editor-surface', 'canvas');
    await dialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close connections' }).click();
    await expect(page.locator('[data-active-editor-surface]')).toHaveAttribute('data-active-editor-surface', 'canvas');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo canvas edit', exact: true })).toBeEnabled();
    await page.keyboard.press(`${modifier}+z`);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    expect(await timelineClipStates(page)).toEqual(timelineBefore);
  });
}

for (const clipboardMode of ['available', 'denied', 'unavailable'] as const) {
test(`selection Copy works with clipboard API ${clipboardMode} and targets canvas paste`, async ({ page }) => {
  if (clipboardMode !== 'available') {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'unavailable' ? undefined : {
        writeText: async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError'); },
      } });
    }, clipboardMode);
  }
  await openReviewWorkspace(page);
  const timelineBefore = await activateTimelineWithHistory(page);
  const selectedNode = await canvasNodeControls(page);
  await selectedNode.locator('[data-canvas-node-actions-button]').click();
  await selectedNode.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect(page.locator('[data-active-editor-surface]')).toHaveAttribute('data-active-editor-surface', 'canvas');
  await expect(page.getByRole('menuitem', { name: 'Copy', exact: true })).toHaveCount(0);
  await page.keyboard.press(`${modifier}+v`);
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  expect(await timelineClipStates(page)).toEqual(timelineBefore);
});
}

test('selection Copy reports failure when both browser clipboard methods are blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError'); },
    } });
    document.execCommand = () => false;
  });
  await openReviewWorkspace(page);
  const selectedNode = await canvasNodeControls(page);
  await selectedNode.locator('[data-canvas-node-actions-button]').click();
  await selectedNode.getByRole('menuitem', { name: 'Copy', exact: true }).click();
  await expect(selectedNode.getByRole('alert')).toHaveText('Copy blocked. Select the block and press Ctrl/Cmd+C.');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
});

for (const [kind, label] of [['video', 'Play video'], ['audio', 'Listen']] as const) {
  test(`${kind} playback transfers keyboard focus from the removed launcher to native controls`, async ({ page }) => {
    await openReviewWorkspace(page);
    const node = page.locator(`.react-flow__node[data-id="review-${kind}"]`);
    const launcher = node.getByRole('button', { name: label, exact: true });
    await launcher.focus();
    await page.keyboard.press('Enter');
    await expect(node.locator(kind)).toBeVisible();
    await expect(node.locator(kind)).toBeFocused();
    await expect(launcher).toHaveCount(0);
    const prompt = page.locator('.react-flow__node[data-id="minimal-start-prompt"] textarea');
    await prompt.fill('Keep focus here while the canvas rerenders');
    await expect(prompt).toBeFocused();
  });
}
