import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture, workspaceReferenceFixtureSource } from './helpers/workspace-reference-browser-fixture';

const engine = listFalEngines().find(entry => entry.id === 'wan-3')!.engine;
const ids = ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls'];
const fields = [...engine.inputSchema!.required, ...engine.inputSchema!.optional]
  .filter(field => ids.includes(field.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  .map(field => ({ field, required: false, role: 'reference' }));
function asset(kind: 'image' | 'video' | 'audio', index = 0) {
  const url = kind === 'image' ? '/first.svg' : `/${kind}-${index}.${kind === 'video' ? 'mp4' : 'wav'}`;
  return { id: `${kind}-${index}`, assetId: `asset-${kind}-${index}`, kind, name: `private-long-filename-${kind}-${index}`,
    url, previewUrl: url, thumbnailUrl: kind === 'audio' ? undefined : '/first.svg', type: `${kind}/${kind === 'image' ? 'svg+xml' : kind === 'video' ? 'mp4' : 'wav'}`,
    size: 1, status: 'ready', durationSec: kind === 'image' ? undefined : 20 };
}
const assets = Object.fromEntries(['image', 'video', 'audio'].map(kind => [`reference_${kind}_urls`, [asset(kind as 'image' | 'video' | 'audio')]]));
const source = workspaceReferenceFixtureSource.replace('onAssetRemove=', `
  onVideoExcerptEditorChange={async (field,index,open)=>{globalThis.editorEvents=[...(globalThis.editorEvents??[]),{field:field.id,index,open}];return assets[field.id][index].previewUrl;}}
  onPrepareVideoExcerpt={async (field,index,range)=>{globalThis.prepared={field:field.id,index,range};setAssets(previous=>({...previous,[field.id]:previous[field.id].map((item,i)=>i===index?{...item,url:item.url+'?prepared',durationSec:range.endSec-range.startSec}:item)}));}}
  onAssetRemove=`);

test('compact references edit the correct video/audio inside the picker and preserve modal focus', { timeout: 120_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, assistancePreview: true, config: {
    engine, fields, assets, locale: 'en', caps: { modes: ['ref2v'] }, assistance: { scopeKey: 'owner', contextKey: 'references' },
  } });
  try {
    for (const browserType of [chromium, webkit]) {
      const browser = await browserType.launch({ headless: true });
      try {
        for (const width of [320, 379, 390, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width < 600 });
          await page.goto(fixture.url);
          if (width === 390) await page.getByRole('tab', { name: 'AI assistant', exact: true }).click();
          const summary = page.locator('.app-reference-selected-summary');
          await expect(summary).toHaveText(/Image 1.*Video 1.*Audio 1/s);
          assert.doesNotMatch(await summary.innerText(), /20|section|private/);
          await expect(summary.locator('.video-excerpt-trigger')).toHaveCount(0);
          await expect(summary.locator('.app-reference-selected-remove')).toHaveCount(3);
          const referenceSection = page.locator('[data-compact-references]').locator('..');
          const videoManage = summary.getByRole('button', { name: 'Manage · Video 1', exact: true });
          await videoManage.focus();
          await expect(videoManage).toBeFocused();
          await expect(videoManage.locator('.app-reference-edit-hint')).toHaveCSS('opacity', '1');
          for (const kind of ['video', 'audio'] as const) {
            const label = kind === 'video' ? 'Video 1' : 'Audio 1';
            const manage = summary.getByRole('button', { name: `Manage · ${label}`, exact: true });
            if (width < 600) await manage.tap(); else await manage.click();
            const picker = page.getByRole('dialog', { name: 'References', exact: true });
            await expect(picker.locator(`[data-reference-role="reference_${kind}_urls"]`)).toHaveAttribute('aria-pressed', 'true');
            const slot = picker.locator('[data-reference-selected="true"]');
            await expect(slot).toHaveAttribute('data-asset-index', '0');
            await expect(slot.locator('.app-reference-slot-label')).toContainText(label);
            assert.doesNotMatch(await slot.locator('.app-reference-slot-label').innerText(), /private/);
            const choose = slot.getByRole('button', { name: 'Choose section', exact: true });
            await choose.click();
            const editor = page.locator('.video-excerpt-dialog');
            await expect(editor).toBeVisible();
            await expect(editor.locator(kind)).toHaveCount(1);
            await editor.getByRole('spinbutton', { name: 'End (seconds)', exact: true }).fill('5');
            await editor.getByRole('button', { name: 'Close', exact: true }).press('Shift+Tab');
            await expect(editor.getByRole('button', { name: 'Use this section', exact: true })).toBeFocused();
            await page.keyboard.press('Escape');
            await expect(editor).toHaveCount(0);
            await expect(picker).toBeVisible();
            await expect(choose).toBeFocused();
            assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
            assert.equal(await page.evaluate(() => (globalThis as any).prepared), undefined);
            await picker.getByRole('button', { name: 'Close', exact: true }).click();
            assert.equal(await page.evaluate(() => document.body.style.overflow), '');
          }
          const many = { ...assets, reference_video_urls: Array.from({ length: 8 }, (_, i) => asset('video', i)), reference_audio_urls: Array.from({ length: 8 }, (_, i) => asset('audio', i)) };
          await page.evaluate(value => (globalThis as any).updateReferences(value), many);
          await expect(summary.locator('.app-reference-selected-item')).toHaveCount(3);
          await expect(summary.getByRole('button', { name: 'Manage · 17 References' })).toHaveText('+14');
          if (width < 768) {
            assert.equal(await summary.evaluate(el => getComputedStyle(el).flexWrap), 'wrap', 'the selected-media group wraps instead of scrolling');
            for (const item of await summary.locator('button').all()) {
              const itemBox = (await item.boundingBox())!, sectionBox = (await referenceSection.boundingBox())!;
              assert.ok(itemBox.x >= sectionBox.x && itemBox.x + itemBox.width <= sectionBox.x + sectionBox.width + 1,
                `${browserType.name()} ${width}px: every visible reference and +N stays fully inside the mobile form: ${JSON.stringify({ label: await item.getAttribute('aria-label'), itemBox, sectionBox })}`);
            }
            assert.ok((await summary.boundingBox())!.height <= 100, 'the capped media group needs at most two compact rows');
          }
          await summary.getByRole('button', { name: 'Manage · 17 References' }).click();
          const picker = page.getByRole('dialog', { name: 'References', exact: true });
          const target = picker.locator('[data-reference-selected="true"]');
          await expect(target).toHaveAttribute('data-asset-index', '2');
          await expect(target.locator('.app-reference-slot-label')).toContainText('Video 3');
          await target.getByRole('button', { name: 'Choose section', exact: true }).click();
          const editor = page.locator('.video-excerpt-dialog');
          await editor.getByRole('spinbutton', { name: 'Start (seconds)', exact: true }).fill('4');
          await editor.getByRole('spinbutton', { name: 'End (seconds)', exact: true }).fill('9');
          await editor.getByRole('button', { name: 'Use this section', exact: true }).click();
          await expect(editor).toHaveCount(0);
          assert.deepEqual(await page.evaluate(() => (globalThis as any).prepared), { field: 'reference_video_urls', index: 2, range: { startSec: 4, endSec: 9 } });
          await expect(target.locator('.app-reference-slot-label')).toContainText('5 s');
          await picker.getByRole('button', { name: 'Close', exact: true }).click();
          await page.getByRole('tab', { name: 'Prompt', exact: true }).click();
          await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Keep this visible.');
          assert.equal(await page.evaluate(() => document.body.scrollWidth <= innerWidth), true);
          assert.equal(await page.evaluate(() => (globalThis as any).submissions ?? 0), 0);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
