import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const ROOT = process.cwd();
const FRONTEND_ROOT = join(ROOT, 'frontend');

const fixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { SoraPromptingTabs } from './components/marketing/SoraPromptingTabs.client';

  const initialTabs = [
    { id: 'text', label: 'Text', title: 'Text panel', copy: 'Text copy' },
    { id: 'image', label: 'Image', title: 'Image panel', copy: 'Image copy' },
    { id: 'audio', label: 'Audio', title: 'Audio panel', copy: 'Audio copy' },
    { id: 'final', label: 'Final', title: 'Final panel', copy: 'Final copy' },
  ];

  const replacementTabs = [
    { id: 'reference', label: 'Reference', title: 'Reference panel', copy: 'Reference copy' },
    { id: 'delivery', label: 'Delivery', title: 'Delivery panel', copy: 'Delivery copy' },
  ];

  function Fixture() {
    const [tabs, setTabs] = useState(initialTabs);
    return (
      <>
        <button type="button" onClick={() => setTabs(replacementTabs)}>Replace tabs</button>
        <button type="button" onClick={() => setTabs(initialTabs)}>Restore tabs</button>
        <SoraPromptingTabs
          title="Arbitrary tab fixture"
          intro="Behavioral regression fixture"
          tip="Choose a tab"
          guideUrl={null}
          tabs={tabs}
          tabNotes={{ text: 'Text note', image: 'Image note', reference: 'Reference note' }}
        />
      </>
    );
  }

  createRoot(document.getElementById('root')).render(<Fixture />);
`;

test('non-legacy prompting tab ids show the first panel, switch, and recover after prop changes', async () => {
  const bundle = await build({
    absWorkingDir: FRONTEND_ROOT,
    bundle: true,
    define: { 'process.env.NODE_ENV': '"test"' },
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    stdin: {
      contents: fixtureSource,
      loader: 'tsx',
      resolveDir: FRONTEND_ROOT,
      sourcefile: 'sora-prompting-tabs-fixture.tsx',
    },
    tsconfig: join(FRONTEND_ROOT, 'tsconfig.json'),
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'the browser fixture should produce a bundle');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: 'globalThis.process = { env: { NODE_ENV: "test" } };' });
    await page.addScriptTag({ content: script });
    await page.waitForTimeout(100);
    assert.deepEqual(pageErrors, [], `browser fixture errors: ${pageErrors.join('; ')}`);
    await page.getByRole('tablist', { name: 'Prompt levels' }).waitFor({ timeout: 5_000 });

    const visiblePanelTitle = page.locator('[role="tabpanel"]:not([hidden]) h3');
    assert.equal(await visiblePanelTitle.count(), 1, 'the first resolved tab should expose one visible panel');
    assert.equal(await visiblePanelTitle.textContent(), 'Text panel');
    assert.equal(await page.getByRole('tab', { name: 'Text' }).getAttribute('aria-selected'), 'true');

    await page.getByRole('tab', { name: 'Image' }).click();
    assert.equal(await visiblePanelTitle.textContent(), 'Image panel');
    assert.equal(await page.getByRole('tab', { name: 'Image' }).getAttribute('aria-selected'), 'true');

    await page.getByRole('button', { name: 'Replace tabs' }).click();
    assert.equal(await visiblePanelTitle.count(), 1, 'a replacement tab set should expose one visible panel');
    assert.equal(await visiblePanelTitle.textContent(), 'Reference panel');
    assert.equal(await page.getByRole('tab', { name: 'Reference' }).getAttribute('aria-selected'), 'true');

    await page.getByRole('button', { name: 'Restore tabs' }).click();
    assert.equal(await visiblePanelTitle.textContent(), 'Text panel');
    assert.equal(await page.getByRole('tab', { name: 'Text' }).getAttribute('aria-selected'), 'true');
  } finally {
    await browser.close();
  }
});
