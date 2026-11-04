import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import test from 'node:test';

async function fixture(surface: 'recast' | 'dialog' | 'look') {
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
        name: 'thumbnail',
        setup(b) {
          b.onResolve({ filter: /^@\/components\/library\/LibraryImageThumbnail.client$/ }, (a) => ({
            path: a.path,
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: 'export const LibraryImageThumbnail=()=>null',
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
      import {CharacterStudioRecast} from './src/components/tools/character-builder/_components/CharacterStudioRecast.client';
      import {CharacterStudioSaveDialog} from './src/components/tools/character-builder/_components/CharacterStudioSaveDialog.client';
      import {CharacterStudioComposer} from './src/components/tools/character-builder/_components/CharacterStudioComposer.client';
      import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
      import {getStudioLibraryCopy} from './src/components/tools/character-builder/_lib/character-studio-library-copy';
      import {DEFAULT_CHARACTER_COPY} from './src/components/tools/character-builder/_lib/character-builder-copy';
      import {createDefaultCharacterBuilderState} from './src/lib/character-builder';
      window.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));
      const copy=getCharacterStudioCopy('fr');window.labels=copy;
      window.fx={act,unmount:()=>root.unmount(),render:()=>root.render(window.surface==='recast'
        ? <CharacterStudioRecast copy={copy} active={window.active} navigation={null} selection={window.selection}/>
        : window.surface==='dialog' ? <CharacterStudioSaveDialog copy={getStudioLibraryCopy('fr')} target={window.target} busy={false} error={false} onSave={name=>window.saved=name} onRetry={()=>{}} onClose={()=>window.closed=true}/>
        : <CharacterStudioComposer state={{...createDefaultCharacterBuilderState(),characterId:'17'}} setState={()=>{}} copy={DEFAULT_CHARACTER_COPY} labels={copy} locale="fr" navigation={null} identitySlot={<p>Identité conservée</p>} styleSlot={null} price={0.2} canGenerate busy={false} onGenerate={n=>window.generated=n}/>) };`,
    },
  });
  const dom = new JSDOM('<button id="opener">Save</button><div id="root"></div>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });
  const w = dom.window as any;
  w.process = { env: { NODE_ENV: 'test' } };
  w.MessageChannel = class {
    port1 = { onmessage: () => {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  };
  w.revoked = [];
  w.URL.revokeObjectURL = (url: string) => w.revoked.push(url);
  w.URL.createObjectURL = (file: File) => `blob:${file.name}`;
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.surface = surface;
  w.active = true;
  w.target = {
    jobId: 'look',
    imageUrl: 'https://example.invalid/look.png',
    characterId: '17',
    loading: false,
  };
  w.document.getElementById('opener').focus();
  w.eval(bundle.outputFiles[0].text);
  await w.fx.act(async () => w.fx.render());
  return {
    w,
    dom,
    act: async (fn: () => void) => w.fx.act(fn),
    close: async () => {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}

test('Recast handoff replaces only the portrait and preserves video/prompt through mode changes', async () => {
  const f = await fixture('recast');
  const { w } = f;
  try {
    const doc = w.document;
    let probe: HTMLMediaElement | undefined;
    const create = doc.createElement.bind(doc);
    doc.createElement = (name: string, ...args: unknown[]) => {
      const el = create(name, ...args);
      if (name === 'video') probe = el;
      return el;
    };
    for (const kind of ['video', 'image']) {
      const input = w.document.querySelector(`input[accept="${kind}/*"]`);
      Object.defineProperty(input, 'files', {
        value: [new w.File(['fixture'], `${kind}.mp4`, { type: `${kind}/test` })],
      });
      await f.act(() => input.dispatchEvent(new w.Event('change', { bubbles: true })));
    }
    assert.ok(probe);
    Object.defineProperty(probe, 'duration', { value: 25.6 });
    await f.act(() => probe!.dispatchEvent(new w.Event('loadedmetadata')));
    const dialog = doc.querySelector('[role=dialog]');
    assert.ok(dialog, 'importing a long take opens the editor');
    const setPoint = async (field: string, value: string) =>
      f.act(() => {
        const input = dialog.querySelector('input[aria-label="' + field + ' (secondes)"]');
        Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new w.Event('input', { bubbles: true }));
      });
    const apply = [...dialog.querySelectorAll('button')].find(
      (el: any) => el.textContent === 'Utiliser ce passage',
    );
    await setPoint('Fin', '25.5');
    assert.ok(apply.disabled, 'the whole take exceeds the reference limit');
    await setPoint('Début', '18');
    await f.act(() => apply.click());
    assert.equal(doc.querySelector('#recast-duration').value, '8');
    const prompt = w.document.querySelector('textarea');
    await f.act(() => {
      Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set.call(
        prompt,
        'Conserver les mouvements',
      );
      prompt.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    await f.act(() => {
      w.selection = {
        jobId: 'look',
        transferId: '1',
        imageUrl: 'https://example.invalid/original.png',
        name: 'Alba',
      };
      w.fx.render();
    });
    assert.equal(w.document.querySelector('img').getAttribute('src'), w.selection.imageUrl);
    const readers = [...w.document.querySelectorAll('video[controls]')];
    assert.equal(readers.length, 2);
    assert.ok(readers.every((v: any) => v.getAttribute('src') === 'blob:video.mp4#t=18,25.5'));
    assert.deepEqual([...w.revoked], ['blob:image.mp4']);
    await f.act(() => {
      w.active = false;
      w.fx.render();
    });
    await f.act(() => {
      w.active = true;
      w.fx.render();
    });
    assert.equal(w.document.querySelector('textarea').value, 'Conserver les mouvements');
    assert.equal(w.document.querySelector('img').alt, 'Alba');
    await f.act(() => w.fx.unmount());
    assert.deepEqual([...w.revoked], ['blob:image.mp4', 'blob:video.mp4']);
  } finally {
    await f.close();
  }
});

test('save dialog follows stored look context, submits the name and returns keyboard focus', async () => {
  const f = await fixture('dialog');
  const { w } = f;
  try {
    assert.match(w.document.querySelector('h2').textContent, /look/);
    assert.equal(w.document.activeElement.tagName, 'INPUT');
    await f.act(() =>
      w.document
        .querySelector('form')
        .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })),
    );
    assert.equal(w.saved, 'Nouveau look');
    await f.act(() =>
      w.document
        .querySelector('dialog')
        .dispatchEvent(new w.Event('cancel', { bubbles: false, cancelable: true })),
    );
    assert.equal(w.closed, true);
    await f.act(() => w.fx.unmount());
    assert.equal(w.document.activeElement.id, 'opener');
  } finally {
    await f.close();
  }
});

test('new look hides identity controls and opens clothing with a dedicated generate action', async () => {
  const f = await fixture('look');
  const { w } = f;
  try {
    assert.equal(w.document.querySelector('#studio-section-type'), null);
    assert.equal(w.document.querySelector('#studio-section-face'), null);
    assert.ok(w.document.querySelector('#studio-section-clothing'));
    const button = [...w.document.querySelectorAll('button')].find((el: any) =>
      el.textContent.includes(w.labels.generateLook),
    ) as any;
    assert.ok(button);
    await f.act(() => button.click());
    assert.equal(w.generated, 1);
  } finally {
    await f.close();
  }
});

test('Recast retains the product, spoken line and accepted audio when editor tabs and the character change', async () => {
  const f = await fixture('recast');
  const { w } = f;
  try {
    const doc = w.document;
    const clickText = (value: string) =>
      f.act(() =>
        [...doc.querySelectorAll('button')].find((n: any) => n.textContent.trim() === value).click(),
      );
    const upload = async (selector: string, name: string, type: string) => {
      const input = doc.querySelector(selector);
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new w.File(['bytes'], name, { type })],
      });
      await f.act(() => input.dispatchEvent(new w.Event('change', { bubbles: true })));
    };
    let probe: any;
    const create = doc.createElement.bind(doc);
    doc.createElement = (name: string, ...rest: any[]) => {
      const el = create(name, ...rest);
      if (name === 'audio') probe = el;
      return el;
    };
    await upload('input[accept^="image/jpeg"]', 'watch.png', 'image/png');
    await clickText('Dialogue');
    const line = doc.querySelector('textarea');
    await f.act(() => {
      Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set.call(
        line,
        'Regardez ce cadran.',
      );
      line.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    await upload('input[accept^=".mp3"]', 'too-long.wav', 'audio/wav');
    Object.defineProperty(probe, 'duration', { value: 16 });
    await f.act(async () => {
      probe.dispatchEvent(new w.Event('loadedmetadata'));
      await Promise.resolve();
    });
    assert.ok(doc.querySelector('[role=dialog]'), 'a long recording opens the shared passage editor');
    assert.ok(!w.revoked.includes('blob:too-long.wav'), 'the original remains available');
    await clickText('Annuler');
    assert.match(doc.body.textContent, /Choisis un passage de 15 s maximum/);
    assert.doesNotMatch(doc.body.textContent, /Télécharger la fiche de tournage/);
    await clickText('Choisir un passage');
    assert.ok(doc.querySelector('[role=dialog]'));
    await clickText('Utiliser ce passage');
    assert.equal(doc.querySelector('audio[controls]').getAttribute('src'), 'blob:too-long.wav#t=0,15');
    assert.equal(doc.querySelector('#recast-duration').value, '15');
    await upload('input[accept^=".mp3"]', 'voice.wav', 'audio/wav');
    Object.defineProperty(probe, 'duration', { value: 3.27 });
    await f.act(async () => {
      probe.dispatchEvent(new w.Event('loadedmetadata'));
      await Promise.resolve();
    });
    await clickText('Mise en scène');
    await f.act(() => {
      w.selection = {
        jobId: 'test',
        transferId: 'look2',
        imageUrl: 'https://example.invalid/cole',
        name: 'Cole',
      };
      w.fx.render();
    });
    await clickText('Dialogue •');
    assert.equal(doc.querySelector('textarea').value, 'Regardez ce cadran.');
    assert.equal(doc.querySelector('audio[controls]').getAttribute('src'), 'blob:voice.wav');
    assert.ok(doc.querySelector('img[alt="Cole"]'));
    assert.ok(doc.querySelector('img[alt="watch.png"]'));
    await f.act(() => doc.querySelector('button[aria-label="Retirer · Produit ou objet"]').click());
    assert.equal(doc.querySelector('img[alt="watch.png"]'), null);
    assert.ok(doc.querySelector('img[alt="Cole"]'));
  } finally {
    await f.close();
  }
});
