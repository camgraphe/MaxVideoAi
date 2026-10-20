import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));

function wav(seconds: number) {
  const buffer = Buffer.alloc(44 + seconds * 8000 * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
  return buffer;
}

test('saving audio measures its bytes and makes a valid saved WAV selectable without client duration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-library-duration-'));
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/audio' });
  const fixture = { assets: [] as any[], inserts: [] as any[], source: wav(7), uploaded: null as Buffer | null,
    ensure: null as any,
    query: async (sql: string, values: any[]) => {
      if (sql.includes('SELECT')) return [];
      assert.ok(sql.includes('INSERT INTO media_assets'), 'only the explicit save may write');
      const row = { id: values[0], user_id: values[1], kind: values[2], url: values[3], thumb_url: values[4],
        preview_url: values[5], mime_type: values[6], width: values[7], height: values[8], size_bytes: values[9],
        source: values[10], source_job_id: values[11], source_output_id: values[12], status: values[13],
        metadata: JSON.parse(values[14]), created_at: '2026-10-19T00:00:00Z' };
      fixture.inserts.push(row); return [row];
    },
  };
  const mocks: Record<string, string> = {
    '@/lib/db': `export const query=(...args)=>globalThis.audioLibraryFixture.query(...args);`,
    '@/lib/schema': `export const ensureMediaLibrarySchema=async()=>{};`,
    '@/server/storage': `export const recordUserAsset=async()=>{}; export const uploadFileBuffer=async({data})=>{globalThis.audioLibraryFixture.uploaded=data;return {url:'https://fixture.example/saved.wav'}}; export const uploadImageToStorage=async()=>{throw Error('Unexpected image')};`,
    '@/server/owned-media-read-access': `export const createOwnedMediaReadUrl=async({url})=>url;`,
    '@/server/upload-thumbnails': `export const createUploadVideoThumbnail=async()=>{throw Error('Unexpected video')};`,
    '@/server/media/generated-video-facts': `export const measureGeneratedVideoBuffer=async()=>{throw Error('Unexpected video')};`,
    './generated-video-source': `export const resolveOwnedGeneratedVideo=async()=>{throw Error('Unexpected video')};`,
    './asset-listing': `export const findLibraryAssetByOrigin=async()=>null;export const listLibraryAssetPage=async()=>({items:[]});`,
    './asset-resolvers': `export const resolveReusableAssetPreviewUrl=async()=>null;export const resolveReusableAssetThumbUrl=async()=>null;`,
    '@/lib/authFetch': `export const authFetch=async(url,init)=>{const fixture=globalThis.audioLibraryFixture;if(!init?.body)return new Response(JSON.stringify({ok:true,assets:fixture.assets}));const body=JSON.parse(init.body);const asset=await fixture.ensure({...body,userId:'owner-a',sourceJobId:body.jobId});return new Response(JSON.stringify({ok:true,asset}));};`,
  };
  const output = join(directory, 'library.cjs');
  const compiled = await build({ stdin: { contents: `export {ensureReusableAsset} from './frontend/server/media-library/assets'; export {saveAssetToLibrary} from './frontend/lib/api-assets'; export {default as Library} from './frontend/app/(core)/(workspace)/app/audio/_components/AudioReferenceLibrary'; export {audioCreationCopy as copy} from './frontend/app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';`, resolveDir: process.cwd(), loader: 'tsx' },
    outfile: output, write: false, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
    tsconfig: 'frontend/tsconfig.json', packages: 'external', loader: { '.css': 'empty', '.module.css': 'empty' },
    plugins: [{ name: 'audio-library-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path in mocks) return { path: args.path, namespace: 'fixture' };
        if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  await writeFile(output, compiled.outputFiles[0].contents);
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true, audioLibraryFixture: fixture,
    fetch: async () => new Response(fixture.source, { headers: { 'content-type': 'audio/wav' } }),
  };
  const savedGlobals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { ensureReusableAsset, saveAssetToLibrary, Library, copy } = require(output);
    fixture.ensure = ensureReusableAsset;
    const asset = await saveAssetToLibrary({ url: 'https://fixture.example/original.wav', kind: 'audio', source: 'generated', jobId: 'audio-1' });
    assert.equal(asset.durationSec, 7, 'the existing client sends no duration; the server must measure the original bytes');
    assert.equal(asset.mimeType, 'audio/wav'); assert.equal(asset.sizeBytes, 112044);
    assert.deepEqual(fixture.uploaded, wav(7), 'saving must preserve original bytes');
    assert.equal(asset.metadata.originUrl, 'https://fixture.example/original.wav');
    assert.deepEqual(asset.metadata.mediaFacts, { source: 'probe', durationSec: 7 });
    fixture.assets = [{ id: asset.id, url: asset.url, kind: 'audio', mime: asset.mimeType, size: asset.sizeBytes, durationSec: asset.durationSec }];
    let selected: any;
    await act(async () => root.render(React.createElement(Library, { copy: copy('en'), onClose() {}, onSelect(value: any) { selected = value; } })));
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Select');
    assert.ok(button); assert.equal(button.disabled, false);
    await act(async () => button.click());
    assert.equal(selected.url, asset.url);

    const falseClaim = await ensureReusableAsset({ userId: 'owner-a', url: 'https://fixture.example/claim.wav', kind: 'audio', source: 'generated', durationSec: 1, metadata: { durationSec: 1, mediaFacts: { source: 'probe', durationSec: 1 } } });
    assert.equal(falseClaim.durationSec, 7, 'client claims cannot override byte measurements');

    fixture.source = wav(31);
    const long = await saveAssetToLibrary({ url: 'https://fixture.example/long.wav', kind: 'audio', source: 'generated', durationSec: 1 });
    assert.equal(long.durationSec, 31);
    fixture.assets = [{ id: long.id, url: long.url, kind: 'audio', mime: long.mimeType, size: long.sizeBytes, durationSec: long.durationSec }];
    await act(async () => root.render(React.createElement(Library, { key: 'long', copy: copy('en'), onClose() {}, onSelect() { throw Error('incompatible audio selected'); } })));
    assert.equal([...document.querySelectorAll('button')].find(button => button.textContent === 'Select')?.disabled, true);
    for (const [name, fields] of Object.entries({
      unsupported: { mime: 'audio/ogg' }, oversized: { size: 10 * 1024 * 1024 + 1 },
      unknown: { durationSec: null }, nonfinite: { durationSec: Number.POSITIVE_INFINITY },
    })) {
      fixture.assets = [{ id: asset.id, url: asset.url, kind: 'audio', mime: asset.mimeType, size: asset.sizeBytes, durationSec: asset.durationSec, ...fields }];
      await act(async () => root.render(React.createElement(Library, { key: name, copy: copy('en'), onClose() {}, onSelect() { throw Error('incompatible audio selected'); } })));
      assert.equal([...document.querySelectorAll('button')].find(button => button.textContent === 'Select')?.disabled, true, name);
    }

    fixture.source = Buffer.from('not an audio file');
    const previousWarn = console.warn;
    let unmeasured: any;
    try {
      console.warn = () => {}; // The real local FFprobe failure is expected for this corrupt fixture.
      unmeasured = await ensureReusableAsset({ userId: 'owner-a', url: 'https://fixture.example/corrupt.wav', kind: 'audio', source: 'generated', durationSec: 7, metadata: { mediaFacts: { source: 'probe', durationSec: 7 } } });
    } finally { console.warn = previousWarn; }
    assert.equal(unmeasured.durationSec, null, 'failed byte inspection cannot fall back to a client claim');
    assert.equal(unmeasured.metadata.mediaFacts, undefined);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});
