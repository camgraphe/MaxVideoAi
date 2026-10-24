import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import tailwindConfig from '../frontend/tailwind.config';

test('Relight opens at its heading; File/blob frames and denied-CORS playback retain their distinct contracts', async () => {
  const frontend = resolve('frontend');
  const directory = await mkdtemp(join(tmpdir(), 'excerpt-source-browser-'));
  const file = join(directory, 'source.mov');
  await promisify(execFile)(ffmpeg.path, ['-v','error','-f','lavfi','-i','testsrc=size=90x160:rate=25:duration=5.56',
    '-pix_fmt','yuv420p','-c:v','libx264','-threads','1','-movflags','+faststart','-y',file], { timeout: 30000 });
  const bytes = await readFile(file);
  const bundle = await build({ stdin: { contents: `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {VideoExcerptSelector} from './components/media/VideoExcerptSelector.client';
    function App(){const [source,setSource]=useState(null);return <>
      <input aria-label="Local video" type="file" onChange={event=>setSource(URL.createObjectURL(event.target.files[0]))}/>
      <button onClick={()=>setSource(window.remoteSource)}>Open library original</button>
      {source?<VideoExcerptSelector operation="h3-relight" previewUrl={source} durationSec={5.56}
        limits={{sourceFieldId:'video_url',minDurationSec:56/24,maxDurationSec:15,maxSizeMB:100,durationPolicy:'source_video'}}
        locale="en" onCancel={()=>{if(source.startsWith('blob:'))URL.revokeObjectURL(source);setSource(null);}}
        onApply={async()=>{throw new Error('No preparation in this reader fixture');}}/>:null}</>}
    createRoot(document.getElementById('root')).render(<App/>);
  `, loader: 'tsx', resolveDir: frontend }, bundle: true, platform: 'browser', format: 'iife', write: false,
    define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic', tsconfig: join(frontend, 'tsconfig.json') });
  const requireFrontend = createRequire(join(frontend, 'package.json'));
  const styles = await Promise.all(['app/globals.css','src/styles/tokens.css','src/styles/app-experience.css']
    .map(path => readFile(join(frontend, path), 'utf8')));
  const css = await requireFrontend('postcss')([requireFrontend('tailwindcss')({ ...tailwindConfig,
    content: tailwindConfig.content.map(pattern => join(frontend, pattern)) })])
    .process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
  let mediaRequests = 0, corsRequests = 0;
  // A separate loopback origin deliberately omits ACAO, like an unsupported library origin.
  const media = createServer((request, response) => {
    mediaRequests++;
    if (request.headers.origin) corsRequests++;
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    response.setHeader('Content-Type', 'video/quicktime');response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', end - start + 1);
    if (match) response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` });
    response.end(bytes.subarray(start, end + 1));
  });
  await new Promise<void>(resolve => media.listen(0, '127.0.0.1', resolve));
  const mediaAddress = media.address();assert.ok(mediaAddress && typeof mediaAddress !== 'string');
  const remoteSource = `http://127.0.0.1:${mediaAddress.port}/source.mov`;
  const app = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/app.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/app.js' ? bundle.outputFiles[0].text :
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css.css +
      '</style><div id="root"></div><script>window.remoteSource=' + JSON.stringify(remoteSource) + '</script><script src="/app.js"></script>');
  });
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  const address = app.address();assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[390,844],[390,667],[320,568],[1440,1000]]) {
      for (const source of ['blob','cors-denied']) {
        await page.setViewportSize({ width, height });
        await page.goto(`http://127.0.0.1:${address.port}`);
        mediaRequests = 0;corsRequests = 0;
        const opener = page.getByRole('button', { name: 'Open library original', exact: true });
        if (source === 'blob') await page.getByLabel('Local video').setInputFiles(file);
        else await opener.click();
        const dialog = page.getByRole('dialog');
        await page.waitForFunction(() => document.querySelector('[role=dialog]')?.contains(document.activeElement));
        // Before any scrollIntoView, field editing or pointer action: this is the hosted regression.
        const initial = await dialog.evaluate(element => {
          const heading = element.querySelector('h2')!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return { scrollTop: element.scrollTop, top: bounds.top, bottom: bounds.bottom,
            headingTop: heading.top, headingBottom: heading.bottom, viewport: innerHeight };
        });
        assert.equal(initial.scrollTop, 0, `${source}/${width}x${height}: initial focus must not scroll to footer`);
        assert.ok(initial.headingTop >= initial.top && initial.headingBottom <= Math.min(initial.bottom, initial.viewport));
        await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
        await expect(dialog.getByTestId('video-compatible-copy-disclosure')).toContainText('24 fps copy:');
        assert.equal(mediaRequests, 0, 'opening does not fetch source or filmstrip bytes');
        await page.keyboard.press('Shift+Tab');
        await expect(dialog.getByRole('button', { name: 'Use excerpt', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
        const denied = source === 'cors-denied'
          ? page.waitForEvent('requestfailed', request => request.url() === remoteSource && request.failure()?.errorText === 'net::ERR_FAILED') : null;
        await dialog.locator('.video-excerpt-play').click();
        await page.waitForFunction(() => {
          const video = document.querySelector<HTMLVideoElement>('.video-excerpt-stage video');
          return video && video.readyState >= 2 && video.currentTime > 0 && !video.error;
        });
        if (source === 'blob') {
          await page.waitForFunction(() => document.querySelectorAll('.video-excerpt-frames img').length === 10);
          const frames = await dialog.locator('.video-excerpt-frames img').evaluateAll(nodes => nodes.map(node => ({
            src: (node as HTMLImageElement).src, width: (node as HTMLImageElement).naturalWidth, height: (node as HTMLImageElement).naturalHeight,
          })));
          assert.ok(new Set(frames.map(frame => frame.src)).size > 1, 'actual File/blob yields distinct decoded frames');
          assert.ok(frames.every(frame => frame.width > 0 && frame.height > 0 && frame.width <= 160 && frame.height <= 160));
          assert.equal(mediaRequests, 0, 'File/blob capture never requests network media');
        } else {
          await denied;
          assert.ok(corsRequests > 0, 'failure is the explicit anonymous decoder request');
          assert.equal(await dialog.locator('.video-excerpt-frames img').count(), 0, 'denied CORS is not frame readiness');
          assert.equal(await dialog.getByRole('alert').count(), 0, 'optional capture failure is not a preparation error');
        }
        assert.equal(await dialog.locator('video').getAttribute('crossorigin'), null);
        const captures = corsRequests;
        await dialog.locator('.video-excerpt-play').click(); // pause
        const start = dialog.getByRole('spinbutton', { name: 'Start (seconds)', exact: true });
        const end = dialog.getByRole('spinbutton', { name: 'End (seconds)', exact: true });
        await dialog.locator('.video-excerpt-handle-start').focus();await page.keyboard.press('ArrowRight');
        await dialog.locator('.video-excerpt-handle-end').focus();await page.keyboard.press('ArrowLeft');
        assert.ok(Number(await start.inputValue()) > 0 && Number(await end.inputValue()) < 5.56);
        const before = Number(await start.inputValue());
        const handle = dialog.locator('.video-excerpt-handle-start');await handle.scrollIntoViewIfNeeded();
        const grip = await handle.boundingBox();assert.ok(grip);
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);await page.mouse.down();
        await page.mouse.move(grip.x + grip.width / 2 + 20, grip.y + grip.height / 2, { steps: 4 });await page.mouse.up();
        assert.ok(Number(await start.inputValue()) > before);
        await dialog.getByRole('button', { name: 'Whole video', exact: true }).click();
        assert.equal(await start.inputValue(), '0');assert.equal(await end.inputValue(), '5.56');
        await dialog.locator('.video-excerpt-play').click();
        await expect(dialog.locator('.video-excerpt-play')).toHaveAttribute('aria-label', 'Pause');
        assert.equal(corsRequests, captures, 'failed capture is not retried by trimming or Play');
        if (source === 'blob') assert.equal(mediaRequests, 0);
        await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
        if (source === 'cors-denied') await expect(opener).toBeFocused();
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    for (const server of [app, media]) { server.closeAllConnections();await new Promise<void>(resolve => server.close(() => resolve())); }
    await rm(directory, { recursive: true, force: true });
  }
});
