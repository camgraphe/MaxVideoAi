import { expect, test } from '@playwright/test';
import { openFreshEditorWorkspace, switchEditorFocus } from './editor-helpers';
import { createStarterWorkspaceTemplate } from '../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';

const STUDIO_DEMO_VIDEO_PATH = '/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4';
const guidedProductAd = createStarterWorkspaceTemplate('guided-product-ad');

test('Canvas pricing settles after invalid preflight instead of repeating on measurement feedback', async ({ page }) => {
  const preflightBodies: string[] = [];
  await page.route('**/api/preflight', async (route) => {
    preflightBodies.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 400,
      json: {
        ok: false,
        messages: ['Invalid preflight request.'],
        error: { code: 'PREFLIGHT_REQUEST_INVALID', message: 'Invalid preflight request.' },
      },
    });
  });

  await openFreshEditorWorkspace(page);
  await page.waitForTimeout(900);
  expect(preflightBodies.length).toBeGreaterThan(0);
  const settledRequestCount = preflightBodies.length;

  await page.waitForTimeout(1_200);
  expect(preflightBodies).toHaveLength(settledRequestCount);
});

test('a generated mock video loads in the Viewer after Insert at playhead', async ({ page }) => {
  const demoResponses: number[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === STUDIO_DEMO_VIDEO_PATH) demoResponses.push(response.status());
  });

  await openFreshEditorWorkspace(page);
  await page.evaluate((template) => {
    const storageKey = 'maxvideoai.editor.workspace.v1';
    const current = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
    window.localStorage.setItem(storageKey, JSON.stringify({
      ...current,
      activeTemplateId: template.id,
      edges: template.edges,
      nodes: template.nodes,
      timelineItems: template.timelineItems,
    }));
  }, guidedProductAd);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.react-flow__node[data-id="shot-01"]')).toBeVisible();
  const shotNode = page.locator('.react-flow__node[data-id="shot-01"]');
  const generate = shotNode.locator('[data-shot-generation-action="true"]');
  await expect(generate).toBeEnabled();
  await generate.click();

  const outputNode = page.locator('.react-flow__node[data-id^="output-shot-01-"]');
  await expect(outputNode).toHaveCount(1);
  await outputNode.getByRole('button', { name: 'Insert at playhead' }).click();
  await switchEditorFocus(page, 'Viewer');

  const selectedClip = page.locator('[data-timeline-item][data-selected="true"]');
  await expect(selectedClip).toHaveCount(1);
  const itemId = await selectedClip.getAttribute('data-timeline-item');
  expect(itemId).toBeTruthy();
  const video = page.locator(`video[data-playback-item-id="${itemId}"]`);
  await expect(video).toBeAttached();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement, expectedPath) => (
    element.error === null &&
    new URL(element.currentSrc).pathname === expectedPath &&
    element.readyState >= HTMLMediaElement.HAVE_METADATA
  ), STUDIO_DEMO_VIDEO_PATH)).toBe(true);
  expect(demoResponses.some((status) => status === 200 || status === 206)).toBe(true);
});
