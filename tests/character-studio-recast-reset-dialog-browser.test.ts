import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { bundleClientFlow } from './helpers/client-flow-dom';

// A real modal makes the rest of the document inert. JSDOM's showModal stub
// cannot reproduce the focus loss caused by an asymmetric StrictMode cleanup.
const bundle = bundleClientFlow(`
  import React, { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { CharacterStudioRecastResetDialog } from './src/components/tools/character-builder/_components/CharacterStudioRecastResetDialog.client';
  import { getRecastSessionCopy } from './src/components/tools/character-builder/_lib/recast-session-copy';
  function Fixture() {
    const [open, setOpen] = useState(false);
    const [confirmations, setConfirmations] = useState(0);
    return <>
      <button id="new-scene" onClick={() => setOpen(true)}>New scene</button>
      <output data-confirmations>{confirmations}</output>
      {open && <CharacterStudioRecastResetDialog copy={getRecastSessionCopy('en')}
        onClose={() => setOpen(false)}
        onConfirm={() => { setConfirmations(value => value + 1); setOpen(false); }} />}
    </>;
  }
  const scene = <Fixture />;
  createRoot(document.getElementById('root')).render(window.strictMode
    ? <React.StrictMode>{scene}</React.StrictMode> : scene);
`, {});

for (const strictMode of [false, true]) {
  test(`Recast reset dialog preserves focus and requires explicit confirmation ${strictMode ? 'with' : 'without'} StrictMode`,
    { timeout: 20_000 }, async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5_000);
        const errors: string[] = [];
        const nativeDialogs: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
        await page.setContent('<div id="root"></div>');
        await page.evaluate(value => { (window as any).strictMode = value; }, strictMode);
        await page.addScriptTag({ content: await bundle });
        const trigger = page.locator('#new-scene');
        const dialog = page.getByRole('dialog', { name: 'New scene', exact: true });
        const keep = page.getByRole('button', { name: 'Keep this scene', exact: true });

        for (const action of ['cancel', 'escape', 'enter'] as const) {
          await trigger.click();
          await expect(dialog).toBeVisible();
          assert.equal(await dialog.evaluate(node => node.matches(':modal')), true);
          await expect(keep).toBeFocused();
          if (action === 'cancel') await keep.click();
          else await page.keyboard.press(action === 'escape' ? 'Escape' : 'Enter');
          await expect(dialog).toHaveCount(0);
          await expect(trigger).toBeFocused();
          await expect(page.locator('[data-confirmations]')).toHaveText('0');
        }

        await trigger.click();
        await expect(keep).toBeFocused();
        await page.getByRole('button', { name: 'Start a new scene', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.locator('[data-confirmations]')).toHaveText('1');
        assert.deepEqual(nativeDialogs, [], 'no browser-blocking JavaScript dialog');
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    });
}
