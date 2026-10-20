import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

async function fixture() {
  const state = { unavailable: '' as '' | 'resolve' | 'sign', users: [] as string[] };
  const root = resolve('frontend');
  const stubs: Record<string, string> = {
    '@/server/studio/media-resolver': 'export async function resolveStudioMedia(userId,ref){state.users.push(userId);if(state.unavailable==="resolve")throw Error("removed");return ref;}',
    '@/server/studio/conversation-media-read-access': 'export async function createConversationMediaReadAccess(){if(state.unavailable==="sign")throw Error("signing");return {url:"https://owned.invalid/signed?token=fresh",thumbnailAccessUrl:"https://owned.invalid/thumb?token=fresh",expires:123};}',
  };
  const built = await build({ absWorkingDir: root, entryPoints: ['src/server/tools/creator-media-access.ts'], tsconfig: resolve(root, 'tsconfig.json'),
    bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', plugins: [{ name: 'media-access-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    } }] });
  const module = { exports: {} as any };
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports, require: createRequire(resolve(root, 'package.json')), state, process, Error });
  return { ...module.exports, state };
}
const ref = { type: 'asset', assetId: 'ma_11111111111111111111111111111111', kind: 'video' };
test('creator presentation refreshes owned read URLs without changing originals or operation identity', async () => {
  const { withCreatorMediaReadAccess, state } = await fixture();
  for (const result of [{ outputs: [{ asset: ref, originalUrl: 'https://owned.invalid/original' }] }, { ref, originalUrl: 'https://owned.invalid/original' }]) {
    const operation = { operationId: 'attempt', state: 'completed', result };
    const presented = await withCreatorMediaReadAccess('owner', operation);
    const output = presented.result.outputs?.[0] ?? presented.result;
    assert.equal(output.originalUrl, 'https://owned.invalid/original');
    assert.equal(output.readUrl, 'https://owned.invalid/signed?token=fresh');
    assert.equal(output.artifactDelivery, 'available');
    assert.equal(presented.operationId, 'attempt');
    assert.equal(presented.state, 'completed');
    assert.equal((result as any).readUrl, undefined, 'Presentation must not mutate persisted data.');
  }
  assert.deepEqual(state.users, ['owner', 'owner']);
});
test('removed output and signing downtime keep a completed job recoverable without a stale readable URL', async () => {
  const { withCreatorMediaReadAccess, state } = await fixture();
  for (const unavailable of ['resolve', 'sign']) {
    state.unavailable = unavailable;
    const presented = await withCreatorMediaReadAccess('owner', { state: 'completed', result: { ref, originalUrl: 'https://owned.invalid/original' } });
    assert.equal(presented.state, 'completed');
    assert.equal(presented.result.readUrl, null);
    assert.equal(presented.result.artifactDelivery, 'unavailable');
  }
});
test('recovery refreshes every original source and its explicit segment without preparing another attempt', async () => {
  const { withCreatorMediaReadAccess, state } = await fixture();
  const input = {version:1,toolId:'product-video-editor',profileId:'product-video-wan-v1',settings:{},inputs:[{role:'source',source:ref,segment:{startSec:2,endSec:7}}]};
  const presented = await withCreatorMediaReadAccess('owner',{operationId:'attempt',status:'running',input,result:null});
  assert.equal(presented.sourceMedia.length,1);
  assert.equal(presented.sourceMedia[0].role,'source');
  assert.deepEqual(JSON.parse(JSON.stringify(presented.sourceMedia[0].ref)),ref);
  assert.deepEqual(JSON.parse(JSON.stringify(presented.sourceMedia[0].segment)),{startSec:2,endSec:7});
  assert.equal(presented.sourceMedia[0].readUrl,'https://owned.invalid/signed?token=fresh');
  state.unavailable='resolve';
  const removed=await withCreatorMediaReadAccess('owner',{status:'completed',input,result:null});
  assert.equal(removed.sourceMedia[0].readUrl,null);
  assert.equal(removed.status,'completed');
});
test('a prepared subtitle recovery gets owner-scoped source access without persisting a signed URL',async()=>{
  const {withCreatorMediaReadAccess,state}=await fixture();
  const operation={operationId:'attempt',state:'prepared',subtitle:{source:ref,settings:{language:'fr',keyterms:['MaxVideoAI']},document:{id:'captions',revision:2}}};
  const presented=await withCreatorMediaReadAccess('owner',operation);
  assert.deepEqual(state.users,['owner']);
  assert.equal(presented.subtitle.sourceMedia.readUrl,'https://owned.invalid/signed?token=fresh');
  assert.equal(presented.subtitle.document.revision,2);
  assert.equal('sourceMedia' in operation.subtitle,false);
  state.unavailable='resolve';
  const removed=await withCreatorMediaReadAccess('owner',operation);
  assert.equal(removed.subtitle.sourceMedia.readUrl,null);
  assert.equal(removed.state,'prepared');
});
