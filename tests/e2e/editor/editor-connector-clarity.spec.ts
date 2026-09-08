import { expect, test } from '@playwright/test';
import { createStarterWorkspaceTemplate } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import { openEditorWorkspace } from './editor-helpers';

for (const width of [1440, 390]) {
  test(`optional connector preserves its anchor, edge and keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const template = createStarterWorkspaceTemplate('minimal-start');
    await page.addInitScript((state) => {
      localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify(state));
      localStorage.removeItem('maxvideoai.editor.projects.v1');
      localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
    }, {
      ...template, activeTemplateId: template.id, projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
      nodes: [...template.nodes, {
        id: 'clarity-video-source', type: 'asset-video', position: { x: -360, y: 250 },
        data: {
          kind: 'asset-video', title: 'Clarity source', sourceHandles: ['video_reference'],
          asset: { id: 'clarity-local-video', kind: 'video', filename: 'clarity.mp4', url: '/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4' },
        },
      }],
    });
    await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
    await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true } }));
    await openEditorWorkspace(page);
    const node = page.locator('.react-flow__node[data-id="minimal-start-video"]');
    const hiddenAnchor = node.locator('[data-shot-hidden-connector-anchor="video_reference"]');
    const visibleRow = node.locator('[data-shot-connector-row="input"][data-shot-connector-kind="video_reference"]');
    await expect(hiddenAnchor).toHaveCount(1);
    await expect(visibleRow).toHaveCount(0);
    const anchorState = await hiddenAnchor.locator('.react-flow__handle').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, tabIndex: (element as HTMLElement).tabIndex, pointerEvents: getComputedStyle(element).pointerEvents };
    });
    expect(anchorState.width).toBeGreaterThan(0);
    expect(anchorState.height).toBeGreaterThan(0);
    expect(anchorState.tabIndex).toBe(-1);
    expect(anchorState.pointerEvents).toBe('none');
    const selection = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
    await selection.getByRole('button', { name: 'Connections', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Connections', exact: true });
    await dialog.getByRole('combobox', { name: 'Inputs', exact: true }).selectOption('video_reference');
    await expect(dialog.locator('[data-canvas-connector-capacity]')).toContainText(/remaining.*maximum/);
    await dialog.getByRole('button', { name: /Clarity source/ }).focus();
    await page.keyboard.press('Enter');
    await expect(visibleRow).toHaveCount(1);
    await expect(hiddenAnchor).toHaveCount(0);
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Close connections', exact: true }).click();
    // XYFlow ends a Position.Left target at its left boundary, not its center.
    // Use that actual transformed endpoint, not only a nonempty path string.
    await expect.poll(() => page.evaluate(() => {
      const handle = document.querySelector('.react-flow__node[data-id="minimal-start-video"] [data-shot-connector-kind="video_reference"] .react-flow__handle');
      const edge = Array.from(document.querySelectorAll<SVGPathElement>('.react-flow__edge path.react-flow__edge-path'))
        .find((path) => path.closest('.react-flow__edge')?.getAttribute('data-id')?.includes('clarity-video-source'));
      if (!handle || !edge) return 9999;
      const point = edge.getPointAtLength(edge.getTotalLength());
      const screen = new DOMPoint(point.x, point.y).matrixTransform(edge.getScreenCTM()!);
      const box = handle.getBoundingClientRect();
      return Math.hypot(screen.x - box.left, screen.y - (box.top + box.height / 2));
    }), 'The moved optional handle must retain its real edge endpoint.').toBeLessThan(4);
    const launcher = visibleRow.getByRole('button');
    await launcher.focus();
    await page.keyboard.press('Enter');
    await dialog.locator('[class*="connectionRow"]').filter({ hasText: 'Clarity source' }).getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(visibleRow).toHaveCount(0);
    await expect(hiddenAnchor).toHaveCount(1);
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(node.locator('[data-canvas-connections-fallback]')).toBeFocused();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await expect(visibleRow).toHaveCount(1);
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });
}
