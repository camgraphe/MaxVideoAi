import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { workspaceSubjectReferencesFixtureSource } from './helpers/workspace-subject-references-fixture';

test('subject references opt in below References and hydrated subjects remain visible on mobile and desktop', { timeout: 120_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source: workspaceSubjectReferencesFixtureSource });
  const browser = await chromium.launch({ headless: true });
  const evidence = process.env.SUBJECT_REFERENCES_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  const engine = getBaseEngineIncludingHidden('kling-o3-pro')!;
  const field = { id: 'image_urls', type: 'image', label: 'Reference images', maxCount: 7 };
  const image = { id: 'first', kind: 'image', name: 'retained-subject.svg', url: '/portrait.svg', previewUrl: '/portrait.svg', status: 'ready' };
  const empty = { id: 'subject', frontal: null, video: null, references: [null, null, null] };
  try {
    for (const width of [390, 1440]) for (const hydrated of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(fixture.url);
      await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, {
        engine, fields: [{ field, required: false }], elements: [{ ...empty, frontal: hydrated ? image : null }],
        assets: { image_urls: [{ ...image, id: 'regular', name: 'regular.svg', url: '/first.svg', previewUrl: '/first.svg', size: 100, type: 'image/svg+xml' }] },
      });
      await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
      const references = page.locator('[data-reference-command="collections"]');
      await expect(references).toBeVisible();
      const before = await page.locator('[data-fixture-state]').textContent();
      const panel = page.locator('[data-subject-references]');
      if (hydrated) {
        await expect(panel).toBeVisible();
        await expect(panel.getByAltText('retained-subject.svg')).toBeVisible();
      } else {
        await expect(panel).toHaveCount(0);
        if (evidence) await page.screenshot({ path: join(evidence, `subjects-${width}-initial.png`), fullPage: true });
        await references.click();
        const dialog = page.getByRole('dialog');
        const subjects = dialog.getByRole('button', { name: 'Kling subjects (optional)', exact: true });
        await expect(subjects).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'References menu fits the viewport');
        if (evidence) await page.screenshot({ path: join(evidence, `subjects-${width}-menu.png`), fullPage: true });
        await subjects.click();
        await expect(dialog).toHaveCount(0);
        await expect(panel).toBeVisible();
        assert.equal(await panel.locator('input[accept="image/*"]').count(), 4);
      }
      const referencesBox = await references.boundingBox(), panelBox = await panel.boundingBox();
      assert.ok(referencesBox && panelBox && panelBox.y >= referencesBox.y + referencesBox.height, 'subject module appears below References');
      assert.equal(await page.locator('[data-fixture-state]').textContent(), before, 'presentation must not change subjects, ordinary references or prompt tokens');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (evidence) await page.screenshot({ path: join(evidence, `subjects-${width}-${hydrated ? 'hydrated' : 'enabled'}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
