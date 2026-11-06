import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import test from 'node:test';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';

async function fixture(withView = false) {
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
          b.onResolve({ filter: /^(?:@\/lib\/authFetch|@\/components\/library\/LibraryImageThumbnail.client)$/ }, (a) => ({ path: a.path, namespace: 'fixture' }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: args.path.includes('LibraryImageThumbnail') ? 'export const LibraryImageThumbnail=()=>null' : 'export const authFetch=(url,init)=>window.fetchFixture(url,init)',
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
      import {CharacterStudioLibrary} from './src/components/tools/character-builder/_components/CharacterStudioLibrary.client';
      import {getStudioLibraryCopy} from './src/components/tools/character-builder/_lib/character-studio-library-copy';
      import {DEFAULT_CHARACTER_COPY} from './src/components/tools/character-builder/_lib/character-builder-copy';
      window.IS_REACT_ACT_ENVIRONMENT=true;
      const capture=()=>{const owner=window.owner;return {accessToken:'token-'+owner,signal:new AbortController().signal,isCurrent:()=>window.owner===owner}};
      function Fixture(){const library=useCharacterStudioLibrary({userId:window.owner,enabled:false,captureAccountRequest:capture});window.library=library;return window.withView?<CharacterStudioLibrary library={library} copy={getStudioLibraryCopy('en')} builderCopy={DEFAULT_CHARACTER_COPY} locale="en" userId={window.owner} onSignIn={()=>{}} onNewLook={()=>{}} onRecast={()=>{}}/>:null;}
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
  w.withView = withView;
  w.process = { env: {} };
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

const savedCharacter = (id = '17', name = 'Alba', presentation = { age: '30' }) => ({
  id, name, presentation,
  identity: { jobId: `identity-${id}`, imageUrl: `https://example.invalid/${id}.png`, thumbUrl: null, settingsSnapshot: { schemaVersion: 1, surface: 'character-builder', action: 'generate', engineId: 'fixture', engineLabel: 'Fixture', inputMode: 't2i', prompt: 'Saved fixture', builder: createDefaultCharacterBuilderState(), lineage: {} } },
  createdAt: '2026-11-06T12:00:00Z', looks: [], lookCount: 0, nextLookCursor: null,
});

async function openSavedCharacter(f: Awaited<ReturnType<typeof fixture>>, character = savedCharacter()) {
  const index = f.w.requests.length;
  await f.call(() => f.w.library.openCharacter(character.id));
  await f.reply({ ok: true, character }, 200, index);
}

test('an older rename response cannot revert a presentation saved while the rename was pending', async () => {
  const f = await fixture();
  try {
    await openSavedCharacter(f);
    await f.call(() => f.w.library.rename('17', 'Alba Studio'));
    await f.call(() => f.w.library.savePresentation('17', { age: '35' }));
    assert.deepEqual(JSON.parse(f.w.requests[1].init.body), { name: 'Alba Studio' });
    assert.deepEqual(JSON.parse(f.w.requests[2].init.body), { presentation: { age: '35' } });
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba Studio', { age: '35' }) }, 200, 2);
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba Studio', { age: '30' }) }, 200, 1);
    assert.equal(f.w.library.selected.name, 'Alba Studio');
    assert.equal(f.w.library.selected.presentation.age, '35');
  } finally { await f.close(); }
});

test('an older presentation response cannot revert a rename completed while the profile was pending', async () => {
  const f = await fixture();
  try {
    await openSavedCharacter(f);
    await f.call(() => f.w.library.savePresentation('17', { age: '35' }));
    await f.call(() => f.w.library.rename('17', 'Alba Studio'));
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba Studio', { age: '35' }) }, 200, 2);
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba', { age: '35' }) }, 200, 1);
    assert.equal(f.w.library.selected.name, 'Alba Studio');
    assert.equal(f.w.library.selected.presentation.age, '35');
  } finally { await f.close(); }
});

test('a failed rename from the previous character does not mark the newly opened character unavailable', async () => {
  const f = await fixture();
  try {
    await openSavedCharacter(f);
    await f.call(() => f.w.library.rename('17', 'Alba Studio'));
    await openSavedCharacter(f, savedCharacter('18', 'Basil'));
    await f.reply({ ok: false, error: 'temporary_failure' }, 503, 1);
    assert.equal(f.w.library.selected.id, '18');
    assert.equal(f.w.library.error, false);
  } finally { await f.close(); }
});


async function retryLibraryView(f: Awaited<ReturnType<typeof fixture>>) {
  const retry = [...f.w.document.querySelectorAll('[role=alert] button')].find((node: any) => node.textContent === 'Try again') as any;
  assert.ok(retry, 'failed library operation offers a retry');
  await f.call(() => retry.click());
}

test('retrying a failed character-list page requests that page and keeps previously loaded characters', async () => {
  const f = await fixture(true);
  try {
    await f.call(() => f.w.library.load());
    await f.reply({ ok: true, characters: [savedCharacter('19', 'First')], nextCursor: '19' });
    await f.call(() => f.w.library.load('19'));
    await f.reply({ ok: true, characters: [savedCharacter('18', 'Second')], nextCursor: '18' }, 200, 1);
    await f.call(() => f.w.library.load('18'));
    await f.reply({ ok: false }, 503, 2);
    await retryLibraryView(f);
    assert.equal(f.w.requests[3].url, '/api/character-studio/characters?before=18');
    await f.reply({ ok: true, characters: [savedCharacter('17', 'Third')], nextCursor: null }, 200, 3);
    assert.deepEqual([...f.w.library.characters].map((item: any) => item.id), ['19', '18', '17']);
    assert.equal(f.w.library.error, false);
  } finally { await f.close(); }
});

test('retrying a failed character detail returns to the requested identity instead of restarting the list', async () => {
  const f = await fixture(true);
  try {
    await f.call(() => f.w.library.openCharacter('17'));
    await f.reply({ ok: false }, 503);
    await retryLibraryView(f);
    assert.equal(f.w.requests[1].url, '/api/character-studio/characters/17');
    await f.reply({ ok: true, character: savedCharacter() }, 200, 1);
    assert.equal(f.w.library.selected.id, '17');
    assert.equal(f.w.library.error, false);
  } finally { await f.close(); }
});

async function typeField(f: Awaited<ReturnType<typeof fixture>>, input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input.tagName === 'TEXTAREA' ? f.w.HTMLTextAreaElement.prototype : f.w.HTMLInputElement.prototype;
  await f.call(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
  });
}

const viewButton = (f: Awaited<ReturnType<typeof fixture>>, text: string) =>
  [...f.w.document.querySelectorAll('button')].find((node: any) => node.textContent === text) as HTMLButtonElement | undefined;

test('a blank rename cannot submit and a failed valid rename remains editable for retry', async () => {
  const f = await fixture(true);
  try {
    await openSavedCharacter(f);
    const input = f.w.document.querySelector('input') as HTMLInputElement;
    await typeField(f, input, '  ');
    assert.equal(viewButton(f, 'Rename')?.disabled, true);
    assert.equal(f.w.requests.length, 1);
    await typeField(f, input, 'Alba Studio');
    await f.call(() => viewButton(f, 'Rename')!.click());
    await f.reply({ ok: false, error: 'temporary_failure' }, 503, 1);
    assert.equal(input.value, 'Alba Studio');
    assert.equal(viewButton(f, 'Rename')?.disabled, false);
    assert.ok(f.w.document.querySelector('[role=alert]'));
    await f.call(() => viewButton(f, 'Rename')!.click());
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba Studio') }, 200, 2);
    assert.equal(f.w.library.selected.name, 'Alba Studio');
    assert.equal(f.w.library.selected.identity.imageUrl, 'https://example.invalid/17.png');
    assert.equal(f.w.document.querySelector('[role=alert]'), null);
  } finally { await f.close(); }
});

test('a failed profile save keeps the entered field and a second submit recovers without altering identity', async () => {
  const f = await fixture(true);
  try {
    await openSavedCharacter(f);
    await f.call(() => viewButton(f, 'Edit profile')!.click());
    const label = [...f.w.document.querySelectorAll('label')].find((node: any) => node.textContent.trim().startsWith('Age')) as any;
    assert.ok(label);
    const age = label.querySelector('textarea');
    await typeField(f, age, '35');
    await f.call(() => viewButton(f, 'Save profile')!.click());
    assert.equal(age.disabled, true);
    await f.reply({ ok: false, error: 'temporary_failure' }, 503, 1);
    assert.equal(age.value, '35');
    assert.equal(age.disabled, false);
    assert.match(f.w.document.body.textContent, /The profile could not be saved/);
    await f.call(() => viewButton(f, 'Save profile')!.click());
    await f.reply({ ok: true, character: savedCharacter('17', 'Alba', { age: '35' }) }, 200, 2);
    assert.equal(f.w.library.selected.presentation.age, '35');
    assert.equal(f.w.library.selected.identity.imageUrl, 'https://example.invalid/17.png');
    assert.equal(f.w.document.querySelector('textarea'), null);
    assert.doesNotMatch(f.w.document.body.textContent, /could not be saved/);
  } finally { await f.close(); }
});

for (const responseOrder of ['old-first', 'new-first'] as const) test(`rapid identity selection keeps the newest character with ${responseOrder} responses`, async () => {
  const f = await fixture();
  try {
    await f.call(() => f.w.library.openCharacter('17'));
    await f.call(() => f.w.library.openCharacter('18'));
    if (responseOrder === 'old-first') {
      await f.reply({ ok: true, character: savedCharacter() });
      assert.equal(f.w.library.selected, null);
      assert.equal(f.w.library.detailLoading, true);
    }
    await f.reply({ ok: true, character: savedCharacter('18', 'Basil') }, 200, 1);
    if (responseOrder === 'new-first') await f.reply({ ok: true, character: savedCharacter() });
    assert.equal(f.w.library.selected.id, '18');
    assert.equal(f.w.library.selected.identity.imageUrl, 'https://example.invalid/18.png');
    assert.equal(f.w.library.detailLoading, false);
  } finally { await f.close(); }
});

test('look-page retry keeps earlier looks and the selected character identity', async () => {
  const f = await fixture(true);
  const first = savedCharacter();
  const look = (id: string) => ({ ...first.identity, id, name: `Look ${id}`, createdAt: first.createdAt });
  try {
    await openSavedCharacter(f, { ...first, looks: [look('30')], lookCount: 2, nextLookCursor: '30' } as any);
    await f.call(() => f.w.library.openCharacter('17', '30'));
    await f.reply({ ok: false }, 503, 1);
    await retryLibraryView(f);
    assert.equal(f.w.requests[2].url, '/api/character-studio/characters/17?beforeLook=30');
    await f.reply({ ok: true, character: { ...first, looks: [look('29')], lookCount: 2, nextLookCursor: null } }, 200, 2);
    assert.deepEqual([...f.w.library.selected.looks].map((item: any) => item.id), ['30', '29']);
    assert.equal(f.w.library.selected.identity.imageUrl, first.identity.imageUrl);
    assert.equal(f.w.library.error, false);
  } finally { await f.close(); }
});
