import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import test from 'node:test';

async function fixture() {
  const bundle = await build({
    absWorkingDir: path.resolve('frontend'),
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [
      {
        name: 'studio-client',
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/authFetch$/ }, (a) => ({ path: a.path, namespace: 'fixture' }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: 'export const authFetch=(url,init)=>window.fetchFixture(url,init)',
            loader: 'ts',
          }));
        },
      },
    ],
    stdin: {
      resolveDir: path.resolve('frontend'),
      loader: 'tsx',
      contents: `
      import React,{act} from 'react';import {createRoot} from 'react-dom/client';
      import {useCharacterStudioLibrary} from './src/components/tools/character-builder/_hooks/useCharacterStudioLibrary';
      window.IS_REACT_ACT_ENVIRONMENT=true;
      const capture=()=>{const owner=window.owner;return {accessToken:'token-'+owner,signal:new AbortController().signal,isCurrent:()=>window.owner===owner}};
      function Fixture(){window.library=useCharacterStudioLibrary({userId:window.owner,enabled:false,captureAccountRequest:capture});return null;}
      const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<Fixture key={window.owner}/>),unmount:()=>root.unmount()};`,
    },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'dangerously' });
  const w = dom.window as any;
  w.MessageChannel = class {
    port1 = { onmessage: () => {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  };
  w.owner = 'A';
  w.requests = [];
  w.fetchFixture = (url: string, init: unknown) =>
    new Promise((resolve) => w.requests.push({ url, init, resolve }));
  w.eval(bundle.outputFiles[0].text);
  await w.fx.act(async () => w.fx.render());
  return {
    w,
    call: async (fn: () => unknown) =>
      w.fx.act(async () => {
        void fn();
      }),
    reply: async (body: unknown, status = 200, index = 0) =>
      w.fx.act(async () => w.requests[index].resolve({ ok: status < 400, status, json: async () => body })),
    close: async () => {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}

test('saving captures the result recipe, original URL and account instead of the current draft', async () => {
  const f = await fixture();
  try {
    await f.call(() =>
      f.w.library.openSave({ jobId: 'completed-look', imageUrl: 'https://example.invalid/original.png' }),
    );
    assert.match(f.w.requests[0].url, /completed-look/);
    await f.reply({
      ok: true,
      settingsSnapshot: { surface: 'character-builder', builder: { characterId: '17' } },
    });
    assert.equal(f.w.library.saveTarget.characterId, '17');
    await f.call(() => f.w.library.save('New outfit'));
    const request = JSON.parse(f.w.requests[1].init.body);
    assert.equal(request.jobId, 'completed-look');
    assert.equal(request.imageUrl, 'https://example.invalid/original.png');
    assert.equal(request.name, 'New outfit');
    assert.equal(request.characterId, undefined, 'server stored lineage must decide the target character');
    assert.equal(f.w.requests[1].init.headers.Authorization, 'Bearer token-A');
  } finally {
    await f.close();
  }
});

test('a closed dialog and a switched account ignore late source/save responses', async () => {
  const f = await fixture();
  try {
    await f.call(() => f.w.library.openSave({ jobId: 'A-job', imageUrl: 'https://example.invalid/A.png' }));
    await f.call(() => f.w.library.closeSave());
    await f.reply({ ok: true, settingsSnapshot: { builder: { characterId: '17' } } });
    assert.equal(f.w.library.saveTarget, null);
    await f.call(() => f.w.library.openSave({ jobId: 'A-job', imageUrl: 'https://example.invalid/A.png' }));
    await f.reply({ ok: true, settingsSnapshot: { builder: {} } }, 200, 1);
    await f.call(() => f.w.library.save('Private A'));
    await f.w.fx.act(async () => {
      f.w.owner = 'B';
      f.w.fx.render();
    });
    await f.reply({ ok: true, character: { id: 'A', name: 'Private A' }, kind: 'character' }, 200, 2);
    assert.equal(f.w.library.saveTarget, null);
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.library.characters)), []);
  } finally {
    await f.close();
  }
});

test('leaving a pending character selection prevents a late new-look transition', async () => {
  const f = await fixture();
  try {
    let resolved: unknown = 'pending';
    await f.call(() =>
      f.w.library.openCharacter('17').then((value: unknown) => {
        resolved = value;
      }),
    );
    await f.call(() => f.w.library.cancelDetails());
    await f.reply({ ok: true, character: { id: '17', name: 'Alba', looks: [] } });
    assert.equal(resolved, undefined);
    assert.equal(f.w.library.selected, null);
    assert.equal(f.w.library.detailLoading, false);
  } finally {
    await f.close();
  }
});
