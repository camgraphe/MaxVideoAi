import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

test('Milo waits for Storyboard identity and accepts messages after ready or unavailable resolution', { timeout: 60_000 }, async () => {
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-0')!.engine;
  const field = engine.inputSchema!.optional!.find(field => field.id === 'image_urls')!;
  const asset = { id: 'storyboard-local', kind: 'image', name: 'Storyboard reference', size: 0, type: 'image/png', previewUrl: '/first.svg', status: 'ready', identityResolving: true };
  const fixture = await startWorkspaceReferenceFixture({ assistancePreview: true, config: { engine, locale: 'en', fields: [{ field, role: 'reference' }], assets: { image_urls: [asset] }, assistance: { accountKey: 'owner', scopeKey: 'storyboard-identity', contextKey: 'modify' } } });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(fixture.url);
    assert.equal(new URL(page.url()).origin, fixture.url);
    await expect(page.getByRole('heading', { name: engine.label })).toBeVisible();
    await page.getByRole('tab', { name: 'AI assistant', exact: true }).click();
    await page.locator('[data-assistance-message]').fill('Keep the storyboard continuity.');
    const send = page.getByRole('button', { name: 'Send message to Milo', exact: true });
    await expect(send).toBeDisabled();
    await page.locator('[data-assistance-message]').press('Enter');
    await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
    for (const ready of [true, false]) {
      await page.evaluate(({ asset, ready }) => (globalThis as any).updateReferences({ image_urls: [{ ...asset, identityResolving: false, ref: ready ? { type: 'job-output', jobId: 'owned-job', outputId: 'owned-output', kind: 'image' } : undefined }] }), { asset, ready });
      await expect(send).toBeEnabled();
      await expect(page.locator('[data-assistance-message]')).toHaveValue('Keep the storyboard continuity.');
    }
    await page.screenshot({ path: '/tmp/milo-storyboard-identity-ready.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await fixture.close(); }
});
