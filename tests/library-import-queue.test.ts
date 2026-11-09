import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { resolve } from 'node:path';
import {
  bundleClientFlow,
  createClientFlowDom,
} from './helpers/client-flow-dom';

test('serial queue retains canonical successes and retries only failed files', async () => {
  const path = resolve('frontend/lib/library-import-queue.ts');
  assert.ok(fs.existsSync(path), 'real import queue owner exists');
  const dom = createClientFlowDom('/app/library');
  const w = dom.window as any;
  w.eval(
    await bundleClientFlow(
      `import{createLibraryImportQueue}from'./lib/library-import-queue';window.createLibraryImportQueue=createLibraryImportQueue;`,
      {},
    ),
  );
  const createLibraryImportQueue = w.createLibraryImportQueue;
  const File = w.File;
  const calls: string[] = [];
  let fail = true;
  const queue = createLibraryImportQueue({
    userId: 'owner',
    upload: async (file: File) => {
      calls.push(file.name);
      if (file.name === 'fail.mp3' && fail) throw Error('failed');
      return {
        id: file.name,
        assetId: 'ma_' + 'a'.repeat(32),
        ref: { type: 'asset', assetId: 'ma_' + 'a'.repeat(32), kind: 'image' },
        kind: 'image',
        url: 'https://cdn.example/' + file.name,
      };
    },
  });
  try {
    queue.add([
      new File(['image'], 'ok.png', { type: 'image/png' }),
      new File(['audio'], 'fail.mp3', { type: 'audio/mpeg' }),
    ]);
    await queue.start();
    assert.deepEqual(calls, ['ok.png', 'fail.mp3']);
    assert.equal(
      queue.getSnapshot().files.filter((f: any) => f.status === 'success')
        .length,
      1,
    );
    fail = false;
    await queue.retry(
      queue.getSnapshot().files.find((f: any) => f.status === 'failed').id,
    );
    assert.deepEqual(calls, ['ok.png', 'fail.mp3', 'fail.mp3']);
    assert.equal(
      queue.getSnapshot().files.filter((f: any) => f.status === 'success')
        .length,
      2,
    );
    assert.ok(
      queue
        .getSnapshot()
        .files.every(
          (f: any) => f.result.ref.assetId === 'ma_' + 'a'.repeat(32),
        ),
    );
  } finally {
    queue.retire();
    w.close();
  }
});

test('actual adapters import mixed media, keep canonical successful results through close/reopen and retry completion without a second upload', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.eval(
    await bundleClientFlow(
      `import{createLibraryImportQueue}from'./lib/library-import-queue';window.createLibraryImportQueue=createLibraryImportQueue;`,
      {
        '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'token'}}})}});`,
      },
    ),
  );
  w.createImageBitmap = async () => ({ width: 20, height: 20, close() {} });
  const calls: string[] = [];
  let failRestore = true;
  w.fetch = async (url: string, init: any) => {
    calls.push(url);
    if (url === '/api/media-library/organization') {
      const ref = JSON.parse(init.body).references[0];
      if (ref.assetId === 'ma_' + 'b'.repeat(32) && failRestore)
        return {
          ok: false,
          json: async () => ({ ok: false, succeededCount: 0, failedCount: 1 }),
        };
      return {
        ok: true,
        json: async () => ({ ok: true, succeededCount: 1, failedCount: 0 }),
      };
    }
    const kind = url.split('/').at(-1)!;
    return {
      ok: true,
      json: async () => ({
        ok: true,
        asset: {
          id: 'internal-' + kind,
          assetId: 'ma_' + (kind === 'audio' ? 'b' : 'a').repeat(32),
          url: 'https://cdn.example/' + kind,
          kind,
          name: kind,
        },
      }),
    };
  };
  const queue = w.createLibraryImportQueue({ userId: 'owner' });
  const imageFile = new w.File(['image'], 'image.png', { type: 'image/png' });
  try {
    queue.add([
      imageFile,
      new w.File(['audio'], 'audio.mp3', { type: 'audio/mpeg' }),
      new w.File(['video'], 'video.mp4', { type: 'video/mp4' }),
    ]);
    await queue.start();
    assert.equal(
      queue.getSnapshot().files.filter((f: any) => f.status === 'success')
        .length,
      2,
    );
    const failed = queue
      .getSnapshot()
      .files.find((f: any) => f.status === 'failed');
    assert.equal(failed.saved, true);
    assert.equal(failed.result.id, 'internal-audio');
    failRestore = false;
    await queue.retry(failed.id);
    assert.equal(calls.filter((url) => url === '/api/uploads/audio').length, 1);
    assert.equal(
      queue.getSnapshot().files.filter((f: any) => f.status === 'success')
        .length,
      3,
    );
    assert.equal(
      queue.getSnapshot().files[0].result.ref.assetId,
      'ma_' + 'a'.repeat(32),
    );
    assert.ok(calls.every((url) => !url.includes('/direct')));
    queue.add([imageFile]);
    assert.equal(queue.getSnapshot().files.length, 3);
    await queue.start();
    assert.equal(calls.filter((url) => url === '/api/uploads/image').length, 1);
    assert.equal(
      calls.filter((url) => url === '/api/media-library/organization').length,
      5,
    );
    assert.equal(queue.getSnapshot().files[0].status, 'success');
  } finally {
    queue.retire();
    w.close();
  }
});

test('pause completes the active file and defers the next; retirement aborts and ignores a late response', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.eval(
    await bundleClientFlow(
      `import { createLibraryImportQueue } from './lib/library-import-queue'; window.createLibraryImportQueue = createLibraryImportQueue;`,
      {},
    ),
  );
  const calls: string[] = [];
  let resolveFirst!: (asset: unknown) => void;
  let resolveSecond!: (asset: unknown) => void;
  let activeSignal: AbortSignal | undefined;
  const result = {
    id: 'saved',
    kind: 'image',
    url: 'https://cdn.example/original.png',
    ref: { type: 'asset', assetId: 'ma_' + 'a'.repeat(32), kind: 'image' },
  };
  const queue = w.createLibraryImportQueue({
    userId: 'owner',
    upload: (file: File, context: { signal: AbortSignal }) => {
      calls.push(file.name);
      activeSignal = context.signal;
      return new Promise((resolve) => {
        if (calls.length === 1) resolveFirst = resolve;
        else resolveSecond = resolve;
      });
    },
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  try {
    queue.add([
      new w.File(['first'], 'first.png', { type: 'image/png' }),
      new w.File(['second'], 'second.png', { type: 'image/png' }),
    ]);
    const running = queue.start();
    await settle();
    queue.pause();
    resolveFirst(result);
    await settle();
    assert.deepEqual(calls, ['first.png']);
    assert.equal(queue.getSnapshot().files[0].status, 'success');
    assert.equal(queue.getSnapshot().paused, true);
    queue.resume();
    await settle();
    assert.deepEqual(calls, ['first.png', 'second.png']);
    queue.retire();
    assert.equal(activeSignal?.aborted, true);
    resolveSecond(result);
    await running;
    assert.equal(queue.getSnapshot().files.length, 0);
    queue.add([new w.File(['third'], 'third.png', { type: 'image/png' })]);
    await queue.start();
    assert.deepEqual(calls, ['first.png', 'second.png']);
  } finally {
    queue.retire();
    w.close();
  }
});

for (const difference of ['lastModified', 'mime', 'bytes']) {
  test(`same-name/size imports preserve exact SDK ${difference} identity when readding the second file`, async () => {
    const dom = createClientFlowDom('/app/library'),
      w = dom.window as any;
    w.eval(
      await bundleClientFlow(
        `
      import Uppy from '@uppy/core';
      import { createLibraryImportQueue } from './lib/library-import-queue';
      const add = Uppy.prototype.addFile;
      Uppy.prototype.addFile = function(file) {
        if (window.blockAdds) this.setState({allowNewUpload: false});
        try { return add.call(this, file); }
        finally { if (window.blockAdds) this.setState({allowNewUpload: true}); }
      };
      window.createLibraryImportQueue = createLibraryImportQueue;
    `,
        {
          '@/lib/supabaseClientLoader': `export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'token'}}})}});`,
        },
      ),
    );
    let uploads = 0;
    const restored: string[] = [];
    const ids = ['ma_' + 'a'.repeat(32), 'ma_' + 'b'.repeat(32)];
    w.fetch = async (url: string, init: any) => {
      if (url === '/api/media-library/organization') {
        restored.push(JSON.parse(init.body).references[0].assetId);
        return {
          ok: true,
          json: async () => ({ ok: true, succeededCount: 1, failedCount: 0 }),
        };
      }
      assert.equal(url, '/api/uploads/video');
      const bytes = await new Promise<string>((resolve, reject) => {
        const reader = new w.FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
        reader.readAsText(init.body.get('file'));
      });
      assert.ok(bytes === 'abcd' || bytes === 'efgh');
      const index = bytes === 'abcd' ? 0 : 1;
      uploads++;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          asset: {
            id: 'internal-' + index,
            assetId: ids[index],
            url: `https://cdn.example/${index}.mp4`,
            kind: 'video',
          },
        }),
      };
    };
    const queue = w.createLibraryImportQueue({ userId: 'owner' });
    const first = new w.File(['abcd'], 'same.mp4', {
      type: 'video/mp4',
      lastModified: 1,
    });
    const second = new w.File(['efgh'], 'same.mp4', {
      type: difference === 'mime' ? 'video/quicktime' : 'video/mp4',
      lastModified: difference === 'lastModified' ? 2 : 1,
    });
    try {
      queue.add([first, second]);
      await queue.start();
      assert.equal(queue.getSnapshot().files.length, 2);
      assert.deepEqual(restored, ids);
      queue.add([second]);
      await queue.start();
      assert.deepEqual(
        restored,
        [ids[0], ids[1], ids[1]],
        'Restore must target the reselected exact file',
      );
      assert.equal(uploads, 2);
      if (difference === 'bytes') {
        const freshSameContent = new w.File(['efgh'], 'same.mp4', { type: 'video/mp4', lastModified: 1 });
        Object.defineProperty(freshSameContent, 'arrayBuffer', { value: () => { throw Error('queue must not buffer originals'); } });
        queue.add([freshSameContent]);
        await queue.start();
        assert.equal(uploads, 3, 'fresh File uses the actual import adapter');
        assert.deepEqual(restored, [ids[0], ids[1], ids[1], ids[1]], 'owner content dedup restores B, never metadata-colliding A');
        assert.equal(queue.getSnapshot().files[2].result.assetId, ids[1]);
      }
      const expectedUploads = uploads, expectedRestores = restored.length;
      const accepted = queue.getSnapshot();
      w.blockAdds = true;
      assert.throws(
        () => queue.add([second]),
        'non-duplicate SDK restriction must propagate',
      );
      assert.equal(
        queue.getSnapshot(),
        accepted,
        'unrelated restriction must not requeue any accepted file',
      );
      await queue.start();
      assert.equal(uploads, expectedUploads);
      assert.equal(restored.length, expectedRestores);
    } finally {
      queue.retire();
      w.close();
    }
  });
}

test('page import alert clears when explicit queue Retry resolves the only failed file', {timeout:10000}, async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  w.failed = true; w.uploads = [];
  w.eval(await bundleClientFlow(`
    import React,{act} from 'react';import{createRoot}from'react-dom/client';
    import{useLibraryAssetMutations}from'./app/(core)/(workspace)/app/library/_hooks/useLibraryAssetMutations';
    import{DEFAULT_LIBRARY_COPY}from'./app/(core)/(workspace)/app/library/_lib/library-page-helpers';
    import{LibraryImportQueue}from'./components/library/LibraryImportQueue.client';
    function Host(){const mutation=useLibraryAssetMutations({userId:'owner',activeKind:'all',activeSource:'all',copy:DEFAULT_LIBRARY_COPY,mutateAssets:async()=>{},mutateRecentOutputs:async()=>{},setActiveSource(){},setActiveView(){}});window.mutation=mutation;return <>{mutation.importError?<p role="alert">{mutation.importError}</p>:null}<LibraryImportQueue queue={mutation.importQueue} locale="en"/></>}
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Host/>),unmount:()=>root.unmount()};
  `, {
    './library-file-import': `export class LibraryImportCompletionError extends Error{};export const finishLibraryImport=async()=>{};export async function importLibraryFile(file){window.uploads.push(file.name);if(file.name==='retry.png'&&window.failed)throw Error('transient');return{id:file.name,kind:'image',url:'https://example.invalid/'+file.name}}`,
    '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}})}});',
  }));
  try {
    await w.fx.act(async()=>w.fx.render());
    await w.fx.act(async()=>w.mutation.handleImportChange({currentTarget:{value:'files',files:[new w.File(['one'],'ok.png',{type:'image/png'}),new w.File(['two'],'retry.png',{type:'image/png'})]}}));
    assert.ok(w.document.querySelector('[role="alert"]'), 'initial failure is visible');
    w.failed=false;
    const retry=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Retry') as any;
    assert.ok(retry);
    await w.fx.act(async()=>{retry.click();await new Promise(r=>setTimeout(r,30));});
    assert.deepEqual([...w.uploads],['ok.png','retry.png','retry.png']);
    assert.ok(w.mutation.importQueue.getSnapshot().files.every((f:any)=>f.status==='success'));
    assert.ok(!w.document.querySelector('[role="alert"]'),'successful explicit Retry retires the page error');
  } finally {await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
