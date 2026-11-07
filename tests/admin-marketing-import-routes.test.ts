import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { publicationManifest } from './helpers/marketing-publication-fixture';

const maxBodyBytes = 2 * 1024 ** 2;
const dixie = '5833eee1-6c61-451c-a455-a5b08716cffc';
const paths = [
  '/', '/fr', '/es',
  '/tools/character-builder', '/fr/outils/character-builder', '/es/herramientas/character-builder',
  '/examples', '/fr/galerie', '/es/galeria',
  '/blog/ai-character-sheet-generator', '/fr/blog/generateur-de-fiche-personnage-ia', '/es/blog/generador-de-fichas-de-personaje-con-ia',
  '/blog/how-to-create-consistent-ai-characters', '/fr/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video',
  '/es/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video',
  '/en', '/en/tools/character-builder', '/fr/tools/character-builder', '/es/tools/character-builder',
  '/en/examples', '/fr/examples', '/es/examples',
  '/en/blog/ai-character-sheet-generator', '/en/blog/how-to-create-consistent-ai-characters',
];
const preview = { videoId: dixie, name: 'Vesper', durationSec: 14, resolution: '720 × 1280', width: 720, height: 1280, fileCount: 4 };

type ItemHandler = (req: Request, props: { params: Promise<{ playlistId: string }> }) => Promise<Response>;
type VisibilityHandler = (req: Request, props: { params: Promise<{ videoId: string }> }) => Promise<Response>;
type FixtureRoutes = {
  ingest: (req: Request) => Promise<Response>;
  visibility: VisibilityHandler;
  append: ItemHandler;
  remove: ItemHandler;
  reorder: ItemHandler;
  updatePlaylist: ItemHandler;
  deletePlaylist: ItemHandler;
  projectItem: (row: unknown) => { sourceKind: string };
};

async function fixture(t: import('node:test').TestContext, includeImport: boolean) {
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const directory = mkdtempSync(join(tmpdir(), 'marketing-import-routes-'));
  const state = {
    authorization: 200, rejectWrite: false, rejectCache: false,
    events: [] as string[], imports: [] as unknown[],
    playlists: new Map([
      ['character', { slug: 'character-studio-recast', isPublic: true }],
      ['unrelated', { slug: 'other-playlist', isPublic: true }],
    ]),
  };
  const globals = globalThis as typeof globalThis & { __marketingAdminRoutes?: typeof state };
  globals.__marketingAdminRoutes = state;
  t.after(() => {
    delete globals.__marketingAdminRoutes;
    rmSync(directory, { recursive: true, force: true });
  });
  const output = join(directory, 'routes.cjs');
  const mocks: Record<string, string> = {
    '@/server/admin': `const f=()=>globalThis.__marketingAdminRoutes;
      export async function requireAdmin(){if(f().authorization!==200)throw Object.assign(Error('Not authorized'),{status:f().authorization});return 'existing-admin';}
      export function adminErrorToResponse(error){return Response.json({ok:false,error:error.message},{status:error.status??500});}`,
    '@/lib/db': `export const isDatabaseConfigured=()=>true;
      export const query=async()=>{throw Error('Unexpected separate database read');};
      export const withDbTransaction=()=>{throw Error('Unexpected database mutation');};`,
    '@/server/owned-media-read-access': `export const createOwnedMediaReadUrl=()=>{throw Error('Unexpected storage access');};`,
    '@/server/marketing-media/import-publication': `import {prepareMarketingPublicationImport} from '@/server/marketing-media/import-publication-manifest';
      const f=()=>globalThis.__marketingAdminRoutes;
      export function previewMarketingPublicationImport(manifest) {
        f().events.push('preview');
        return prepareMarketingPublicationImport(manifest).summary;
      }
      export async function importMarketingPublication(input) {
        f().imports.push(input);
        const {summary}=prepareMarketingPublicationImport(input.manifest);
        f().events.push('import');
        return {videoId:summary.videoId,state:'ready',visibility:'private'};
      }`,
    '@/server/marketing-media/manage': `const f=()=>globalThis.__marketingAdminRoutes;
      export async function updateMarketingVisibility(id,patch){if(f().rejectWrite)throw Error('Update failed');
        f().events.push('visibility');return {job_id:id,visibility:patch.visibility,indexable:patch.indexable};}`,
    '@/server/video-seo-editorial': `export const getResolvedVideoSeoEditorialEntry=async()=>null;`,
    'next/cache': `export const revalidatePath=path=>{
        const state=globalThis.__marketingAdminRoutes;
        if(state.rejectCache)throw Error('Cache unavailable');
        state.events.push(path);
      };`,
    '@/server/playlists/curation-store': `export class CurationError extends Error {status=409;}`,
    '@/server/playlists': `import {CurationError} from '@/server/playlists/curation-store';
      const f=()=>globalThis.__marketingAdminRoutes;
      function commit(action, id) {
        if(f().rejectWrite)throw new CurationError('Rejected');
        f().events.push(action);
        return f().playlists.get(id).slug;
      }
      export const appendPlaylistItem=async id=>commit('append',id);
      export const removePlaylistItem=async id=>commit('remove',id);
      export const reorderPlaylistItems=async id=>commit('reorder',id);
      export const getPlaylist=async()=>{throw Error('Unexpected separate playlist read');};
      export const getPlaylistItems=getPlaylist;
      export const isPlaylistLockedError=error=>error instanceof CurationError;
      export async function updatePlaylist(id, patch) {
        const previousSlug=commit('update',id);
        const playlist=f().playlists.get(id);
        const slug=patch.slug ?? previousSlug;
        const isPublic=patch.isPublic ?? playlist.isPublic;
        f().playlists.set(id,{slug,isPublic});
        return slug !== previousSlug || isPublic !== playlist.isPublic ? {slug,previousSlug} : null;
      }
      export async function deletePlaylist(id) {
        const slug=commit('delete',id);
        f().playlists.delete(id);
        return slug;
      }`,
    '@/lib/indexnow': `export const submitToIndexNow=async()=>{globalThis.__marketingAdminRoutes.events.push('indexnow');};`,
  };
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      ${includeImport ? "export {POST as ingest} from './frontend/app/api/admin/marketing-media/import/route';" : ''}
      export {POST as visibility} from './frontend/app/api/admin/videos/[videoId]/visibility/route';
      export {POST as append, DELETE as remove, PUT as reorder} from './frontend/app/api/admin/playlists/[playlistId]/items/route';
      export {PUT as updatePlaylist, DELETE as deletePlaylist} from './frontend/app/api/admin/playlists/[playlistId]/route';
      export {marketingItem as projectItem} from './frontend/server/marketing-media/store';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'marketing-admin-route-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path in mocks) return { path: args.path, namespace: 'fixture' };
        if (args.path === 'next/server') return { path: requireFrontend.resolve(args.path), external: true };
        if (!args.path.startsWith('.') && !args.path.startsWith('@/') && !args.path.startsWith('node:'))
          return { path: requireFrontend.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: mocks[args.path], loader: 'ts', resolveDir: resolve('frontend'),
      }));
    } }],
    logLevel: 'silent',
  });
  process.env.MARKETING_MEDIA_ENABLED = '1';
  t.after(() => delete process.env.MARKETING_MEDIA_ENABLED);
  return { routes: requireFrontend(output) as FixtureRoutes, state };
}

const importUrl = 'http://localhost/api/admin/marketing-media/import';
function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function lazyBodyRequest(url: string, chunks: Uint8Array[], headers = new Headers()) {
  let pulls = 0;
  let cancelled = false;
  headers.set('Content-Type', 'application/json');
  const request = new Request(url, {
    method: 'POST', headers, duplex: 'half', body: new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[pulls++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }),
  } as RequestInit);
  return { request, pulls: () => pulls, cancelled: () => cancelled };
}

test('admin import gates both preview and copy before reading any body, and bounds actual streamed bytes', async t => {
  const { routes, state } = await fixture(t, true);
  const bytes = new Uint8Array(maxBodyBytes);
  for (const suffix of ['', '?preview=1']) {
    for (const status of [401, 403, 503]) {
      state.authorization = status === 503 ? 200 : status;
      process.env.MARKETING_MEDIA_ENABLED = status === 503 ? '0' : '1';
      const input = lazyBodyRequest(importUrl + suffix, [bytes]);
      assert.equal((await routes.ingest(input.request)).status, status);
      assert.equal(input.pulls(), 0);
    }
  }
  process.env.MARKETING_MEDIA_ENABLED = '1';
  const declaredTooLarge = lazyBodyRequest(importUrl, [bytes], new Headers({ 'Content-Length': String(maxBodyBytes + 1) }));
  assert.equal((await routes.ingest(declaredTooLarge.request)).status, 413);
  assert.equal(declaredTooLarge.pulls(), 0);
  for (const headers of [new Headers(), new Headers({ 'Content-Length': '1' })]) {
    const streamed = lazyBodyRequest(importUrl, [bytes, new Uint8Array(1), bytes], headers);
    assert.equal((await routes.ingest(streamed.request)).status, 413);
    assert.equal(streamed.pulls(), 2);
    assert.equal(streamed.cancelled(), true);
  }
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.imports, []);
});

test('preview is read-only, invalid input fails, and the import uses only the authenticated actor', async t => {
  const { routes, state } = await fixture(t, true);
  const wrongType = await routes.ingest(new Request(importUrl, { method: 'POST', body: JSON.stringify({ manifest: publicationManifest(dixie), permissionConfirmed: true }) }));
  assert.equal(wrongType.status, 415);
  const malformed = await routes.ingest(new Request(importUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"manifest":' }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(state.events, []);
  for (const invalid of [null, [], {}]) {
    assert.equal((await routes.ingest(jsonRequest(importUrl, invalid))).status, 400);
  }
  const invalidPreview = await routes.ingest(jsonRequest(importUrl + '?preview=1', { manifest: {} }));
  assert.equal(invalidPreview.status, 400);
  assert.match((await invalidPreview.json()).error, /manifest/i);
  const manifest = publicationManifest(dixie);
  assert.equal((await routes.ingest(jsonRequest(importUrl + '?preview=true', { manifest, permissionConfirmed: true }))).status, 400);
  const validPreview = await routes.ingest(jsonRequest(importUrl + '?preview=1', { manifest, permissionConfirmed: true }));
  assert.equal(validPreview.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await validPreview.json(), { ok: true, preview });
  assert.deepEqual(state.events, ['preview', 'preview']);
  assert.deepEqual(state.imports, []);
  state.events.length = 0;
  for (const permissionConfirmed of [undefined, false, 'true']) {
    const noPermission = await routes.ingest(jsonRequest(importUrl, { manifest, permissionConfirmed }));
    assert.equal(noPermission.status, 403);
  }
  assert.deepEqual(state.imports, []);
  const badManifest = await routes.ingest(jsonRequest(importUrl, { manifest: {}, permissionConfirmed: true }));
  assert.equal(badManifest.status, 400);
  assert.deepEqual(state.events, []);
  state.imports.length = 0;
  const imported = await routes.ingest(jsonRequest(importUrl, { manifest, permissionConfirmed: true, actorId: 'forged' }));
  assert.equal(imported.status, 200);
  assert.deepEqual(await imported.json(), { ok: true, item: { videoId: dixie, state: 'ready', visibility: 'private' } });
  assert.deepEqual(state.imports, [{ manifest, actorId: 'existing-admin', permissionConfirmed: true }]);
  assert.equal(state.events[0], 'import');
});

test('visibility and direct playlist edits refresh exact Character routes only after a successful write', async t => {
  const { routes, state } = await fixture(t, false);
  const request = (visibility: string) => jsonRequest('http://localhost/api/admin/videos/selected/visibility', { visibility });
  const videoProps = (videoId: string) => ({ params: Promise.resolve({ videoId }) });
  const itemProps = (playlistId: string) => ({ params: Promise.resolve({ playlistId }) });
  const itemUrl = 'http://localhost/api/admin/playlists/selected/items';
  const expected = [...paths].sort();
  for (const visibility of ['public', 'private']) {
    state.events.length = 0;
    assert.equal((await routes.visibility(request(visibility), videoProps(dixie))).status, 200);
    assert.equal(state.events[0], 'visibility');
    assert.deepEqual(state.events.slice(1).filter(path => !/^(\/video\/|\/sitemap-video|\/api\/sitemap-video)/.test(path)).sort(), expected);
    assert.ok(state.events.includes('/video/' + dixie));
  }
  state.events.length = 0;
  assert.equal((await routes.visibility(request('public'), videoProps('unrelated-video'))).status, 200);
  assert.ok(!state.events.some(path => paths.includes(path)));
  const actions = [
    ['append', routes.append, jsonRequest(itemUrl, { videoId: dixie })],
    ['remove', routes.remove, jsonRequest(itemUrl, { videoId: dixie }, 'DELETE')],
    ['reorder', routes.reorder, jsonRequest(itemUrl, [{ videoId: 'remaining-item' }], 'PUT')],
  ] as const;
  for (const [name, act, req] of actions) {
    state.events.length = 0;
    assert.equal((await act(req.clone(), itemProps('character'))).status, 200);
    assert.equal(state.events[0], name, 'the write commits before any refresh or IndexNow notification');
    assert.equal(state.events.at(-1), 'indexnow');
    assert.deepEqual(state.events.filter(path => path.startsWith('/')).sort(), expected);
    state.events.length = 0;
    assert.equal((await act(req.clone(), itemProps('unrelated'))).status, 200);
    assert.deepEqual(state.events, [name, 'indexnow']);
    state.events.length = 0;
    state.rejectCache = true;
    assert.equal((await act(req.clone(), itemProps('character'))).status, 200);
    assert.deepEqual(state.events, [name, 'indexnow'], 'a cache failure must not report a committed edit as failed or skip IndexNow');
    state.rejectCache = false;
    state.events.length = 0;
    state.authorization = 403;
    assert.equal((await act(req.clone(), itemProps('character'))).status, 403);
    assert.deepEqual(state.events, []);
    state.authorization = 200;
    state.rejectWrite = true;
    assert.equal((await act(req, itemProps('character'))).status, 409);
    assert.deepEqual(state.events, []);
    state.rejectWrite = false;
  }
});

test('successful Character playlist visibility changes, slug changes and deletion refresh exact pages', async t => {
  const { routes, state } = await fixture(t, false);
  const props = { params: Promise.resolve({ playlistId: 'character' }) };
  const url = 'http://localhost/api/admin/playlists/character';
  for (const [patch, refresh] of [
    [{ isPublic: false }, true],
    [{ isPublic: false }, false],
    [{ isPublic: true }, true],
    [{ name: 'New display name' }, false],
    [{ slug: 'renamed-character-playlist' }, true],
    [{ isPublic: false }, false],
    [{ slug: 'character-studio-recast' }, true],
  ] as const) {
    state.events.length = 0;
    const response = await routes.updatePlaylist(jsonRequest(url, patch, 'PUT'), props);
    assert.equal(response.status, 200);
    assert.equal(state.events[0], 'update');
    assert.deepEqual(state.events.slice(1).sort(), refresh ? [...paths].sort() : []);
  }
  state.events.length = 0;
  state.rejectWrite = true;
  assert.equal((await routes.updatePlaylist(jsonRequest(url, { isPublic: true }, 'PUT'), props)).status, 409);
  assert.equal((await routes.deletePlaylist(new Request(url, { method: 'DELETE' }), props)).status, 409);
  assert.deepEqual(state.events, []);
  assert.equal(state.playlists.get('character')?.isPublic, false);
  state.rejectWrite = false;
  const response = await routes.deletePlaylist(new Request(url, { method: 'DELETE' }), props);
  assert.equal(response.status, 200);
  assert.equal(state.playlists.has('character'), false);
  assert.equal(state.events[0], 'delete');
  assert.deepEqual(state.events.slice(1).sort(), [...paths].sort());
});

test('the admin item projection distinguishes failed imports from original-job copies', async t => {
  const { routes } = await fixture(t, false);
  const row = { video_id: dixie, state: 'failed', source_record: { job: {} }, size_bytes: 0, created_at: '2026-11-07', publication: {} };
  assert.equal(routes.projectItem(row).sourceKind, 'job');
  assert.equal(routes.projectItem({ ...row, source_record: { ...row.source_record, schemaVersion: 'maxvideoai-marketing-publication/v1' } }).sourceKind, 'import');
});
