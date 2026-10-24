import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

test('actual Composer inserts at the cursor, protects changed references, and loads only display posters on mobile and desktop', { timeout: 120_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture();
  const browser = await chromium.launch({ headless: true });
  const evidence = process.env.REFERENCE_MENTIONS_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [], mediaRequests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\.(mp4|mp3|wav)(\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
      const engine = listFalEngines().find(item => item.id === 'kling-o3-pro')!.engine;
      const allFields = [...engine.inputSchema!.required, ...engine.inputSchema!.optional];
      const fields = ['video_url', 'image_urls'].map(id => ({ field: allFields.find(field => field.id === id)!, required: id === 'video_url', role: id === 'video_url' ? 'primary' : 'reference' }));
      const image = (name: string) => ({ id: name, kind: 'image', name: 'a-long-content-hash-that-must-not-dominate-the-card.png', size: 1, type: 'image/png', url: `/${name}.svg`, previewUrl: `/${name}.svg`, status: 'ready' });
      const source = { id: 'source', kind: 'video', name: 'a-long-private-source-identity.mp4', size: 1, type: 'video/mp4', url: '/original.mp4', previewUrl: '/preview.mp4', thumbnailUrl: '/first.svg', durationSec: 6, status: 'ready' };
      const config = { engine, fields, caps: engine.modeCaps!.v2v, mode: 'v2v', locale: 'fr', assets: { video_url: [source], image_urls: [image('first'), image('portrait')] } };
      await page.goto(fixture.url);
      await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, config);
      await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
      try { await expect(page.locator('.app-reference-selected-item')).toHaveCount(3); }
      catch (error) { throw new Error(`Composer render failed: ${errors.join('; ')}; ${error}`); }
      await expect(page.locator('.app-generation-action')).toBeEnabled();
      await expect(page.locator('[data-reference-label="Vidéo 1"] img')).toHaveAttribute('src', '/first.svg');
      const portrait = page.locator('[data-reference-label="Image 2"] .app-reference-thumbnail img');
      await expect(portrait).toHaveJSProperty('naturalHeight', 280);
      const portraitGeometry = await portrait.evaluate(image => {
        const imageRect = image.getBoundingClientRect(), frame = image.parentElement!.getBoundingClientRect();
        return { width: imageRect.width, height: imageRect.height, frameWidth: frame.width, frameHeight: frame.height };
      });
      assert.deepEqual(portraitGeometry, { width: 56, height: 44, frameWidth: 56, frameHeight: 44 }, 'portrait intrinsic dimensions cannot stretch or vertically misalign the thumbnail');
      assert.deepEqual(mediaRequests, [], 'selected references never load video or audio bytes');
      assert.equal(await page.locator('video,audio').count(), 0);
      const prompt = page.locator('[data-workspace-prompt]');
      await prompt.focus();
      await prompt.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(5, 9));
      await page.getByRole('button', { name: 'Insérer @Image2 dans le prompt', exact: true }).click();
      await expect(prompt).toHaveValue('Keep @Image2 visible.');
      await expect(prompt).toBeFocused();
      assert.equal(await prompt.evaluate(node => (node as HTMLTextAreaElement).selectionStart), 12);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (evidence) await page.screenshot({ path: join(evidence, `references-${width}.png`), fullPage: true });
      await page.locator('[data-reference-label="Image 1"] .app-reference-selected-remove').click();
      await expect(prompt).toHaveValue('Keep @Image2 visible.');
      await expect(page.locator('.app-reference-mention-review')).toBeVisible();
      await expect(page.locator('.app-generation-action')).toBeDisabled();
      if (evidence) await page.screenshot({ path: join(evidence, `reference-review-${width}.png`), fullPage: true });
      await prompt.fill('Keep @Image1 visible.');
      await page.getByRole('button', { name: 'J’ai vérifié les références' }).click();
      await expect(page.locator('.app-generation-action')).toBeEnabled();
      await page.route('**/broken-poster.jpg', route => route.abort());
      await page.evaluate(assets => (globalThis as any).updateReferences(assets), { video_url: [{ ...source, thumbnailUrl: '/broken-poster.jpg' }], image_urls: [null, image('portrait')] });
      await expect(page.locator('[data-reference-label="Vidéo 1"] .app-reference-thumbnail img')).toHaveCount(0);
      assert.deepEqual(mediaRequests, [], 'a missing video poster falls back to a media glyph, never its MP4');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});

test('stored single and multi prompts keep their reference association while the other form is active', { timeout: 120_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source: `
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { useComposerReferenceMentions } from './components/composer/useComposerReferenceMentions';
    function Fixture() {
      const [state,setState] = useState(globalThis.fixtureConfig);
      globalThis.updateFixture = patch => setState(previous => ({...previous,...patch}));
      const mentions = useComposerReferenceMentions({...state, assetFields:state.fields, onPromptChange:prompt=>setState(previous=>({...previous,prompt}))});
      return <><output data-review>{String(mentions.needsReview)}</output>
        <output data-prompt>{state.prompt}</output><output data-scenes>{state.multiPrompt.scenes.map(scene=>scene.prompt).join('|')}</output>
        <button onClick={mentions.review}>Review references</button></>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  ` });
  const browser = await chromium.launch({ headless: true });
  try {
    const engine = listFalEngines().find(item => item.id === 'kling-o3-pro')!.engine;
    const field = [...engine.inputSchema!.required, ...engine.inputSchema!.optional].find(field => field.id === 'image_urls')!;
    const image = (id: string) => ({ id, kind: 'image', name: id, size: 1, type: 'image/png', url: `/${id}.svg`, previewUrl: `/${id}.svg`, status: 'ready' });
    for (const storedForm of ['single', 'multi']) {
      const page = await browser.newPage();
      const prompt = storedForm === 'single' ? 'Use @image_1.' : 'A wide shot.';
      const scenes = [{ id: 'scene-1', prompt: storedForm === 'multi' ? 'Use <<<image_1>>>.' : 'A wide shot.', duration: 5 }];
      const multiPrompt = { enabled: storedForm === 'multi', scenes };
      await page.goto(fixture.url);
      await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, { engine, fields: [{ field, required: false }], assets: { image_urls: [image('first'), image('second')] }, prompt, multiPrompt });
      await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
      await expect(page.locator('[data-review]')).toHaveText('false');
      await page.evaluate(multiPrompt => (globalThis as any).updateFixture({ multiPrompt }), { ...multiPrompt, enabled: !multiPrompt.enabled });
      await page.evaluate(assets => (globalThis as any).updateFixture({ assets }), { image_urls: [null, image('second')] });
      await expect(page.locator('[data-review]')).toHaveText('true');
      await page.evaluate(multiPrompt => (globalThis as any).updateFixture({ multiPrompt }), multiPrompt);
      await expect(page.locator('[data-review]')).toHaveText('true');
      await expect(page.locator('[data-prompt]')).toHaveText(prompt);
      await expect(page.locator('[data-scenes]')).toHaveText(scenes[0].prompt);
      await page.getByRole('button', { name: 'Review references' }).click();
      await expect(page.locator('[data-review]')).toHaveText('false');
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
