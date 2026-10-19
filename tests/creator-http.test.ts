import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '../frontend/src/lib/membership-policy';

async function fixture() {
  const state = { enabled: true, userId: 'owner' as string | null, restricted: false };
  const root = resolve('frontend');
  const stubs: Record<string, string> = {
    'server-only': '',
    '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:state.userId});',
    '@/server/fraud-cleanup': 'export const getActiveAccountRestriction=async()=>state.restricted;',
    './creator-availability': 'export const isCreatorExecutionEnabled=()=>state.enabled;',
  };
  const built = await build({ absWorkingDir: root, entryPoints: ['src/server/tools/creator-http.ts'],
    tsconfig: resolve(root, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external',
    plugins: [{ name: 'creator-auth-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    } }],
  });
  const module = { exports: {} as any };
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, require: createRequire(resolve(root, 'package.json')),
    state, process, Buffer, Uint8Array, Object, Error, SyntaxError });
  return { ...module.exports, state };
}
const request = (headers: Record<string, string> = {}) => ({
  method: 'POST', nextUrl: { origin: 'https://maxvideoai.com' }, headers: new Headers(headers),
});
test('creator HTTP authenticates, checks origin/account/gate and current pricing before paid action', async () => {
  const { runCreatorHttp, state } = await fixture();
  let calls = 0;
  const action = async (actor: unknown) => { calls++; return { actor }; };
  const options = { execution: true, charge: true };
  state.enabled = false; assert.equal((await runCreatorHttp(request(), action, options)).status, 404);
  state.enabled = true; state.userId = null; assert.equal((await runCreatorHttp(request(), action, options)).status, 401);
  state.userId = 'owner'; assert.equal((await runCreatorHttp(request({ origin: 'https://attacker.example' }), action, options)).status, 403);
  assert.equal((await runCreatorHttp(request(), action, options)).status, 409);
  const current = { [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION };
  state.restricted = true; assert.equal((await runCreatorHttp(request(current), action, options)).status, 403);
  assert.equal(calls, 0);
  state.restricted = false; const response = await runCreatorHttp(request(current), action, options);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await response.json()).actor, { authMethod: 'toolbox-session', userId: 'owner', clientId: null });
  state.enabled = false; state.restricted = true;
  assert.equal((await runCreatorHttp({ ...request(), method: 'GET' }, action)).status, 200, 'Existing work stays recoverable after execution is closed.');
});
test('creator JSON cancels oversized streams early and HTTP never exposes unexpected error details', async () => {
  const { readCreatorJson, creatorHttpFailure } = await fixture();
  let reads = 0, canceled = false;
  const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(1_000_001)); }, cancel() { canceled = true; } }, { highWaterMark: 0 });
  await assert.rejects(readCreatorJson({ headers: new Headers(), body }), { code: 'PARAMETER_INVALID' });
  assert.equal(canceled, true); assert.equal(reads, 2);
  const response = creatorHttpFailure(new Error('secret connection string'));
  assert.doesNotMatch(JSON.stringify(await response.json()), /secret connection/);
});
