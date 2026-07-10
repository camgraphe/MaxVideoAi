import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  clickTimelineTrackAtSecond,
  dragTimelineClipEnd,
  hasTimelineOverlap,
  openFreshEditorWorkspace,
  timelineClipState,
  timelineItemCount,
  trackEditorClientErrors,
  type EditorClientErrors,
} from './editor-helpers';

const clientErrorsByPage = new WeakMap<Page, EditorClientErrors>();

test.beforeEach(async ({ page }) => {
  clientErrorsByPage.set(page, trackEditorClientErrors(page));
});

test.afterEach(async ({ page }) => {
  const errors = clientErrorsByPage.get(page);
  expect(errors).toBeDefined();
  if (errors) assertNoEditorClientErrors(errors);
});

async function switchWorkspaceMode(page: Page, mode: 'canvas' | 'viewer'): Promise<void> {
  const modeButtons = page.locator('header').locator('button[aria-pressed]');
  await expect(modeButtons).toHaveCount(2);
  const button = modeButtons.nth(mode === 'canvas' ? 0 : 1);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

test('creator generates a fixture shot in mock mode and sends its output to the timeline', async ({ page }) => {
  await openFreshEditorWorkspace(page);

  const shotNode = page.locator('.react-flow__node[data-id="shot-02"]');
  const outputNode = page.locator('.react-flow__node[data-id="output-02"]');
  const generateButton = shotNode.locator('button:has([data-shot-generate-label="true"])');
  const sendToTimelineButton = outputNode.locator('button');

  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(page.locator('[data-editor-status="true"]')).toContainText('Veo 3.1');
  await expect(sendToTimelineButton).toBeEnabled();

  await switchWorkspaceMode(page, 'viewer');
  const initialTimelineItems = await timelineItemCount(page);
  await clickTimelineTrackAtSecond(page, 'video', 13);

  await switchWorkspaceMode(page, 'canvas');
  await sendToTimelineButton.click();

  await switchWorkspaceMode(page, 'viewer');
  const timeline = page.getByLabel(/Video timeline|Timeline vidéo|Línea de tiempo de vídeo/i);
  await expect.poll(() => timelineItemCount(page)).toBeGreaterThan(initialTimelineItems);
  await expect(timeline.locator('[data-timeline-item][data-selected="true"]')).toHaveCount(1);
  await expect.poll(() => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect(page.getByRole('complementary', { name: /Project media library|Bibliothèque des médias du projet|Biblioteca de medios del proyecto/i })).toBeVisible();
});

test('editor trims linked fixture clips and verifies active-sequence export readiness', async ({ page }) => {
  await openFreshEditorWorkspace(page);
  await switchWorkspaceMode(page, 'viewer');

  const videoClip = page.locator('[data-timeline-item="timeline-output-02"]');
  const audioClip = page.locator('[data-timeline-item="timeline-output-02-audio"]');
  await expect(videoClip).toHaveAttribute('data-linked-group', 'timeline-output-02');
  await expect(audioClip).toHaveAttribute('data-linked-group', 'timeline-output-02');

  await dragTimelineClipEnd(page, 'timeline-output-02', -68);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(6);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(6);
  await expect.poll(() => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(() => hasTimelineOverlap(page, 'audio')).toBe(false);

  const timeline = page.getByLabel(/Video timeline|Timeline vidéo|Línea de tiempo de vídeo/i);
  await timeline.getByRole('button', { name: /Open export dialog|Ouvrir la boîte de dialogue d’exportation|Abrir diálogo de exportación/i }).click();
  const exportDialog = page.getByRole('dialog', { name: /Export sequence|Exporter la séquence|Exportar secuencia/i });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.locator('[data-status="pass"]')).toHaveCount(4);
  await expect(exportDialog.locator('[data-status="blocking"]')).toHaveCount(0);
  await expect(exportDialog.getByRole('button', { name: /Export video|Exporter la vidéo|Exportar vídeo/i })).toBeEnabled();
});
