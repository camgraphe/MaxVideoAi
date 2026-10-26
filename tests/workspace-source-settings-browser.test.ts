import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit, expect, type Page, type Browser } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { sourceSettingsBrowserSource } from './helpers/workspace-source-settings-browser-source';

test('source settings stay truthful across reload, recall, upload, model/mode switches and Create', { timeout: 180000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source: sourceSettingsBrowserSource, config: {} });
  const evidence = process.env.SOURCE_SETTINGS_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  const browsers: Browser[] = [];
  const cases: { name: string; width: number; page: Page; errors: string[]; external: string[]; posts: string[] }[] = [];
  const state = async (page: Page) => JSON.parse((await page.locator('[data-state]').textContent())!);
  const waitForModify = async (page: Page) => expect(page.locator('[data-mode="v2v"]')).toHaveAttribute('aria-pressed', 'true');
  try {
    for (const name of ['chromium', 'webkit'] as const) {
      const browser = await (name === 'chromium' ? chromium : webkit).launch({ headless: true }); browsers.push(browser);
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
        const entry = { name, width, page, errors: [] as string[], external: [] as string[], posts: [] as string[] };
        page.on('pageerror', error => entry.errors.push(error.message));
        await page.route('**/*', route => {
          const request = route.request();
          if (request.method() !== 'GET') { entry.posts.push(request.method()); return route.abort(); }
          if (new URL(request.url()).origin !== fixture.url) { entry.external.push(new URL(request.url()).origin); return route.abort(); }
          return route.continue();
        });
        await page.goto(fixture.url); await waitForModify(page);
        if (evidence) await page.screenshot({ path: evidence + '/' + name + '-' + width + '-without-source.png', fullPage: true });
        cases.push(entry);
      }
    }
    // Capture all four baseline views before the assertion: the RED run preserves both engines and viewport sizes.
    const visible = await Promise.all(cases.map(({page}) => page.locator('[data-settings-density]').isVisible()));
    assert.deepEqual(visible, [false, false, false, false], 'a result viewer and restored 7s do not constitute an attached source');
    for (const entry of cases) {
      const { page, name, width } = entry;
      const bar = page.locator('[data-settings-density]');
      await page.reload(); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.goto(fixture.url + '/?history=without-source'); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.goBack(); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.goForward(); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.goBack(); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.getByRole('button', { name: 'Simulate upload', exact: true }).click(); await expect(bar).toHaveCount(0);
      await page.getByRole('button', { name: 'Simulate failed upload', exact: true }).click(); await expect(bar).toHaveCount(0);
      await page.getByRole('button', { name: 'Select valid source', exact: true }).click(); await expect(bar).toBeVisible();
      await page.getByRole('button', { name: /Output duration:/ }).click();
      await page.getByRole('option', { name: /Output duration:\s*7s$/ }).click();
      assert.equal((await state(page)).form.durationSec, 7, 'Mini permits a requested result duration independent of the 4s source');
      if (evidence) await page.screenshot({ path: evidence + '/' + name + '-' + width + '-ready-source.png', fullPage: true });
      await page.reload(); await expect(bar).toBeVisible(); assert.equal((await state(page)).form.durationSec, 7);
      await page.goto(fixture.url + '/?history=ready-source'); await expect(bar).toBeVisible();
      await page.goBack(); await expect(bar).toBeVisible();
      assert.equal((await state(page)).form.durationSec, 7, 'browser Back retains the requested output choice');
      await page.locator('[data-mode="create"]').click(); await expect(bar).toBeVisible();
      let current = await state(page); assert.equal(current.mode, 't2v'); assert.equal(current.quote.inputs.length, 0);
      await page.locator('[data-mode="v2v"]').click(); await expect(bar).toBeVisible();
      await page.getByRole('button', { name: 'Remove source', exact: true }).click(); await expect(bar).toHaveCount(0);
      if (evidence) await page.screenshot({ path: evidence + '/' + name + '-' + width + '-removed-source.png', fullPage: true });
      await page.reload(); await waitForModify(page); await expect(bar).toHaveCount(0);
      await page.getByRole('button', { name: 'Recall settings without source', exact: true }).click(); await expect(bar).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: 'Prompt' })).toHaveValue('Recalled synthetic prompt');
      for (const id of ['wan-3-prime', 'kling-o3-pro', 'seedance-2-0-mini']) {
        await page.getByLabel('Model', { exact: true }).selectOption(id);
        await page.locator('[data-mode="v2v"]').click(); await expect(bar).toHaveCount(0);
        await page.getByRole('button', { name: 'Select valid source', exact: true }).click(); await expect(bar).toBeVisible();
        await page.getByRole('button', { name: 'Remove source', exact: true }).click(); await expect(bar).toHaveCount(0);
      }
      await page.locator('[data-mode="extend"]').click(); await expect(bar).toHaveCount(0);
      await page.getByRole('button', { name: 'Select valid source', exact: true }).click(); await expect(bar).toBeVisible();
      await page.getByRole('button', { name: 'Remove source', exact: true }).click(); await expect(bar).toHaveCount(0);
      await page.locator('[data-mode="create"]').click(); await expect(bar).toBeVisible();
      if (evidence) await page.screenshot({ path: evidence + '/' + name + '-' + width + '-create.png', fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(entry.errors, []); assert.deepEqual(entry.external, []); assert.deepEqual(entry.posts, []);
    }
  } finally { for (const browser of browsers) await browser.close(); await fixture.close(); }
});
