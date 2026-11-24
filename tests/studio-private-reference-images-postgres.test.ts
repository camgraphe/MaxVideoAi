import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import type { ResponseInputContent } from 'openai/resources/responses/responses';
import type { StudioResponseCreator } from '../frontend/src/server/studio/conversation-director';

test('owned upload and saved output use identical bounded pixels for count and dispatch, with replay before any read', async (t) => {
  const host = 'studio-vision-fixture.s3.us-east-1.amazonaws.com';
  const env = {
    S3_BUCKET: 'studio-vision-fixture',
    S3_REGION: 'us-east-1',
    S3_PUBLIC_BASE_URL: 'https://' + host,
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'test',
    ASSISTANT_REVIEW_CONTEXT_ENABLED: 'true',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const { studioTaskFixture } = await import('./helpers/studio-task-fixture');
  const { createStudioTaskService } = await import('../frontend/src/server/studio/tasks/service');
  const { runStudioTaskWorkerOnce } = await import('../frontend/src/server/studio/tasks/worker');
  const { readStudioAssistanceStatus, chooseStudioAssistance } = await import(
    '../frontend/src/server/studio/assistance-ledger'
  );
  const { studioTokenCountInput } = await import('../frontend/src/server/studio/assistance-token-count');
  const { checkpointStudioResponse } = await import('../frontend/src/server/studio/conversation-run-repository');
  const { prepareStudioReferenceImages } = await import('../frontend/src/server/studio/conversation-reference-images');
  const f = await studioTaskFixture(t);
  const actor = await f.actor();
  const selection = await readStudioAssistanceStatus(actor.userId, f.policy);
  await chooseStudioAssistance(actor.userId, { action: 'select_luna', expectedRevision: selection.revision }, f.policy);
  await f.pool.query(`ALTER TABLE studio_conversation_responses ADD COLUMN review_context_json jsonb;
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,status text,metadata jsonb,
      mime_type text,storage_url text,size_bytes bigint,width integer,height integer,updated_at timestamptz);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text UNIQUE,user_id text,kind text,url text,mime_type text,status text,
      deleted_at timestamptz,source_job_id text,source_output_id text,metadata jsonb,size_bytes bigint,width integer,height integer,updated_at timestamptz)`);
  const ids = ['ma_' + '1'.repeat(32), 'ma_' + '2'.repeat(32)];
  const keys = ['user-assets/' + actor.userId + '/upload.png', 'renders/images/' + actor.userId + '/output.png'];
  const urls = keys.map((key) => 'https://' + host + '/' + key);
  await f.pool.query("INSERT INTO app_jobs(job_id,user_id,status,hidden) VALUES('vision-job',$1,'completed',false)", [
    actor.userId,
  ]);
  await f.pool.query(
    "INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,mime_type) VALUES('vision-output','vision-job',$1,'image',$2,'ready','image/png')",
    [actor.userId, urls[1]],
  );
  for (const [index, id] of ids.entries()) {
    await f.pool.query(
      `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,metadata,size_bytes,width,height,source_job_id,source_output_id)
      VALUES ($1,$2,$3,'image',$4,'image/png','ready','{}',512,96,64,$5,$6)`,
      [randomUUID(), id, actor.userId, urls[index], index ? 'vision-job' : null, index ? 'vision-output' : null],
    );
  }
  const sharp = createRequire(resolve('frontend/package.json'))('sharp') as typeof import('sharp');
  const sources = await Promise.all(
    ['blue', 'red'].map((background) =>
      sharp({ create: { width: 96, height: 64, channels: 3, background } })
        .png()
        .toBuffer(),
    ),
  );
  const reads: string[] = [];
  let storage: 'available' | 'forbidden' | 'oversized' | 'corrupt' = 'available';
  t.mock.method(globalThis, 'fetch', async (value: string, init: RequestInit) => {
    const url = new URL(value);
    assert.equal(url.host, host);
    assert.ok(url.searchParams.has('X-Amz-Signature'));
    assert.equal(init.redirect, 'error');
    const key = url.pathname.slice(1);
    reads.push(key);
    const index = keys.indexOf(key);
    assert.ok(index >= 0);
    if (storage === 'forbidden') return new Response(null, { status: 403 });
    if (storage === 'oversized')
      return new Response('body', { headers: { 'content-length': String(30 * 1024 * 1024 + 1) } });
    if (storage === 'corrupt') return new Response('invalid-image');
    return new Response(new Uint8Array(sources[index]));
  });
  const service = createStudioTaskService(actor, { enabled: true, assistancePolicy: f.policy });
  const task = () => ({ ...f.input('standard', 'Describe the two attached images briefly.'), references: ids });
  const first = task();
  const counted: string[] = [];
  let calls = 0;
  const worker = {
    enabled: true,
    assistancePolicy: f.policy,
    serviceOptions: {
      countInputTokens: async (params: Parameters<StudioResponseCreator>[0]) => {
        const input = studioTokenCountInput(params).input;
        const images = JSON.stringify(input).match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g) ?? [];
        assert.equal(images.length, 2);
        assert.notEqual(images[0], images[1]);
        assert.ok(!JSON.stringify(input).includes(host));
        for (const image of images)
          assert.equal((await sharp(Buffer.from(image.split(',')[1], 'base64')).metadata()).format, 'jpeg');
        counted.push(JSON.stringify(input));
        return 500;
      },
      createActionResponse: async (params: Parameters<StudioResponseCreator>[0]) => {
        assert.equal(JSON.stringify(params.input), counted.at(-1));
        calls++;
        return {
          id: 'vision-response-' + calls,
          model: params.model!,
          status: 'completed' as const,
          service_tier: 'default',
          usage: { input_tokens: 500, output_tokens: 32, input_tokens_details: { cached_tokens: 0 } },
          output: [],
          output_text: JSON.stringify({ reply: 'One blue image and one red image.' }),
        };
      },
    },
  };
  await service.enqueue(first, 'mobile');
  await runStudioTaskWorkerOnce(worker);
  const completed = await service.read(first.requestId);
  assert.equal(completed.state, 'completed', JSON.stringify(completed));
  assert.equal(calls, 1);
  assert.deepEqual(reads, keys);
  const {
    rows: [record],
  } = await f.pool.query('SELECT * FROM studio_image_turns WHERE user_id=$1', [actor.userId]);
  const {
    rows: [saved],
  } = await f.pool.query('SELECT review_context_json,response_json FROM studio_conversation_responses WHERE request_id=$1', [
    record.request_id,
  ]);
  assert.ok(saved.review_context_json);
  assert.doesNotMatch(JSON.stringify([record, saved]), /data:image|X-Amz-Signature/);

  storage = 'forbidden';
  const replay = await checkpointStudioResponse(
    actor,
    record,
    0,
    async () => assert.fail('unexpected model call'),
    undefined,
    { replayOnly: true, prepareInput: async () => assert.fail('replay must not reopen images') },
  );
  assert.equal(replay.id, 'vision-response-1');
  const second = task();
  await service.enqueue(second, 'mobile');
  await runStudioTaskWorkerOnce(worker);
  assert.equal((await service.read(second.requestId)).state, 'failed');
  assert.equal(counted.length, 1);
  assert.equal(calls, 1);
  const {
    rows: [charged],
  } = await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1', [actor.userId]);
  assert.equal(charged.n, 1);

  storage = 'available';
  const retry = task();
  await service.enqueue(retry, 'mobile');
  await runStudioTaskWorkerOnce(worker);
  assert.equal((await service.read(retry.requestId)).state, 'completed');
  assert.equal(calls, 2);

  const image = (url: string): ResponseInputContent => ({ type: 'input_image', detail: 'low', image_url: url });
  const before = reads.length;
  const foreign = 'https://' + host + '/user-assets/another-owner/image.png';
  await assert.rejects(prepareStudioReferenceImages(actor.userId, [image(urls[0]), image(foreign)]), {
    code: 'REFERENCE_FORBIDDEN',
  });
  assert.equal(reads.length, before, 'check every key before opening the batch');

  const repeated = [image(urls[0]), image(urls[0])];
  await prepareStudioReferenceImages(actor.userId, repeated);
  assert.deepEqual(repeated[0], repeated[1]);
  assert.equal(reads.length, before + 1);
  for (const failure of ['oversized', 'corrupt'] as const) {
    storage = failure;
    const content = [image(urls[0])];
    await assert.rejects(prepareStudioReferenceImages(actor.userId, content), { code: 'REFERENCE_INVALID' });
    assert.deepEqual(content, [image(urls[0])]);
  }

  storage = 'available';
  const { loadVisionReferenceImage } = await import('../frontend/src/server/studio/media-analysis/reference-image');
  const media = {
    kind: 'image' as const,
    url: urls[0],
    originalAccess: { type: 'owned-storage' as const, storageKey: keys[0] },
  };
  const budget = { remainingBytes: sources[0].length + 1 };
  const signal = AbortSignal.timeout(10_000);
  await loadVisionReferenceImage(media, signal, budget);
  assert.equal(budget.remainingBytes, 1);
  await assert.rejects(loadVisionReferenceImage(media, signal, budget), /ANALYSIS_SOURCE_TOO_LARGE/);

  // The older image-only director has its own usage marker and can retry the same message.
  const { createImageConversationService } = await import('../frontend/src/server/studio/image-conversation-service');
  const { createStudioImageDirector } = await import('../frontend/src/server/studio/image-conversation-director');
  let legacyCalls = 0;
  const legacy = createImageConversationService(actor, {
    enabled: true,
    director: createStudioImageDirector({
      createResponse: async (params) => {
        legacyCalls++;
        const input = JSON.stringify(params.input);
        assert.match(input, /data:image\/jpeg;base64,/);
        assert.ok(!input.includes(host));
        return {
          id: 'legacy-vision',
          model: 'gpt-6.1-sol',
          status: 'completed',
          service_tier: 'default',
          output_text: JSON.stringify({ reply: 'The image is blue.', image: null }),
        };
      },
    }),
  });
  const question = { requestId: randomUUID(), message: 'Describe the attached image.', references: [ids[0]] };
  storage = 'forbidden';
  await assert.rejects(legacy.submit(question), { code: 'REFERENCE_INVALID' });
  assert.equal(legacyCalls, 0);
  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM studio_image_model_usage WHERE request_id=$1', [question.requestId]))
      .rows[0].n,
    0,
  );
  storage = 'available';
  await legacy.submit(question);
  await legacy.submit(question);
  assert.equal(legacyCalls, 1);

  const hiddenOutput = task();
  await service.enqueue(hiddenOutput, 'mobile');
  await f.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='vision-job'");
  const readsBeforeHidden = reads.length;
  await runStudioTaskWorkerOnce(worker);
  assert.equal((await service.read(hiddenOutput.requestId)).state, 'failed');
  await assert.rejects(service.enqueue(task(), 'mobile'), /MEDIA_NOT_AVAILABLE/);
  assert.equal(reads.length, readsBeforeHidden);
  assert.equal(calls, 2);
  const external = image('https://example.invalid/already-resolved.png');
  await prepareStudioReferenceImages(actor.userId, [external], async () =>
    assert.fail('external URL must not be fetched by Studio'),
  );
  const tooMany = Array.from({ length: 9 }, () => image(urls[0]));
  await assert.rejects(
    prepareStudioReferenceImages(actor.userId, tooMany, async () => 'x'.repeat(2 * 1024 * 1024)),
    { code: 'REFERENCE_INVALID' },
  );
  assert.deepEqual(
    tooMany,
    Array.from({ length: 9 }, () => image(urls[0])),
    'a failed batch retains its canonical inputs',
  );
});
