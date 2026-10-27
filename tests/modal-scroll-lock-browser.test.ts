import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, webkit, type Page } from '@playwright/test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

// Real modal owners and CSS; only the surrounding page/draft are synthetic.
// No context means the picker makes no pricing requests. No upload/generation controls.
const fixtureSource = `
  import { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { WorkspaceReferencePopup } from './components/composer/WorkspaceReferencePopup.client';
  import { EnginePickerDialog } from './src/components/ui/engine-select/EnginePickerDialog.client';
  const params = new URLSearchParams(location.search);
  document.documentElement.style.scrollbarGutter = params.get('gutter') ?? '';
  document.documentElement.style.marginRight = params.get('margin') ?? '';
  document.body.style.overflow = params.get('overflow') ?? '';
  const config = globalThis.fixtureConfig;
  function Fixture() {
    const [open, setOpen] = useState(null), [child, setChild] = useState(false);
    const [engineId, setEngineId] = useState('wan-3');
    const [prompt, setPrompt] = useState('Preserve this synthetic draft.');
    return <>
      <link rel="stylesheet" href="/stdin.css" />
      <header data-anchor="header" style={{position:'sticky',top:0,height:48,background:'#e5edf4',zIndex:1}}>Local modal stability verification</header>
      <aside data-anchor="sidebar" style={{position:'fixed',left:0,top:48,bottom:0,width:32,background:'#edf2f6'}} />
      <main data-anchor="main" style={{minHeight:0,width:'calc(100% - 96px)',maxWidth:960,margin:'64px auto 0'}}>
        <section data-anchor="composer" style={{position:'sticky',top:64,padding:16,background:'#fff',border:'1px solid #ccd5df'}}>
          <button id="reference-opener" onClick={()=>setOpen('reference')}>References</button>{' · '}
          <button id="model-opener" onClick={()=>setOpen('model')}>Change model</button>
          <label style={{display:'block'}}>Prompt<textarea aria-label="Prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} style={{display:'block',width:'100%'}} /></label>
          <output aria-label="Selected model">{engineId}</output>
        </section>
        {params.get('short') !== '1' ? <div style={{height:1800}} /> : null}
      </main>
      {open === 'reference' ? <WorkspaceReferencePopup title="References" closeLabel="Close references" onClose={()=>setOpen(null)}>
        <button id="child-opener" onClick={()=>setChild(true)}>Open child dialog</button>
        <button id="reference-last">Last reference action</button>
      </WorkspaceReferencePopup> : null}
      {child ? <WorkspaceReferencePopup title="Child dialog" closeLabel="Close child" onClose={()=>setChild(false)}>
        <button>Child action</button>
      </WorkspaceReferencePopup> : null}
      {open === 'model' ? <EnginePickerDialog engines={config.engines} engineId={engineId} mode="t2v" locale="en" registryMeta={null}
        onSelect={setEngineId} onClose={()=>setOpen(null)} /> : null}
    </>;
  }
  createRoot(document.getElementById('root')).render(<Fixture />);
`;

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (node: Element) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      viewport: innerWidth, clientWidth: document.documentElement.clientWidth,
      root: rect(document.documentElement), body: rect(document.body),
      anchors: Array.from(document.querySelectorAll('[data-anchor]')).map(rect),
      scroll: [scrollX, scrollY], overflow: document.body.style.overflow,
      gutter: document.documentElement.style.scrollbarGutter,
      marginRight: document.documentElement.style.marginRight,
      computedGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    };
  });
}

function assertStable(before: Awaited<ReturnType<typeof geometry>>, after: Awaited<ReturnType<typeof geometry>>) {
  assert.deepEqual(after.root, before.root, 'root rectangle stays fixed while the scrollbar is hidden');
  assert.deepEqual(after.body, before.body, 'body rectangle stays fixed');
  assert.deepEqual(after.anchors, before.anchors, 'sticky app header, sidebar and centered composer stay fixed');
  assert.deepEqual(after.scroll, before.scroll, 'opening and closing preserve document scroll');
}

for (const name of ['chromium', 'webkit'] as const) {
  test(`${name}: real reference and model modals preserve page geometry, scroll and draft`, { timeout: 120_000 }, async () => {
    const fixture = await startWorkspaceReferenceFixture({ source: fixtureSource, config: {
      engines: getBaseEnginesByCategory('video').filter(engine => ['wan-3', 'wan-3-prime'].includes(engine.id)),
    } });
    const browser = await (name === 'chromium' ? chromium.launch() : webkit.launch());
    const evidence: unknown[] = [];
    if (process.env.MODAL_GEOMETRY_EVIDENCE_DIR) await mkdir(process.env.MODAL_GEOMETRY_EVIDENCE_DIR, { recursive: true });
    try {
      for (const width of [1440, 390]) for (const variant of ['overflowing', 'short', 'existing-gutter']) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: 'light' });
        const external: string[] = [];
        await page.route('**/*', route => {
          if (new URL(route.request().url()).origin === fixture.url) return route.continue();
          external.push(route.request().url()); return route.abort();
        });
        try {
          const query = variant === 'short' ? '?short=1' : variant === 'existing-gutter' ? '?gutter=stable%20both-edges&overflow=auto&margin=8px' : '';
          await page.goto(fixture.url + query);
          await page.locator('#reference-opener').waitFor();
          await page.getByLabel('Prompt', { exact: true }).fill('Edited synthetic draft — keep it.');
          if (variant !== 'short') await page.evaluate(() => window.scrollTo(0, 80));
          const before = await geometry(page);
          evidence.push({ name, width, variant, before });
          assert.equal(before.root.height > 900, variant !== 'short', 'fixture actually covers both scroll conditions');
          await page.locator('#reference-opener').focus();
          await page.keyboard.press('Enter');
          await page.getByRole('button', { name: 'Close references', exact: true }).waitFor();
          await page.waitForFunction(() => document.activeElement?.textContent === 'Close references');
          const reference = await geometry(page);
          evidence.push({ name, width, variant, before, reference });
          if (process.env.MODAL_GEOMETRY_EVIDENCE_DIR) {
            await page.screenshot({ path: join(process.env.MODAL_GEOMETRY_EVIDENCE_DIR, `${name}-${width}-${variant}-reference.png`) });
          }
          assert.equal(reference.overflow, 'hidden');
          assertStable(before, reference);
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.locator('#reference-last').evaluate(node => node === document.activeElement), true);
          await page.keyboard.press('Tab');
          assert.equal(await page.getByRole('button', { name: 'Close references', exact: true }).evaluate(node => node === document.activeElement), true);
          await page.locator('#child-opener').focus();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => document.activeElement?.textContent === 'Close child');
          assertStable(before, await geometry(page));
          await page.keyboard.press('Escape');
          await page.getByRole('dialog', { name: 'Child dialog', exact: true }).waitFor({ state: 'detached' });
          assert.equal((await geometry(page)).overflow, 'hidden', 'child cleanup keeps parent locked');
          assert.equal(await page.locator('#child-opener').evaluate(node => node === document.activeElement), true);
          assertStable(before, await geometry(page));
          await page.keyboard.press('Escape');
          await page.getByRole('dialog').waitFor({ state: 'detached' });
          assertStable(before, await geometry(page));
          assert.equal(await page.locator('#reference-opener').evaluate(node => node === document.activeElement), true);
          await page.locator('#model-opener').focus();
          await page.keyboard.press('Enter');
          await page.getByRole('dialog').waitFor();
          await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
          const picker = await geometry(page);
          evidence.push({ name, width, variant, picker });
          assertStable(before, picker);
          await page.getByRole('button', { name: 'Choose Wan 3 Prime', exact: true }).click();
          await page.getByRole('dialog').waitFor({ state: 'detached' });
          assert.equal(await page.getByLabel('Selected model', { exact: true }).textContent(), 'wan-3-prime');
          const after = await geometry(page);
          assertStable(before, after);
          assert.equal(after.gutter, before.gutter, 'restore original inline gutter, including both-edges');
          assert.equal(after.marginRight, before.marginRight, 'restore original root margin');
          assert.equal(after.overflow, before.overflow, 'restore original inline overflow');
          assert.equal(await page.locator('#model-opener').evaluate(node => node === document.activeElement), true);
          assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), 'Edited synthetic draft — keep it.');
          assert.deepEqual(external, [], 'no external, pricing or generation requests');
        } finally { await page.close(); }
      }
    } finally {
      await browser.close(); await fixture.close();
      if (process.env.MODAL_GEOMETRY_EVIDENCE_DIR) await writeFile(join(process.env.MODAL_GEOMETRY_EVIDENCE_DIR, `${name}-geometry.json`), JSON.stringify(evidence, null, 2));
    }
  });
}
