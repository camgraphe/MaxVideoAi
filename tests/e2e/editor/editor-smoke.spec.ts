import { expect, test } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  openFreshEditorWorkspace,
  switchEditorFocus,
  timelineItemCount,
  trackEditorClientErrors,
} from './editor-helpers';

test('MaxVideoAI editor loads canvas, viewer, and timeline without client errors', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  const initialTimelineItems = await timelineItemCount(page);
  expect(initialTimelineItems).toBeGreaterThan(0);
  await expect(page.getByText('Block templates')).toBeVisible();

  await switchEditorFocus(page, 'Viewer');
  await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
  await expect(page.getByTestId('editor-program-monitor')).toBeVisible();
  await expect(page.getByTestId('editor-program-frame')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blade / Cut tool' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle snapping' })).toBeVisible();
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  await switchEditorFocus(page, 'Canvas');
  await expect(page.getByText('Block templates')).toBeVisible();
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  assertNoEditorClientErrors(errors);
});
