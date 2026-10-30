import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('Audio auditions survive Strict Mode, load only on Play and stop when the voice changes', { timeout: 60_000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'eleven-audio-browser-'));
  const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{AudioCreationEditor}from'./frontend/app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';
    import{audioCreationCopy}from'./frontend/app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
    import{newAudioDraft,buildAudioCreationRequest}from'./frontend/src/lib/audio-creation';
    function Fixture(){const[draft,set]=useState({...newAudioDraft('voice'),script:'Hello.'});return <main><AudioCreationEditor intent="voice" draft={draft} copy={audioCreationCopy(new URLSearchParams(location.search).get('locale')??'en')} onChange={patch=>set(old=>({...old,...patch}))} onFile={()=>{}} uploading={false} onLibrary={()=>{}}/><pre id="request">{JSON.stringify(buildAudioCreationRequest('voice',draft,'en'))}</pre></main>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);`;
  await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, outfile: join(folder, 'editor.js'),
    bundle: true, platform: 'browser', jsx: 'automatic', nodePaths: [join(process.cwd(), 'frontend/node_modules')], external: ['/assets/*'], tsconfig: 'frontend/tsconfig.json', define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' } });
  const wav = Buffer.alloc(44 + 16000 * 2 * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  const previews: string[] = [];
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith('/api/audio/voices/')) { previews.push(request.url); response.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length }); response.end(wav); return; }
    if (request.url === '/editor.js' || request.url === '/editor.css') {
      response.setHeader('Content-Type', request.url.endsWith('css') ? 'text/css' : 'application/javascript');
      response.end(await readFile(join(folder, request.url.slice(1)))); return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"><style>:root{--audio-ink:#17282a;--audio-paper:white;--text-secondary:#566;--hairline:#ccd;--audio-accent:#176}body{font:16px Arial;margin:16px}main{max-width:900px;margin:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><div id="root"></div><script src="/editor.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByLabel('Model', { exact: true }).waitFor().catch(error => { throw new Error(`${error.message}; browser errors: ${errors.join('; ')}`); });
    assert.equal(await page.getByLabel('Model', { exact: true }).inputValue(), 'eleven-v4');
    assert.equal(await page.getByLabel('Voice', { exact: true }).locator('option').count(), 18);
    const audio = page.locator('audio');
    assert.equal(await audio.getAttribute('preload'), 'none');
    assert.equal(await audio.getAttribute('src'), '/api/audio/voices/nPczCjzI2devNBz1zQrb/preview');
    assert.equal(previews.length, 0, 'rendering the editor cannot fetch an audition');
    await page.locator('summary').click();
    assert.equal(await page.getByLabel('Stability', { exact: true }).count(), 1);
    assert.equal(await page.getByLabel('Speed', { exact: true }).count(), 0);
    await audio.evaluate(element => { (window as any).previousAudio = element; });
    await audio.click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() => !(document.querySelector('audio') as HTMLAudioElement).paused);
    assert.equal(previews.length, 1);
    await page.getByLabel('Voice', { exact: true }).selectOption('CwhRBWXzGAHq8TQ4Fs17');
    assert.equal(await page.evaluate(() => (window as any).previousAudio.paused), true);
    assert.equal(await audio.getAttribute('src'), '/api/audio/voices/CwhRBWXzGAHq8TQ4Fs17/preview');
    assert.equal(previews.length, 1, 'selecting another voice waits for Play');
    const request = JSON.parse(await page.locator('#request').innerText());
    assert.equal(request.elevenVoiceId, 'CwhRBWXzGAHq8TQ4Fs17');
    assert.equal(request.seedAudioSpeed, undefined);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/maxvideoai-eleven-v4-mobile.png', fullPage: true });
    await page.getByLabel('Model', { exact: true }).selectOption('minimax');
    assert.equal(await page.getByLabel('Speed', { exact: true }).count(), 1);
    assert.equal(await page.locator('audio').count(), 0);
    for (const [locale, modelLabel, voiceLabel] of [['fr', 'Modèle', 'Voix'], ['es', 'Modelo', 'Voz']]) {
      await page.goto(`http://127.0.0.1:${address.port}/?locale=${locale}`);
      assert.equal(await page.getByLabel(modelLabel, { exact: true }).inputValue(), 'eleven-v4');
      assert.equal(await page.getByLabel(voiceLabel, { exact: true }).locator('option').count(), 18);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/maxvideoai-eleven-v4-${locale}-mobile.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(folder, { recursive: true, force: true }); }
});
