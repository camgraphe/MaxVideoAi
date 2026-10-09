import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { ExampleReaderStyles } from '../frontend/components/examples/example-reader-styles';
import type { ExampleWatchDetail } from '../frontend/lib/example-watch-detail';

test('reader keeps the same dialog frame while delayed content replaces loading or an error', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 900, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}</style>${renderToStaticMarkup(React.createElement(ExampleReaderStyles))}<div class="video-reader-backdrop"><section class="video-reader-dialog"><div class="video-reader-loading">Loading</div></section></div>`);
      const dialog = page.locator('.video-reader-dialog');
      const loading = await dialog.boundingBox();
      assert.ok(loading);
      const status = await page.locator('.video-reader-loading').boundingBox();
      assert.ok(status);
      assert.ok(Math.abs(status.y + status.height / 2 - loading.y - loading.height / 2) <= 8, 'loading and retry content stay centered inside the stable frame');
      for (const height of [1000, 100, 1600]) {
        await dialog.evaluate((element, contentHeight) => { element.innerHTML = `<div style="height:${contentHeight}px">Video details</div>`; }, height);
        const ready = await dialog.boundingBox();
        assert.ok(ready);
        assert.ok(Math.abs(ready.y - loading.y) <= 1, `at ${viewport.width}px the dialog moved from ${loading.y}px to ${ready.y}px`);
        assert.ok(Math.abs(ready.height - loading.height) <= 1, 'the scrollable frame must survive different video lengths and retry states');
        assert.equal(await dialog.evaluate(element => element.scrollHeight > element.clientHeight), height > ready.height, 'long content remains scrollable inside the frame');
      }
      await dialog.evaluate(element => { element.classList.add('video-reader-standalone'); element.innerHTML = '<div style="height:1200px">Watch page</div>'; });
      assert.ok((await dialog.boundingBox())!.height > viewport.height, 'the standalone watch page keeps normal document scrolling');
      await page.close();
    }
  } finally { await browser.close(); }
});

// Bundle the real reader and its controls, as the existing component browser
// fixtures do. Only the API and media bytes are supplied by a local HTTP server.
async function createPlaybackFixture() {
  const frontend = join(process.cwd(), 'frontend');
  const bundle = await build({ stdin: { contents: `
    import {useEffect,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import ExampleReader from './components/examples/ExampleReader.client';
    import {ExampleReaderContent} from './components/examples/ExampleReaderContent';
    import {ExampleReaderStyles} from './components/examples/example-reader-styles';
    import {readerCopy} from './components/examples/example-reader-copy';
    function Fixture() {
      const [open,setOpen]=useState(false);
      const standalone=location.pathname==='/watch';
      useEffect(()=>{window.fixtureReady=true},[]);
      return <><button id="opener" onClick={()=>setOpen(true)}>Open video</button>
        {standalone ? <section className="video-reader-dialog video-reader-standalone"><ExampleReaderStyles/>
          <ExampleReaderContent detail={window.fixtureDetail} copy={readerCopy('en')} locale="en" headingLevel="h1"/></section>
        : open && <ExampleReader id="one" locale="en" onClose={()=>setOpen(false)} navigationError={false}
          navigation={{previous(){},next(){},canPrevious:false,canNext:false,busy:false}}/>}</>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `, loader: 'tsx', resolveDir: frontend }, write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', minify: true,
    tsconfig: join(frontend, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' } });
  const video = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const shareIcons = new Map(await Promise.all(['x', 'whatsapp', 'telegram', 'facebook'].map(async target => [
    `/brand/share/${target}.svg`, await readFile(join(frontend, 'public', 'brand', 'share', `${target}.svg`)),
  ] as const)));
  const detail: ExampleWatchDetail = {
    id: 'one', title: 'Local reader playback fixture', prompt: 'A local patterned video.', videoUrl: '/fixture.mp4', posterUrl: null,
    engineLabel: 'Example', watchHref: '/video/one', modelHref: null, recreateHref: null, aspectRatio: '16:9', durationSec: 6,
    hasAudio: false, historicalCost: null, scenario: null, quotes: [], references: [],
    context: { intro: 'Reader playback fixture', visualContext: null, negativePrompt: null, createdAt: '', details: [], controls: [],
      highlights: [], notes: [], engineDescription: '', engineBadges: [], compareLinks: [], keyframes: null },
  };
  const server = createServer((request, response) => {
    if (request.url === '/fixture.js') { response.writeHead(200, { 'content-type': 'application/javascript' }); response.end(bundle.outputFiles[0].text); }
    else if (request.url === '/api/examples/one') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ detail })); }
    else if (request.url === '/fixture.mp4') {
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
      response.writeHead(range ? 206 : 200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': end - start + 1,
        ...(range ? { 'content-range': `bytes ${start}-${end}/${video.length}` } : {}) }); response.end(video.subarray(start, end + 1));
    } else if (shareIcons.has(request.url ?? '')) {
      response.writeHead(200, { 'content-type': 'image/svg+xml' }); response.end(shareIcons.get(request.url!));
    } else { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(`<!doctype html><html><head><title>Reader playback fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.fixtureDetail=${JSON.stringify(detail)}</script><script src="/fixture.js"></script></body></html>`); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, async close() {
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

test('real reader Play keeps focus, Escape restoration and media geometry for pointer and keyboard', { timeout: 60_000 }, async t => {
  const fixture = await createPlaybackFixture();
  const browser = await chromium.launch({ headless: true });
  const evidenceDirectory = process.env.READER_PLAY_FOCUS_EVIDENCE_DIR;
  const evidence: unknown[] = [];
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
      for (const activation of ['pointer', 'Enter', 'Space', 'denied'] as const) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
        await page.goto(fixture.url);
        assert.equal(await page.title(), 'Reader playback fixture');
        await page.waitForFunction(() => (window as any).fixtureReady);
        if (activation === 'denied') await page.evaluate(() => {
          const play = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            HTMLMediaElement.prototype.play = play;
            return Promise.reject(new DOMException('Fixture playback denied', 'NotAllowedError'));
          };
        });
        const opener = page.getByRole('button', { name: 'Open video', exact: true });
        await opener.click();
        const dialog = page.getByRole('dialog'), center = page.locator('.video-reader-centerPlay');
        await center.waitFor();
        const geometry = () => page.evaluate(() => {
          const boxes = Object.fromEntries(['dialog', 'player', 'frame', 'controls'].map(part => {
            const box = document.querySelector(`.video-reader-${part}`)!.getBoundingClientRect();
            return [part, { x: box.x, y: box.y, width: box.width, height: box.height }];
          }));
          return { boxes, dialogScroll: document.querySelector('.video-reader-dialog')!.scrollTop, pageScroll: window.scrollY };
        });
        const before = await geometry();
        const video = dialog.locator('video');
        assert.equal(await video.getAttribute('preload'), 'none');
        assert.equal(await video.evaluate(node => node.paused), true);
        if (activation === 'pointer' || activation === 'denied') await center.click();
        else await center.press(activation === 'Space' ? ' ' : activation);
        const toolbar = page.locator('.video-reader-controlRow button').first();
        if (activation === 'denied') {
          await page.waitForFunction(() => document.querySelector('.video-reader-controlRow button')?.getAttribute('aria-label') === 'Play video');
          assert.equal(await center.count(), 1, 'denied startup retains the central retry control');
        } else await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0);
        const focused = await toolbar.evaluate(node => document.activeElement === node);
        const after = await geometry();
        const record = { viewport, activation, before, after, focused, active: await page.evaluate(() => ({
          tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label'),
          inDialog: Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
        })), media: await video.evaluate(node => ({ paused: node.paused, currentTime: node.currentTime, readyState: node.readyState, error: node.error?.code ?? null })),
          escapeClosed: false, openerRestored: false, errors };
        evidence.push(record);
        if (evidenceDirectory) {
          await mkdir(evidenceDirectory, { recursive: true });
          await page.screenshot({ path: join(evidenceDirectory, `${viewport.width}-${activation}.png`) });
        }
        assert.deepEqual(after, before, 'Play focus transfer must not move the dialog, media or scroll position');
        if (activation === 'denied') {
          assert.equal(focused, true, 'rejected startup retains the persistent playback control focus');
          await toolbar.press('Enter');
          await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0);
          assert.equal(await toolbar.evaluate(node => document.activeElement === node), true, 'the focused control retries real native playback');
          assert.deepEqual(await geometry(), before);
        }
        assert.equal(await center.count(), 0, 'central Play disappears after first playback');
        assert.equal(await toolbar.getAttribute('aria-label'), 'Pause');
        await page.keyboard.press('Escape');
        record.escapeClosed = await dialog.count() === 0;
        record.openerRestored = await opener.evaluate(node => document.activeElement === node);
        assert.equal(focused, true, `${viewport.width}px ${activation}: persistent playback control retains focus`);
        assert.equal(record.escapeClosed, true, 'Escape closes the actual reader after playback');
        assert.equal(record.openerRestored, true, 'Escape restores the real opener');
        assert.deepEqual(errors, [], 'the actual reader has no runtime or console errors');
        await page.close();
      }
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${fixture.url}/watch`); await page.locator('h1').waitFor();
    await page.locator('.video-reader-centerPlay').press('Enter');
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0);
    assert.equal(await page.locator('.video-reader-controlRow button').first().evaluate(node => document.activeElement === node), true);
    assert.equal(await page.getByRole('dialog').count(), 0, 'the standalone watch reader keeps its normal presentation');
    await page.close();
    t.diagnostic(JSON.stringify({ browser: browser.version(), scenarios: evidence.length, standaloneWatch: true, fixture: fixture.url }));
  } finally {
    if (evidenceDirectory) { await mkdir(evidenceDirectory, { recursive: true }); await writeFile(join(evidenceDirectory, 'reader-play-focus.json'), JSON.stringify(evidence, null, 2)); }
    await browser.close(); await fixture.close();
  }
});
