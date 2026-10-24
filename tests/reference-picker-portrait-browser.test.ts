import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const poster = (width: number, height: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#b9cfdf"/><rect width="100%" height="20%" fill="#c85849"/><rect y="80%" width="100%" height="20%" fill="#49774a"/><text x="50%" y="12%" text-anchor="middle" font-size="22">TOP</text><text x="50%" y="94%" text-anchor="middle" font-size="22">BOTTOM</text></svg>`)}`;
const assets = [[90, 160], [160, 90], [120, 120], [90, 160], [90, 160]].map(([width, height], index) => ({
  id: `media-${index}`, kind: index === 4 ? 'image' : 'video', url: `/original-${index}.mp4`,
  thumbUrl: poster(width * 3, height * 3),
  width: index === 3 ? undefined : width, height: index === 3 ? undefined : height,
}));
const source = `
  import { createRoot } from 'react-dom/client';
  import { ReferenceLibraryPicker } from './components/library/ReferenceLibraryPicker.client';
  import { AudioGeneratedVideoPickerModal } from './app/(core)/(workspace)/app/audio/_components/audio-generated-video-picker';
  const config = globalThis.fixtureConfig;
  const select = asset => { globalThis.selectedOriginal = asset.url; };
  createRoot(document.getElementById('root')).render(config.reader === 'audio'
    ? <AudioGeneratedVideoPickerModal open videos={config.assets.slice(0,4).map(a=>({...a,jobId:a.id,label:a.id,createdAt:'2026-01-01T00:00:00Z'}))}
        isLoading={false} error={null} locale="en" onClose={()=>{}} onSelect={select}
        copy={{picker:{title:'Choose video',close:'Close',search:'Search',empty:'No videos',error:'Could not select'},source:{durationPending:'Duration pending'}}}/>
    : <div className="app-experience app-library-picker-layer"><ReferenceLibraryPicker
        title="Select reference video" assets={config.assets} assetType="video" source="all" availableSources={['all']}
        sourceLabels={{all:'All'}} onSourceChange={()=>{}} onClose={()=>{}} isLoading={false}
        searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="No videos" emptySearchLabel="No match"
        renderAssetActions={()=>null} renderAssetMeta={()=><span>Choose a section up to 15 s after adding.</span>}
        selection={{scope:'portrait-test',onConfirm:select}}/></div>);
`;

test('portrait video posters stay centered and uncropped in both reference selectors on Chromium and WebKit', async () => {
  const fixture = await startWorkspaceReferenceFixture({ source });
  const evidence = process.env.REFERENCE_PICKER_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    for (const browserName of ['chromium', 'webkit']) {
      const browser = browserName === 'webkit' ? await webkit.launch() : await chromium.launch();
      try {
        for (const width of [390, 1440]) for (const reader of ['reference', 'audio']) {
          const page = await browser.newPage({ viewport: { width, height: 1000 } });
          const errors: string[] = [], originals: string[] = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => { if (/original-\d+\.mp4/.test(request.url())) originals.push(request.url()); });
          await page.goto(fixture.url);
          await page.evaluate(config => { (globalThis as any).fixtureConfig = config; }, { reader, assets });
          await page.addScriptTag({ url: `${fixture.url}/${fixture.script}` });
          await page.locator('.app-picker-card').first().waitFor();
          await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.app-picker-cover img')].every(image => image.complete && image.naturalWidth > 0));
          const covers = page.locator('.app-picker-cover');
          for (let index = 0; index < await covers.count(); index++) {
            const cover = covers.nth(index), image = cover.locator('img');
            const box = await cover.boundingBox(), imageBox = await image.boundingBox();
            assert.ok(box && imageBox);
            assert.ok(Math.abs(box.width / box.height - 4 / 3) < .02, 'stable card geometry');
            assert.ok(Math.abs(imageBox.y - box.y) < 1 && Math.abs(imageBox.x - box.x) < 1, `${browserName}/${reader}: poster cannot shift below the cover`);
            assert.ok(Math.abs(imageBox.height - box.height) < 1 && Math.abs(imageBox.width - box.width) < 1, 'image layout is bounded by its cover');
            assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit), index === 4 ? 'cover' : 'contain', 'full video framing; ordinary image behavior retained');
          }
          await page.locator('.app-picker-card').first().click();
          if (reader === 'reference') await page.getByRole('button', { name: 'Use selection', exact: true }).click();
          assert.equal(await page.evaluate(() => (globalThis as any).selectedOriginal), assets[0].url, 'selection keeps the canonical original');
          assert.deepEqual(originals, [], 'opening a picker never downloads original video bytes');
          assert.deepEqual(errors, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          if (evidence) await page.screenshot({ path: join(evidence, `${browserName}-${reader}-${width}.png`) });
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await fixture.close(); }
});
