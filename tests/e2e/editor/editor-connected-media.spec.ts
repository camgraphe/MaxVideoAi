import { expect, test } from '@playwright/test';
import { clickCanvasNode, openFreshEditorWorkspace, switchEditorFocus } from './editor-helpers';

const assetId = `ma_${'a'.repeat(32)}`;
const audio = { id: 'internal-audio', assetId, ref: { type: 'asset', assetId, kind: 'audio' }, kind: 'audio', url: '/assets/model-examples/minimax-h3/reference/station-ambience.wav', mime: 'audio/wav', mediaFacts: { source: 'probe', durationSec: 15 } };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
  await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true } }));
});

test('connected audio imports, inserts, creates a canvas source and survives local save/reload and bin undo', async ({ page }) => {
  await page.route('**/api/media-library/assets?**', (route) => route.fulfill({ json: { ok: true, assets: [audio], hasMore: false, nextCursor: null } }));
  await page.route('**/api/studio/media/resolve', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ refs: [audio.ref] });
    await route.fulfill({ json: { ok: true, assets: [audio] } });
  });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  const bin = page.getByRole('complementary', { name: 'Project media library' });
  const undo = bin.getByRole('button', { name: 'Undo media change', exact: true });
  await expect(undo, 'Hydrating project media is not an undoable user edit.').toBeDisabled();
  await bin.getByRole('button', { name: 'Import media', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Select station-ambience.wav' }).click();
  await dialog.getByRole('button', { name: 'Import selected (1)', exact: true }).click();
  const card = bin.locator('[data-project-media-asset-id]', { hasText: 'station-ambience.wav' });
  await expect(card).toBeVisible();
  await expect(undo).toBeEnabled();
  await card.getByRole('button', { name: 'Insert in timeline' }).click();
  await card.getByRole('button', { name: 'Add to canvas' }).click();
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('maxvideoai.editor.workspace.v1') ?? '{}');
    return state.nodes?.some((node: { data: { asset?: { ref?: unknown } } }) => node.data.asset?.ref);
  })).toBeTruthy();
  await page.reload();
  await switchEditorFocus(page, 'Viewer');
  await expect(card).toBeVisible();
  await expect(undo, 'Reloading the saved media does not invent undo history.').toBeDisabled();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('maxvideoai.editor.workspace.v1') ?? '{}'));
  const imported = state.projectAssets.find((asset: { ref?: { assetId?: string } }) => asset.ref?.assetId === assetId);
  expect(imported.ref).toEqual(audio.ref);
  expect(imported.id).not.toBe(audio.id);
  expect(state.timelineItems.find((item: { assetId: string }) => item.assetId === imported.id).sourceDurationSec).toBe(15);
  await card.locator('[data-project-media-card="true"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await bin.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(card).toBeVisible();
  await expect(undo, 'The sole removal has been undone, so no media action remains.').toBeDisabled();
});

test('closing a slow upload does not apply its eventual success', async ({ page }) => {
  await page.route('**/api/media-library/assets?**', (route) => route.fulfill({ json: { ok: true, assets: [] } }));
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/uploads/audio', async (route) => { await blocked; await route.fulfill({ json: { ok: true, asset: audio } }); });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  const bin = page.getByRole('complementary', { name: 'Project media library' });
  await bin.getByRole('button', { name: 'Import media', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import project media' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'cancel.wav', mimeType: 'audio/wav', buffer: Buffer.from('fixture') });
  await dialog.getByRole('button', { name: 'Close project media library' }).click();
  const response = page.waitForResponse('**/api/uploads/audio');
  release();
  await response;
  await expect(bin.locator('[data-project-media-asset-id]', { hasText: 'station-ambience.wav' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('maxvideoai.editor.workspace.v1') ?? '{}').projectAssets?.some((asset: { ref?: unknown }) => asset.ref))).toBe(false);
});

test('exact recent output replaces a compatible canvas source and canvas undo preserves unrelated media', async ({ page }) => {
  const recent = { id: 'output-fixture', jobId: 'job-fixture', ref: { type: 'job-output', jobId: 'job-fixture', outputId: 'output-fixture', kind: 'image' }, kind: 'image', mime: 'image/jpeg', url: '/hero/pika-22.jpg' };
  await page.route('**/api/media-library/assets?**', (route) => route.fulfill({ json: { ok: true, assets: [] } }));
  await page.route('**/api/media-library/recent-outputs?**', (route) => route.fulfill({ json: { ok: true, outputs: [recent] } }));
  await page.route('**/api/studio/media/resolve', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ refs: [recent.ref] });
    await route.fulfill({ json: { ok: true, assets: [recent] } });
  });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('maxvideoai.editor.workspace.v1') ?? '{}'));
  const before = await readState();
  await clickCanvasNode(page, 'asset-product-image');
  await page.keyboard.press('i');
  await page.getByRole('button', { name: 'Replace media', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Select image' });
  await dialog.getByRole('button', { name: 'Recent', exact: true }).click();
  await dialog.getByRole('button', { name: 'Select pika-22.jpg' }).click();
  await dialog.getByRole('button', { name: 'Import selected (1)' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await readState()).nodes.find((node: { id: string }) => node.id === 'asset-product-image').data.asset.ref).toEqual(recent.ref);
  expect((await readState()).timelineItems).toEqual(before.timelineItems);
  await page.getByRole('button', { name: 'Undo canvas edit' }).click();
  await expect.poll(async () => (await readState()).nodes.find((node: { id: string }) => node.id === 'asset-product-image').data.asset.url).toBe(before.nodes.find((node: { id: string }) => node.id === 'asset-product-image').data.asset.url);
  expect((await readState()).projectAssets).toEqual(before.projectAssets);
});
