import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import test, {type TestContext} from 'node:test';
import dns from 'node:dns/promises';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import type {ClientRequest,IncomingMessage} from 'node:http';

process.env.S3_BUCKET = 'facts-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'facts-fixture-key';
process.env.S3_SECRET_ACCESS_KEY = 'facts-fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://facts-fixture.s3.us-east-1.amazonaws.com';
process.env.VIDEO_RENDER_STORAGE_PREFIX = '';
process.env.ASSET_MAX_VIDEO_MB = '50';
const original = `${process.env.S3_PUBLIC_BASE_URL}/renders/owner/original.mp4`;
const assetId = `ma_${'1'.repeat(32)}`;
const ref = { type: 'job-output' as const, jobId: 'job', outputId: 'job:video:0', kind: 'video' as const };
const want = { source: 'probe', durationSec: 6, width: 320, height: 180, hasAudio: true };

function mockVideoTransport(t: TestContext, headers: Record<string,string>, chunks: () => AsyncIterable<Buffer>) {
  const state = {requests: 0,response: undefined as IncomingMessage | undefined,timeoutMs: 0};
  t.mock.method(dns,'lookup',async () => [{address: '8.8.8.8',family: 4}]);
  t.mock.method(https,'request',(...args: unknown[]) => {
    const [url,options,callback] = args as [URL,https.RequestOptions,(response: IncomingMessage) => void];
    assert.equal(url.hostname,'facts-fixture.s3.us-east-1.amazonaws.com');
    assert.equal(options.method,'GET');
    assert.equal(typeof options.lookup,'function','The actual downloader must retain its pinned lookup.');
    state.requests++;
    const response = Readable.from(chunks(),{highWaterMark: 1}) as IncomingMessage;
    response.statusCode = 200; response.headers = headers;
    state.response = response;
    const request = new EventEmitter() as ClientRequest;
    Object.assign(request,{
      setTimeout(timeout: number) {state.timeoutMs = timeout; return request;},
      end() {queueMicrotask(() => callback(response)); return request;},
      destroy(error?: Error) {if (error) request.emit('error',error); return request;},
    });
    return request;
  });
  return state;
}

async function fixture() {
  const { inspectSourceVideo } = await import('../frontend/src/server/audio/source-video-probe');
  const { createReferenceFileDownloader } = await import('../frontend/src/server/agent-api/reference-file-download');
  const bytes = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const state = {
    downloads: 0, writes: [] as unknown[], afterInspect: () => {},
    output: { id: ref.outputId, job_id: 'job', user_id: 'owner', job_user_id: 'owner', job_status: 'completed', hidden: false, kind: 'video', status: 'ready', mime_type: 'video/mp4', url: original, storage_url: null, metadata: { legacy: true, durationSec: 5 } as Record<string, unknown> },
    asset: { id: 'asset', public_id: assetId, user_id: 'owner', kind: 'video', status: 'ready', url: `${process.env.S3_PUBLIC_BASE_URL}/media-assets/owner/library-copy.mp4`, mime_type: 'video/mp4', metadata: { originUrl: original, durationSec: 5, mcpGenerated: true } as Record<string, unknown>, source_job_id: 'job', source_output_id: ref.outputId, source_output_user_id: 'owner', source_output_status: 'ready', source_output_job_id: 'job', job_user_id: 'owner', hidden: false },
  };
  const query = async <T>(sql: string, values: readonly unknown[] = []): Promise<T[]> => {
    if (sql.includes('SELECT o.*')) return [state.output] as T[];
    if (sql.includes('SELECT a.*')) return [state.asset] as T[];
    state.writes.push({ sql, values });
    if (sql.includes('WITH measured')) {
      assert.match(sql, /o\.user_id = \$1/); assert.match(sql, /j\.user_id = \$1/);
      assert.match(sql, /COALESCE\(o\.storage_url, o\.url\) = \$4/);
      assert.match(sql, /j\.hidden IS NOT TRUE/); assert.match(sql, /o\.status = 'ready'/);
      assert.match(sql, /a\.source_output_id = measured\.id/); assert.match(sql, /a\.user_id = measured\.user_id/);
      assert.match(sql, /a\.metadata->>'originUrl' = \$4/); assert.match(sql, /a\.deleted_at IS NULL/);
      if (state.output.user_id !== values[0] || state.output.job_user_id !== values[0] || state.output.status !== 'ready' || state.output.hidden || (state.output.storage_url || state.output.url) !== values[3]) return [];
      const facts = JSON.parse(String(values[4])); state.output.metadata.mediaFacts = facts;
      if (state.asset.metadata.originUrl === values[3] && state.asset.user_id === values[0] && state.asset.source_output_id === values[1]) state.asset.metadata.mediaFacts = facts;
      return [{ id: state.output.id }] as T[];
    }
    if (sql.includes('UPDATE media_assets a')) {
      assert.match(sql, /a\.user_id = \$1/); assert.match(sql, /a\.url = \$3/);
      assert.match(sql, /source_output\.user_id = \$1/); assert.match(sql, /j\.hidden IS NOT TRUE/);
      if (state.asset.user_id !== values[0] || state.asset.url !== values[2] || state.asset.status !== 'ready') return [];
      state.asset.metadata.mediaFacts = JSON.parse(String(values[3])); return [{ id: state.asset.id }] as T[];
    }
    throw new Error('Unexpected offline persistence query');
  };
  const download = createReferenceFileDownloader({
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 }],
    openPinnedHttps: async url => {
      state.downloads++;
      assert.equal(url.hostname, 'facts-fixture.s3.us-east-1.amazonaws.com');
      assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
      assert.ok(url.searchParams.get('X-Amz-Signature'));
      return { statusCode: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) }, body: (async function* () { yield bytes; })() };
    },
  }, { accepted: ['video/mp4'], maxBytes: bytes.length });
  const inspectVideo = async (url: string) => {
    const facts = await inspectSourceVideo(url, { download });
    state.afterInspect(); return facts;
  };
  return { state, query, dependencies: { query, inspectVideo } };
}

test('already-ready private video bytes establish canonical facts for the exact output and its matching library copy', async () => {
  const module = await import('../frontend/server/media-library/owned-video-facts').catch(() => null);
  assert.ok(module?.hydrateOwnedVideoMediaFacts, 'A shared measured-video repair owner is required.');
  const { state, query, dependencies } = await fixture();
  const facts = await module.hydrateOwnedVideoMediaFacts({ userId: 'owner', ref, expectedUrl: original }, dependencies);
  assert.deepEqual(facts, want); assert.equal(state.downloads, 1);
  assert.deepEqual(state.output.metadata.mediaFacts, want); assert.deepEqual(state.asset.metadata.mediaFacts, want);
  assert.equal(state.output.metadata.durationSec, 5, 'Requested history is not relabeled as measured duration.');
  const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
  const resolved = await resolveStudioMedia('owner', ref, query as any);
  assert.deepEqual(resolved.mediaFacts, want); assert.equal(resolved.url, original);
  assert.doesNotMatch(inspect(state.writes, { depth: 10 }), /X-Amz-|facts-fixture-secret/);
  await module.hydrateOwnedVideoMediaFacts({ userId: 'owner', ref }, dependencies);
  assert.equal(state.downloads, 1, 'Complete measured facts do not need another read.');
});

test('foreign, hidden, unready and changed originals cannot grant access or attach measured facts', async () => {
  const module = await import('../frontend/server/media-library/owned-video-facts').catch(() => null);
  assert.ok(module?.hydrateOwnedVideoMediaFacts);
  for (const scenario of ['foreign', 'foreign-job', 'hidden', 'unready', 'foreign-key', 'changed-before', 'changed-during'] as const) {
    const { state, dependencies } = await fixture();
    if (scenario === 'foreign') state.output.user_id = 'other';
    if (scenario === 'foreign-job') state.output.job_user_id = 'other';
    if (scenario === 'hidden') state.output.hidden = true;
    if (scenario === 'unready') state.output.status = 'pending';
    if (scenario === 'foreign-key') state.output.url = original.replace('/owner/', '/other/');
    if (scenario === 'changed-before') state.output.url = original.replace('original', 'new-original');
    if (scenario === 'changed-during') state.afterInspect = () => { state.output.url = original.replace('original', 'new-original'); };
    await assert.rejects(module.hydrateOwnedVideoMediaFacts({ userId: 'owner', ref, expectedUrl: scenario === 'foreign-key' ? state.output.url : original }, dependencies), /MEDIA_NOT_AVAILABLE/);
    assert.equal(state.downloads, scenario === 'changed-during' ? 1 : 0); assert.equal(state.output.metadata.mediaFacts, undefined); assert.equal(state.asset.metadata.mediaFacts, undefined);
  }
});

test('owned asset insert sources can measure their own original without transferring facts to another output URL', async () => {
  const module = await import('../frontend/server/media-library/owned-video-facts').catch(() => null);
  assert.ok(module?.hydrateOwnedVideoMediaFacts);
  const { state, dependencies } = await fixture();
  const measured = await module.hydrateOwnedVideoMediaFacts({ userId: 'owner', ref: { type: 'asset', assetId, kind: 'video' } }, dependencies);
  assert.deepEqual(measured, want); assert.deepEqual(state.asset.metadata.mediaFacts, want); assert.equal(state.output.metadata.mediaFacts, undefined);
});

test('probe failures expose no private grants and write no facts', async () => {
  const module = await import('../frontend/server/media-library/owned-video-facts').catch(() => null);
  assert.ok(module?.hydrateOwnedVideoMediaFacts);
  const { state, dependencies } = await fixture();
  dependencies.inspectVideo = async url => { throw new Error(`ffprobe failure ${url}`); };
  const error = await module.hydrateOwnedVideoMediaFacts({ userId: 'owner', ref }, dependencies).catch(error => error);
  assert.equal(error.message, 'MEDIA_METADATA_REQUIRED'); assert.doesNotMatch(inspect(error), /X-Amz-|facts-fixture/); assert.equal(state.writes.length, 0);
});

test('complete browser and requested declarations still require actual source measurement', async () => {
  const { hydrateOwnedVideoMediaFacts } = await import('../frontend/server/media-library/owned-video-facts');
  for (const source of ['browser', 'requested']) {
    const { state, dependencies } = await fixture();
    state.output.metadata.mediaFacts = { ...want, source, durationSec: 5 };
    assert.deepEqual(await hydrateOwnedVideoMediaFacts({ userId: 'owner', ref }, dependencies), want);
    assert.equal(state.downloads, 1);
  }
});

test('canonical qualification probes a ready owned original above 50 MiB while the audio source upload envelope stays unchanged',async t => {
  const {hydrateOwnedVideoMediaFacts} = await import('../frontend/server/media-library/owned-video-facts');
  const {inspectSourceVideo} = await import('../frontend/src/server/audio/source-video-probe');
  const {state,query} = await fixture();
  const bytes = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  // A valid MP4 free box keeps the fixture's real streams and timing unchanged.
  const sourceBytes = 72_048_956;
  const freeBoxBytes = sourceBytes-bytes.length;
  const freeHeader = Buffer.alloc(8);
  freeHeader.writeUInt32BE(freeBoxBytes); freeHeader.write('free',4,'ascii');
  const padding = Buffer.alloc(freeBoxBytes-8);
  const transport = mockVideoTransport(t,{'content-type': 'video/mp4','content-length': String(sourceBytes)},async function* () {
    yield bytes; yield freeHeader; yield padding;
  });
  const facts = await hydrateOwnedVideoMediaFacts({userId: 'owner',ref,expectedUrl: original},{query});
  assert.deepEqual(facts,want); assert.deepEqual(state.output.metadata.mediaFacts,want);
  assert.deepEqual(state.asset.metadata.mediaFacts,want);
  assert.equal(state.output.url,original); assert.equal(state.output.metadata.durationSec,5);
  assert.equal(transport.requests,1); assert.equal(transport.timeoutMs,30_000);
  assert.equal(transport.response?.destroyed,true);
  await assert.rejects(inspectSourceVideo(original),/private upload limit/,'The global Audio source probe still uses the existing 50 MiB upload envelope.');
});

test('qualification rejects a declared original above 100 MiB before reading its body or saving facts',async t => {
  const {hydrateOwnedVideoMediaFacts} = await import('../frontend/server/media-library/owned-video-facts');
  const {state,query} = await fixture();
  let bodyReads = 0;
  const transport = mockVideoTransport(t,{'content-type': 'video/mp4','content-length': String(100*1024*1024+1)},async function* () {
    bodyReads++; yield Buffer.from('must not be read');
  });
  await assert.rejects(hydrateOwnedVideoMediaFacts({userId: 'owner',ref,expectedUrl: original},{query}),/MEDIA_METADATA_REQUIRED/);
  assert.equal(bodyReads,0); assert.equal(transport.requests,1); assert.equal(transport.response?.destroyed,true);
  assert.equal(state.writes.length,0); assert.equal(state.output.metadata.mediaFacts,undefined);
});

test('qualification cancels an undeclared stream once it exceeds 100 MiB without saving facts',async t => {
  const {hydrateOwnedVideoMediaFacts} = await import('../frontend/server/media-library/owned-video-facts');
  const {state,query} = await fixture();
  const chunk = Buffer.alloc(1024*1024);
  let yieldedChunks = 0;
  const transport = mockVideoTransport(t,{'content-type': 'video/mp4'},async function* () {
    for (let index=0;index<110;index++) {yieldedChunks++; yield chunk;}
  });
  await assert.rejects(hydrateOwnedVideoMediaFacts({userId: 'owner',ref,expectedUrl: original},{query}),/MEDIA_METADATA_REQUIRED/);
  assert.ok(yieldedChunks>=101,'The qualification envelope permits the first 100 MiB before rejecting the excess.');
  assert.ok(yieldedChunks<110,'An over-limit source must stop before the remaining chunks are consumed.');
  assert.equal(transport.response?.destroyed,true); assert.equal(state.writes.length,0);
});
