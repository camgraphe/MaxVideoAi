import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bundleClientFlow,
  createClientFlowDom,
} from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

// Regression coverage for account-bound uploads, character caches and Kling chunking.
// Real React owners, SWR, image preparation, upload transport and Kling file input.
// Only session lookup, browser bitmap decoding and HTTP are controlled boundaries.
const sessionBoundary = {
  '@/lib/supabaseClient':
    'export const supabase={auth:{getSession:()=>window.getSession()}};',
};
const cacheBundle = bundleClientFlow(
  `
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {SWRProvider} from './components/swr/SWRProvider';
  import {useImageLibraryData} from './app/(core)/(workspace)/app/image/_hooks/useImageLibraryData';
  function Library(){
    const state=useImageLibraryData({userId:window.owner,source:'character',isCharacterMode:true});
    window.probe=state;return <output>{state.data?.map(a=>a.imageUrl).join(',') ?? ''}</output>;
  }
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<SWRProvider><Library key={window.owner}/></SWRProvider>),unmount:()=>root.unmount()};
`,
  {
    ...sessionBoundary,
    'next/navigation': `export const usePathname=()=>'/app/image';`,
  },
);

const uploadBundle = bundleClientFlow(
  `
  import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';
  import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
  import {useWorkspaceReferenceAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
  import {useWorkspaceKlingElementAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets';
  import {KlingElementsBuilder} from './components/KlingElementsBuilder';
  import {I18nProvider} from './lib/i18n/I18nProvider';
  import {uploadVideoFile} from './lib/client-video-upload';
  const noop=()=>{};
  function Main(){
    const state=useWorkspaceAssetState(window.owner);
    const actions=useWorkspaceReferenceAssets({accountScope:window.owner,engineId:'wan-3',preferredMode:'ref2v',
      inputAssets:state.inputAssets,setInputAssets:state.setInputAssets,commitInputAssetMutation:state.commitInputAssetMutation,
      workflowCopy:{clearReferencesToUseStartEnd:'clear',clearStartEndToUseReferences:'clear'},
      showNotice:m=>window.notices.push(m),assetLibrarySource:'all',resetAssetLibraryForSource:noop,setAssetPickerTarget:noop,setAssetLibrary:noop});
    window.probe={...state,...actions};return <output>{JSON.stringify(state.inputAssets)}</output>;
  }
  function Kling(){
    const [elements,setElements]=useState([{id:'subject',frontal:null,references:[null,null,null],video:null}]);
    const actions=useWorkspaceKlingElementAssets({accountScope:window.owner,klingElements:elements,setKlingElements:setElements,
      showNotice:m=>window.notices.push(m),assetLibrarySource:'all',resetAssetLibraryForSource:noop,setAssetPickerTarget:noop});
    window.probe={elements,...actions};
    return <KlingElementsBuilder elements={elements} onAddElement={actions.handleKlingElementAdd}
      onRemoveElement={actions.handleKlingElementRemove} onAddAsset={actions.handleKlingElementAssetAdd}
      onRemoveAsset={actions.handleKlingElementAssetRemove} />;
  }
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<React.StrictMode><I18nProvider locale="en" dictionary={{}} fallback={{}}>
    {window.suite==='kling'?<Kling key={window.owner}/>:<Main/>}</I18nProvider></React.StrictMode>),unmount:()=>root.unmount(),uploadVideoFile};
`,
  sessionBoundary,
);

function session(owner: string) {
  return {
    data: { session: { user: { id: owner }, access_token: 'token-' + owner } },
    error: null,
  };
}
async function settle(w: any, predicate: () => boolean, label: string) {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
  }
  assert.fail(label);
}

for (const mismatch of [true, false])
  test(`character cache: ${mismatch ? 'B response never enters A cache after A-B-A' : 'control, A response stays under A'}`, async () => {
    const dom = createClientFlowDom('/app/image');
    const w = dom.window as any;
    const oldSession = deferred<any>();
    const entered = deferred<void>();
    const ownResponse = deferred<any>();
    let reads = 0,
      blockRefresh = false;
    const requests: any[] = [];
    w.owner = 'A';
    w.sessionStorage.setItem('last-known:user-id', 'A');
    w.getSession = () => {
      if (++reads === 1) {
        entered.resolve();
        return oldSession.promise;
      }
      return Promise.resolve(session(w.owner));
    };
    const response = (owner: string) => ({
      ok: true,
      json: async () => ({
        ok: true,
        characters: [
          {
            id: owner + '-character',
            jobId: owner + '-job',
            imageUrl: 'https://example.invalid/' + owner + '/character.png',
          },
        ],
      }),
    });
    w.fetch = (url: string, init: RequestInit) => {
      const bearer = new Headers(init.headers).get('Authorization');
      requests.push({ url, bearer });
      return blockRefresh && bearer === 'Bearer token-A'
        ? ownResponse.promise
        : Promise.resolve(response(bearer === 'Bearer token-A' ? 'A' : 'B'));
    };
    w.eval(await cacheBundle);
    try {
      await w.fx.act(async () => w.fx.render());
      await entered.promise;
      await w.fx.act(async () => {
        w.owner = 'B';
        w.sessionStorage.setItem('last-known:user-id', 'B');
        w.fx.render();
      });
      await settle(
        w,
        () => w.document.querySelector('output').textContent.includes('/B/'),
        'B loads its own character',
      );
      await w.fx.act(async () =>
        oldSession.resolve(session(mismatch ? 'B' : 'A')),
      );
      blockRefresh = true;
      await w.fx.act(async () => {
        w.owner = 'A';
        w.sessionStorage.setItem('last-known:user-id', 'A');
        w.fx.render();
      });
      assert.equal(
        w.document.querySelector('output').textContent,
        mismatch ? '' : 'https://example.invalid/A/character.png',
      );
      assert.equal(
        requests.filter((r) => r.bearer === 'Bearer token-B').length,
        1,
        'B data may only be fetched for B cache',
      );
      await w.fx.act(async () => {
        const refresh = w.probe.mutate();
        ownResponse.resolve(response('A'));
        await refresh;
      });
      assert.equal(
        w.document.querySelector('output').textContent,
        'https://example.invalid/A/character.png',
      );
    } finally {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    }
  });

async function uploadFixture(suite: 'main' | 'kling') {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  const requests: any[] = [];
  w.suite = suite;
  w.owner = 'A';
  w.notices = [];
  w.sessionStorage.setItem('last-known:user-id', 'A');
  w.console.error = () => {};
  w.getSession = async () => session(w.owner);
  Object.assign(w, { File, Blob, FormData });
  w.createImageBitmap = async () => ({ width: 10, height: 10, close() {} });
  w.URL.createObjectURL = (file: File) => 'blob:' + file.name;
  w.URL.revokeObjectURL = () => {};
  w.fetch = async (url: string, init: RequestInit) => {
    requests.push({
      url,
      init,
      bearer: new Headers(init.headers).get('Authorization'),
      file: (init.body as FormData)?.get?.('file'),
    });
    return Response.json({
      ok: true,
      asset: {
        id: 'asset',
        url: 'https://example.invalid/uploaded',
        mime: 'image/png',
      },
    });
  };
  w.eval(await uploadBundle);
  await w.fx.act(async () => w.fx.render());
  return {
    w,
    requests,
    async dispose() {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}
async function startUpload(w: any, suite: string, kind: string, file: File) {
  await w.fx.act(async () => {
    if (suite === 'kling') {
      const input = w.document.querySelector(
        'input[type=file][accept="' + kind + '/*"]',
      );
      assert.ok(input);
      assert.equal(input.disabled, false);
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
    } else {
      w.probe.handleAssetAdd(
        {
          id: 'reference_' + kind + '_urls',
          type: kind,
          label: 'Reference',
          maxCount: 3,
        },
        file,
        0,
      );
    }
  });
}
for (const [suite, kinds] of [
  ['main', ['image', 'audio', 'video']],
  ['kling', ['image', 'video']],
] as const)
  for (const kind of kinds)
    for (const changed of [true, false]) {
      test(`${suite} ${kind} upload: ${changed ? 'retired A file never dispatches with B session' : 'control, uninterrupted A upload succeeds'}`, async () => {
        const f = await uploadFixture(suite);
        const oldSession = deferred<any>();
        const entered = deferred<void>();
        f.w.getSession = () => {
          entered.resolve();
          return oldSession.promise;
        };
        const file = new File(
          ['synthetic'],
          `private-A.${kind === 'image' ? 'png' : kind === 'audio' ? 'wav' : 'mp4'}`,
          {
            type:
              kind +
              '/' +
              (kind === 'image' ? 'png' : kind === 'audio' ? 'wav' : 'mp4'),
          },
        );
        try {
          await startUpload(f.w, suite, kind, file);
          await entered.promise;
          if (changed)
            await f.w.fx.act(async () => {
              f.w.owner = 'B';
              f.w.sessionStorage.setItem('last-known:user-id', 'B');
              f.w.fx.render();
            });
          await f.w.fx.act(async () =>
            oldSession.resolve(session(changed ? 'B' : 'A')),
          );
          if (changed)
            assert.equal(
              f.requests.length,
              0,
              'retired upload must not send the file',
            );
          else {
            assert.equal(f.requests.length, 1);
            assert.equal(f.requests[0].bearer, 'Bearer token-A');
            assert.equal(f.requests[0].file.name, file.name);
            assert.equal(f.requests[0].init.credentials, 'omit');
            assert.ok(f.requests[0].init.signal);
            assert.equal(f.requests[0].init.signal.aborted, false);
          }
          if (changed) {
            if (suite === 'main')
              assert.deepEqual(
                JSON.parse(f.w.document.querySelector('output').textContent),
                {},
              );
            else
              assert.equal(
                kind === 'video'
                  ? f.w.probe.elements[0].video
                  : f.w.probe.elements[0].frontal,
                null,
              );
          } else {
            await settle(
              f.w,
              () =>
                suite === 'main'
                  ? f.w.probe.inputAssets['reference_' + kind + '_urls']?.[0]
                      ?.status === 'ready'
                  : (kind === 'video'
                      ? f.w.probe.elements[0].video
                      : f.w.probe.elements[0].frontal
                    )?.status === 'ready',
              'current upload updates state',
            );
          }
        } finally {
          await f.dispose();
        }
      });
    }

test('control: main reference image preparation is retired before authFetch begins', async () => {
  const f = await uploadFixture('main');
  const decode = deferred<any>();
  f.w.createImageBitmap = () => decode.promise;
  try {
    await startUpload(
      f.w,
      'main',
      'image',
      new File(['synthetic'], 'private-A.png', { type: 'image/png' }),
    );
    await f.w.fx.act(async () => {
      f.w.owner = 'B';
      f.w.fx.render();
    });
    await f.w.fx.act(async () =>
      decode.resolve({ width: 10, height: 10, close() {} }),
    );
    assert.equal(f.requests.length, 0);
  } finally {
    await f.dispose();
  }
});

for (const sizeMiB of [1, 8, 20])
  test(`Kling video picker uploads ${sizeMiB} MiB below the function body limit`, async () => {
    const f = await uploadFixture('kling');
    const requests: any[] = [];
    f.w.fetch = async (url: string, init: RequestInit) => {
      const bytes = (
        await new Request('https://example.invalid' + url, init).arrayBuffer()
      ).byteLength;
      requests.push({ url, bytes });
      if (bytes > 4.5 * 1024 * 1024)
        return new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 });
      if (url.endsWith('/start'))
        return Response.json({
          ok: true,
          upload: {
            uploadId: 'fixture',
            key: 'fixture.mp4',
            chunkSizeBytes: 3670016,
          },
        });
      if (url.endsWith('/part')) {
        const body = init.body as FormData;
        const n = Number(body.get('partNumber'));
        return Response.json({
          ok: true,
          part: {
            partNumber: n,
            etag: 'part-' + n,
            key: 'part-' + n,
            size: (body.get('chunk') as Blob).size,
          },
        });
      }
      return Response.json({
        ok: true,
        asset: { id: 'uploaded', url: 'https://example.invalid/uploaded.mp4' },
      });
    };
    try {
      await startUpload(
        f.w,
        'kling',
        'video',
        new File([new Uint8Array(sizeMiB * 1024 * 1024)], 'synthetic.mp4', {
          type: 'video/mp4',
        }),
      );
      await settle(
        f.w,
        () => f.w.probe.elements[0].video?.status === 'ready',
        'Kling final upload status',
      );
      assert.equal(
        requests.length,
        sizeMiB === 1 ? 1 : Math.ceil((sizeMiB * 1024 * 1024) / 3670016) + 2,
      );
      assert.equal(
        requests[0].url,
        sizeMiB === 1
          ? '/api/uploads/video'
          : '/api/uploads/video/multipart/start',
      );
      assert.ok(
        requests.every((r) => r.bytes < 4.5 * 1024 * 1024),
        'all HTTP bodies, including multipart overhead, fit',
      );
      assert.equal(
        f.w.probe.elements[0].video.url,
        'https://example.invalid/uploaded.mp4',
      );
      assert.equal(f.w.notices.length, 0);
    } finally {
      await f.dispose();
    }
  });

test('control: shared video uploader splits the same 8 MiB file below the function limit', async () => {
  const f = await uploadFixture('main');
  const requests: any[] = [];
  f.w.fetch = async (url: string, init: RequestInit) => {
    const bytes = (
      await new Request('https://example.invalid' + url, init).arrayBuffer()
    ).byteLength;
    requests.push({ url, bytes });
    assert.ok(bytes < 4.5 * 1024 * 1024);
    if (url.endsWith('/start'))
      return Response.json({
        ok: true,
        upload: {
          uploadId: 'fixture',
          key: 'fixture.mp4',
          chunkSizeBytes: 3670016,
        },
      });
    if (url.endsWith('/part')) {
      const body = init.body as FormData;
      const n = Number(body.get('partNumber'));
      return Response.json({
        ok: true,
        part: {
          partNumber: n,
          etag: 'part-' + n,
          key: 'part-' + n,
          size: (body.get('chunk') as Blob).size,
        },
      });
    }
    if (url.endsWith('/complete'))
      return Response.json({
        ok: true,
        asset: { id: 'large', url: 'https://example.invalid/large.mp4' },
      });
    throw new Error('Unexpected ' + url);
  };
  try {
    const result = await f.w.fx.uploadVideoFile(
      new File([new Uint8Array(8 * 1024 * 1024)], 'synthetic.mp4', {
        type: 'video/mp4',
      }),
    );
    assert.equal(result.id, 'large');
    assert.equal(requests.length, 5);
  } finally {
    await f.dispose();
  }
});

for (const suite of ['main', 'kling'] as const) {
  for (const retirement of ['switch-old-token', 'A-B-A', 'unmount'] as const) {
    test(`${suite}: ${retirement} cancels pending session lookup even if it returns A`, async () => {
      const f = await uploadFixture(suite);
      const lookup = deferred<any>();
      const entered = deferred<void>();
      f.w.getSession = () => {
        entered.resolve();
        return lookup.promise;
      };
      try {
        await startUpload(
          f.w,
          suite,
          'image',
          new File(['private'], 'A.png', { type: 'image/png' }),
        );
        await entered.promise;
        if (retirement === 'unmount')
          await f.w.fx.act(async () => f.w.fx.unmount());
        else {
          await f.w.fx.act(async () => {
            f.w.owner = 'B';
            f.w.fx.render();
          });
          if (retirement === 'A-B-A')
            await f.w.fx.act(async () => {
              f.w.owner = 'A';
              f.w.fx.render();
            });
        }
        await f.w.fx.act(async () => lookup.resolve(session('A')));
        assert.equal(f.requests.length, 0);
        assert.equal(f.w.notices.length, 0);
      } finally {
        await f.dispose();
      }
    });
  }

  for (const result of [
    'wrong-account',
    'missing-session',
    'session-error',
  ] as const) {
    test(`${suite}: ${result} fails closed before HTTP even before the UI switches accounts`, async () => {
      const f = await uploadFixture(suite);
      f.w.getSession = async () =>
        result === 'wrong-account'
          ? session('B')
          : {
              data: { session: null },
              error:
                result === 'session-error'
                  ? new Error('session unavailable')
                  : null,
            };
      try {
        await startUpload(
          f.w,
          suite,
          'video',
          new File(['private'], 'A.mp4', { type: 'video/mp4' }),
        );
        await settle(
          f.w,
          () => f.w.notices.length === 1,
          'current owner receives a retryable upload error',
        );
        assert.equal(f.requests.length, 0);
        const asset =
          suite === 'main'
            ? f.w.probe.inputAssets.reference_video_urls[0]
            : f.w.probe.elements[0].video;
        assert.equal(asset.status, 'error');
      } finally {
        await f.dispose();
      }
    });
  }

  test(`${suite}: account change aborts an in-flight part and prevents continuation or stale notices`, async () => {
    const f = await uploadFixture(suite);
    const part = deferred<Response>();
    const requests: { url: string; init: RequestInit }[] = [];
    f.w.fetch = async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith('/start'))
        return Response.json({
          ok: true,
          upload: {
            uploadId: 'A-upload',
            key: 'A.mp4',
            chunkSizeBytes: 3670016,
          },
        });
      if (url.endsWith('/part')) return part.promise;
      throw new Error('Unexpected continuation: ' + url);
    };
    try {
      await startUpload(
        f.w,
        suite,
        'video',
        new File([new Uint8Array(8 * 1024 * 1024)], 'A.mp4', {
          type: 'video/mp4',
        }),
      );
      await settle(
        f.w,
        () => requests.some((r) => r.url.endsWith('/part')),
        'first part starts',
      );
      await f.w.fx.act(async () => {
        f.w.owner = 'B';
        f.w.fx.render();
      });
      assert.ok(
        requests.every((r) => r.init.signal?.aborted),
        'network receives cancellation for retired owner',
      );
      await f.w.fx.act(async () =>
        part.resolve(
          Response.json({
            ok: true,
            part: {
              partNumber: 1,
              etag: 'part-1',
              key: 'part-1',
              size: 3670016,
            },
          }),
        ),
      );
      assert.equal(
        requests.length,
        2,
        'no next part, completion or cleanup may run as B',
      );
      assert.equal(f.w.notices.length, 0);
      assert.ok(
        requests.every(
          (r) =>
            new Headers(r.init.headers).get('Authorization') ===
            'Bearer token-A',
        ),
      );
    } finally {
      await f.dispose();
    }
  });
}

for (const suite of ['main', 'kling'] as const) {
  test(`${suite}: route departure still cleans acknowledged chunks as the original owner`, async () => {
    const f = await uploadFixture(suite);
    const secondPart = deferred<Response>();
    const requests: { url: string; init: RequestInit }[] = [];
    f.w.fetch = async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith('/start'))
        return Response.json({
          ok: true,
          upload: {
            uploadId: 'A-upload',
            key: 'A.mp4',
            chunkSizeBytes: 3670016,
          },
        });
      if (url.endsWith('/part')) {
        const n = Number((init.body as FormData).get('partNumber'));
        if (n === 2) return secondPart.promise;
        return Response.json({
          ok: true,
          part: { partNumber: n, etag: 'part-1', key: 'part-1', size: 3670016 },
        });
      }
      if (url.endsWith('/abort')) return Response.json({ ok: true });
      throw new Error('Unexpected request ' + url);
    };
    try {
      await startUpload(
        f.w,
        suite,
        'video',
        new File([new Uint8Array(8 * 1024 * 1024)], 'A.mp4', {
          type: 'video/mp4',
        }),
      );
      await settle(
        f.w,
        () => requests.length === 3,
        'second part starts after first acknowledgment',
      );
      await f.w.fx.act(async () => f.w.fx.unmount());
      assert.equal(requests[2].init.signal?.aborted, true);
      await f.w.fx.act(async () =>
        secondPart.reject(new f.w.DOMException('aborted', 'AbortError')),
      );
      await settle(
        f.w,
        () => requests.some((r) => r.url.endsWith('/abort')),
        'acknowledged chunks cleaned after unmount',
      );
      const cleanup = requests.at(-1)!;
      assert.equal(
        new Headers(cleanup.init.headers).get('Authorization'),
        'Bearer token-A',
      );
      assert.equal(cleanup.init.credentials, 'omit');
      assert.equal(cleanup.init.signal?.aborted, false);
      assert.deepEqual(JSON.parse(cleanup.init.body as string).parts, [
        { partNumber: 1, etag: 'part-1', key: 'part-1', size: 3670016 },
      ]);
      assert.equal(f.w.notices.length, 0);
    } finally {
      await f.dispose();
    }
  });
}
