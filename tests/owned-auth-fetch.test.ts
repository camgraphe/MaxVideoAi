import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

const bundle = bundleClientFlow(`
  import {ownedAuthFetch} from './src/lib/owned-auth-fetch';
  import {fetchMediaLibraryAssets} from './lib/media-library-client';
  import {recentOutputsFetcher} from './app/(core)/(workspace)/app/library/_lib/library-page-helpers';
  window.api = {ownedAuthFetch, fetchMediaLibraryAssets, recentOutputsFetcher};
`, { '@/lib/supabaseClient': 'export const supabase={auth:{getSession:()=>window.getSession()}};' });

async function fixture() {
  const dom = createClientFlowDom('/app/library');
  const w = dom.window as any;
  const requests: Array<{url: string; init: RequestInit}> = [];
  let sessionReads = 0;
  w.sessionStorage.setItem('last-known:user-id', 'B');
  w.getSession = async () => {
    sessionReads++;
    return {data:{session:{user:{id:'A'},access_token:'token-A'}},error:null};
  };
  w.fetch = async (url: string, init: RequestInit) => {
    requests.push({url, init});
    return new Response(JSON.stringify({ok:true,assets:[],outputs:[],nextCursor:'next-page'}));
  };
  w.eval(await bundle);
  return {w,requests,sessionReads:()=>sessionReads,close:()=>w.close()};
}

for (const reader of ['fetchMediaLibraryAssets', 'recentOutputsFetcher']) {
  for (const state of ['missing', 'different', 'error', 'tokenless']) {
    test(`${reader} refuses ${state} sessions instead of reading media with ambient credentials`, async () => {
      const f = await fixture();
      try {
        f.w.getSession = async () => ({
          data:{session:state === 'missing' ? null : {user:{id:state === 'different' ? 'B' : 'A'},access_token:state === 'tokenless' ? '' : 'token'}},
          error:state === 'error' ? new Error('refresh failed') : null,
        });
        await assert.rejects(f.w.api[reader](['/api/media-library/assets?kind=image&cursor=page2', 'A']), {code:'UNAUTHORIZED'});
        assert.deepEqual(f.requests, []);
      } finally { f.close(); }
    });
  }

  test(`${reader} preserves pagination and uses its key's account bearer without cookie fallback`, async () => {
    const f = await fixture();
    try {
      const url = reader === 'fetchMediaLibraryAssets'
        ? '/api/media-library/assets?kind=image&cursor=page2'
        : '/api/media-library/recent-outputs?kind=audio&cursor=page2';
      const result = await f.w.api[reader]([url, 'A']);
      assert.equal(result.nextCursor, 'next-page');
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, url);
      assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'), 'Bearer token-A');
      assert.equal(f.requests[0].init.credentials, 'omit');
      assert.equal(f.sessionReads(), 1, 'authFetch must not resolve ambient auth a second time');
    } finally { f.close(); }
  });
}

test('owned transport refuses an absent owner before resolving a session', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.w.api.ownedAuthFetch('/api/uploads/image', null), {code:'UNAUTHORIZED'});
    assert.equal(f.sessionReads(), 0);
    assert.deepEqual(f.requests, []);
  } finally { f.close(); }
});

test('canceling a deferred session blocks dispatch even when it resolves to the expected account', async () => {
  const f = await fixture(); const session = deferred<any>(); const entered = deferred<void>();
  try {
    f.w.getSession = () => {entered.resolve(); return session.promise;};
    const controller = new f.w.AbortController();
    const pending = assert.rejects(f.w.api.ownedAuthFetch('/api/uploads/image', 'A', {signal:controller.signal}), {name:'AbortError'});
    await entered.promise;
    controller.abort();
    session.resolve({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});
    await pending;
    assert.deepEqual(f.requests, []);
  } finally { f.close(); }
});
