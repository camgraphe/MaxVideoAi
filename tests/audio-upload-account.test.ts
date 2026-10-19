import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const bundle = build({
  stdin: {
    contents: "import {uploadAsset} from './frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-helpers';window.uploadAudio=uploadAsset;",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'browser', format: 'iife',
  tsconfig: 'frontend/tsconfig.json',
  plugins: [{ name: 'session-boundary', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/supabaseClient$/ }, () => ({ path: 'session', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase={auth:{getSession:()=>window.getSession()}};' }));
  } }],
}).then(result => result.outputFiles[0].text);

async function fixture() {
  const dom = new JSDOM('', { url: 'http://localhost/app/audio', runScripts: 'outside-only' });
  const w = dom.window as any;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  w.Headers = Headers;
  w.sessionStorage.setItem('last-known:user-id', 'A');
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null });
  w.fetch = async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ ok: true, asset: { url: 'https://example.invalid/owned.wav', name: 'Owned audio' } }));
  };
  w.eval(await bundle);
  const controller = new w.AbortController();
  const upload = (options: unknown = { expectedUserId: 'A', signal: controller.signal }) =>
    w.uploadAudio(new w.File(['synthetic'], 'private-A.wav', { type: 'audio/wav' }), 'audio', options) as Promise<unknown>;
  return { w, requests, controller, upload, close: () => w.close() };
}

for (const session of [null, { user: { id: 'B' }, access_token: 'token-B' }]) {
  test(`real audio transport refuses ${session ? 'another account' : 'a missing session'} before dispatch`, async () => {
    const f = await fixture();
    try {
      f.w.getSession = async () => ({ data: { session }, error: null });
      await assert.rejects(f.upload());
      assert.deepEqual(f.requests, []);
    } finally { f.close(); }
  });
}

test('a session lookup completing after cancellation cannot dispatch audio', async () => {
  const f = await fixture();
  let resolve!: (value: unknown) => void;
  let entered!: () => void;
  const ready = new Promise<void>(r => { entered = r; });
  f.w.getSession = () => { entered(); return new Promise(r => { resolve = r; }); };
  try {
    const pending = assert.rejects(f.upload(), { name: 'AbortError' });
    await ready;
    f.controller.abort();
    resolve({ data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null });
    await pending;
    assert.deepEqual(f.requests, []);
  } finally { f.close(); }
});

test('audio dispatch uses the selecting account bearer, omits ambient cookies and forwards cancellation', async () => {
  const f = await fixture();
  try {
    let sessionReads = 0;
    f.w.getSession = async () => { sessionReads++; return { data: { session: { user: { id: 'A' }, access_token: 'token-A' } }, error: null }; };
    await f.upload();
    assert.equal(f.requests.length, 1);
    const { url, init } = f.requests[0];
    assert.equal(url, '/api/uploads/audio');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer token-A');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.signal, f.controller.signal);
    const file = (init.body as FormData).get('file');
    assert.ok(file && typeof file !== 'string');
    assert.equal(file.name, 'private-A.wav');
    assert.equal(sessionReads, 1, 'explicit bearer must avoid a second ambient session read in authFetch');
  } finally { f.close(); }
});

test('audio callers cannot silently fall back to an ambient session without ownership options', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.w.uploadAudio(new f.w.File(['synthetic'], 'unowned.wav'), 'audio'));
    assert.deepEqual(f.requests, []);
  } finally { f.close(); }
});
