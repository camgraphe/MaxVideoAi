import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { executeOpenAIImageGeneration, type OpenAIImageExecutionParams } from '../frontend/src/server/images/openai-image-execution';
import { recoverOpenAIImageResult, runOpenAIImageOutputRecovery } from '../frontend/src/server/images/openai-image-output-recovery';
import { openAIImageCompletionContext, persistOpenAIImageResult, reserveOpenAIImageResult } from '../frontend/src/server/images/openai-image-result-store';
import { extractOpenAIImages } from '../frontend/src/server/images/openai-image-response';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWKsAAAAASUVORK5CYII=';
const params = { userId: 'owner', jobId: 'recover-images', engine: { id: 'gpt-image-2-6-flare', label: 'Flare', providerMeta: { provider: 'openai_images', modelSlug: 'gpt-image-2.6-flare' } },
  engineEntry: { id: 'gpt-image-2-6-flare', marketingName: 'Flare' }, mode: 't2i', effectivePrompt: 'A private prompt', combinedImageUrls: [], numImages: 4,
  outputFormat: 'png', quality: 'high', complexity: 'high', resolution: '1024x1024', background: 'auto', pricing: { totalCents: 99, currency: 'USD' } } as OpenAIImageExecutionParams;

test('accepted OpenAI batches survive first/later storage failures and recover without any second provider request', async () => {
  const db = await startDisposablePostgres('openai-output-recovery');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY, user_id TEXT, provider TEXT, provider_job_id TEXT, render_ids JSONB,
      status TEXT, payment_status TEXT, progress INT, message TEXT, updated_at TIMESTAMPTZ);
      INSERT INTO app_jobs(job_id,user_id,status,payment_status,progress) VALUES ('recover-images','owner','pending','paid_wallet',0);`);
    await db.pool.query(readFileSync('neon/migrations/95_openai_image_results.sql', 'utf8'));
    const queryFn = async <T>(sql: string, args?: readonly unknown[]) => (await db.pool.query(sql, args as unknown[])).rows as T[];
    for (const failAt of [1, 2]) {
      await db.pool.query("DELETE FROM app_openai_image_results; UPDATE app_jobs SET status='pending',render_ids=NULL");
      let posts = 0, uploads = 0, completions = 0;
      const uploadFn = async () => {
        const [receipt] = (await db.pool.query('SELECT * FROM app_openai_image_results')).rows;
        assert.ok(JSON.stringify(receipt.images).includes(png), 'all accepted bytes must be durable before the first upload');
        assert.equal((await db.pool.query('SELECT render_ids FROM app_jobs')).rows[0].render_ids, null, 'a partial batch is not a public result');
        if (++uploads === failAt) throw new Error('Storage unavailable');
        return { url: `https://media.maxvideoai.com/renders/owned-${uploads}.png`, mime: 'image/png', width: 1024, height: 1024 };
      };
      const completeFn = async (input: { images: unknown[]; pricing: unknown }) => {
        assert.equal(input.images.length, 4); assert.deepEqual(input.pricing, params.pricing);
        completions++;
        await db.pool.query("UPDATE app_jobs SET status='completed',render_ids=$1::jsonb", [JSON.stringify(input.images)]);
        return { heroThumb: 'thumb' };
      };
      const recoveryDeps = { queryFn, uploadFn, thumbnailsFn: async () => ['thumb', 'thumb', 'thumb', 'thumb'], completeFn };
      await assert.rejects(executeOpenAIImageGeneration(params, { ...recoveryDeps,
        assertAvailableFn: () => undefined, prepareReferencesFn: async () => [],
        generateFn: async () => { posts++; return { requestId: 'req_durable', body: { output_format: 'png', data: Array.from({ length: 4 }, () => ({ b64_json: png })),
          usage: { input_tokens: 2, input_tokens_details: { text_tokens: 2, image_tokens: 0 }, output_tokens: 4, total_tokens: 6 } } }; },
        ambiguousFn: async () => undefined, failFn: async () => { throw new Error('An accepted response must not refund'); },
      }), { code: 'provider_outcome_ambiguous' });
      assert.equal(posts, 1); assert.equal(completions, 0);
      assert.equal(await recoverOpenAIImageResult(params.jobId, 'foreign-owner', recoveryDeps), null);
      const result = await recoverOpenAIImageResult(params.jobId, params.userId, recoveryDeps);
      assert.equal(result?.images.length, 4); assert.equal(completions, 1); assert.equal(posts, 1);
      assert.equal(uploads, 5, 'successful checkpoints are reused; only the failed upload is repeated');
      const saved = (await db.pool.query('SELECT * FROM app_openai_image_results')).rows[0];
      assert.equal(saved.state, 'completed'); assert.deepEqual(saved.images, []);
      assert.equal(saved.completion_context.providerUsage.totalTokens, 6);
      assert.equal(JSON.stringify(saved).includes('A private prompt'), false);
      assert.equal(await recoverOpenAIImageResult(params.jobId, params.userId, recoveryDeps), null);
      assert.equal(completions, 1);
    }
  } finally { await db.cleanup(); }
});

test('a refund committed during storage cannot be overwritten by image completion', async () => {
  const db = await startDisposablePostgres('openai-recovery-refund');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/95_openai_image_results.sql', 'utf8'));
    await db.pool.query("INSERT INTO app_jobs(job_id,user_id,status,payment_status) VALUES('recover-images','owner','running','paid_wallet')");
    const queryFn = async <T>(sql: string, args?: readonly unknown[]) => (await db.pool.query(sql, args as unknown[])).rows as T[];
    await reserveOpenAIImageResult(openAIImageCompletionContext({ ...params, numImages: 1 }), queryFn);
    await persistOpenAIImageResult({ jobId: params.jobId, userId: params.userId, requestId: 'req_refund',
      extracted: extractOpenAIImages({ data: [{ b64_json: png }] }, 'png', 1), usage: null }, queryFn);
    await assert.rejects(recoverOpenAIImageResult(params.jobId, params.userId, { queryFn,
      uploadFn: async () => {
        await db.pool.query("UPDATE app_jobs SET status='failed',payment_status='refunded_wallet',message='Manual refund'");
        return { url: 'https://media.maxvideoai.com/one.png', mime: 'image/png' };
      }, thumbnailsFn: async () => ['thumb'],
    }), /no longer eligible/);
    const row = (await db.pool.query('SELECT * FROM app_jobs')).rows[0];
    assert.equal(row.status, 'failed'); assert.equal(row.payment_status, 'refunded_wallet');
    assert.equal(row.message, 'Manual refund'); assert.equal(row.render_ids, null);
  } finally {
    await getDb().end(); await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});

test('concurrent recovery claims one batch and an expired worker lease can resume stored outputs', async () => {
  const db = await startDisposablePostgres('openai-recovery-lease');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY,user_id TEXT,status TEXT,payment_status TEXT);
      INSERT INTO app_jobs VALUES('recover-images','owner','running','paid_wallet')`);
    await db.pool.query(readFileSync('neon/migrations/95_openai_image_results.sql', 'utf8'));
    const queryFn = async <T>(sql: string, args?: readonly unknown[]) => (await db.pool.query(sql, args as unknown[])).rows as T[];
    const stage = async () => {
      await reserveOpenAIImageResult(openAIImageCompletionContext({ ...params, numImages: 1 }), queryFn);
      await persistOpenAIImageResult({ jobId: params.jobId, userId: params.userId, requestId: 'req_lease',
        extracted: extractOpenAIImages({ data: [{ b64_json: png }] }, 'png', 1), usage: null }, queryFn);
    };
    await stage();
    let started!: () => void, release!: () => void;
    const uploading = new Promise<void>(r => { started = r; });
    const blocked = new Promise<void>(r => { release = r; });
    let uploads = 0, completions = 0;
    const deps = { queryFn, uploadFn: async () => { uploads++; started(); await blocked; return { url: 'https://media.maxvideoai.com/one.png', mime: 'image/png' }; },
      thumbnailsFn: async () => ['thumb'], completeFn: async () => { completions++; await db.pool.query("UPDATE app_jobs SET status='completed'"); return { heroThumb: 'thumb' }; } };
    const first = recoverOpenAIImageResult(params.jobId, params.userId, deps);
    await uploading;
    assert.equal(await recoverOpenAIImageResult(params.jobId, params.userId, deps), null);
    release(); await first;
    assert.equal(uploads, 1); assert.equal(completions, 1);

    await db.pool.query("DELETE FROM app_openai_image_results; UPDATE app_jobs SET status='running'");
    await stage();
    await db.pool.query("UPDATE app_openai_image_results SET lease_token='crashed-worker',lease_expires_at=NOW()+INTERVAL '1 minute'");
    assert.equal(await recoverOpenAIImageResult(params.jobId, params.userId, deps), null);
    await db.pool.query("UPDATE app_openai_image_results SET lease_expires_at=NOW()-INTERVAL '1 minute'");
    assert.deepEqual(await runOpenAIImageOutputRecovery(deps), { recovered: 1, deferred: 0 });
    assert.equal(uploads, 2); assert.equal(completions, 2);
    // An interrupted private-byte cleanup is resumed without changing the job.
    await db.pool.query("UPDATE app_openai_image_results SET state='received',images=$1::jsonb", [JSON.stringify([{ base64: png }])]);
    assert.deepEqual(await runOpenAIImageOutputRecovery(deps), { recovered: 0, deferred: 0 });
    assert.deepEqual((await db.pool.query('SELECT images FROM app_openai_image_results')).rows[0].images, []);
    assert.equal(completions, 2);
  } finally { await db.cleanup(); }
});

test('paired display preparation checkpoints receipt bytes and resumes completion without refetch or reupload',async()=>{
 const db=await startDisposablePostgres('openai-display-recovery');
 try{
  await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY,user_id TEXT,status TEXT,payment_status TEXT); INSERT INTO app_jobs VALUES('recover-images','owner','running','paid_wallet')`);
  await db.pool.query(readFileSync('neon/migrations/95_openai_image_results.sql','utf8'));
  const queryFn=async<T>(sql:string,args?:readonly unknown[])=>(await db.pool.query(sql,args as unknown[])).rows as T[];
  await reserveOpenAIImageResult(openAIImageCompletionContext({...params,numImages:1}),queryFn);
  await persistOpenAIImageResult({jobId:params.jobId,userId:params.userId,requestId:'receipt',extracted:extractOpenAIImages({data:[{b64_json:png}]},'png',1),usage:null},queryFn);
  let uploads=0,preparations=0,completions=0;
  const sourceUrl='https://media.maxvideoai.com/original.png';
  const imageDisplay={version:1 as const,profile:'image-display-v1' as const,sourceUrl,sourceSha256:'a'.repeat(64),url:'https://media.maxvideoai.com/display.webp',mimeType:'image/webp' as const,width:1920,height:960,sizeBytes:2000};
  const deps={queryFn,uploadFn:async()=>{uploads++;return{url:sourceUrl,mime:'image/png'};},renditionsFn:async(input:any)=>{preparations++;assert.deepEqual(input.data,Buffer.from(png,'base64'));return{thumbUrl:'https://media.maxvideoai.com/thumb.webp',previewUrl:imageDisplay.url,imageDisplay};},completeFn:async(input:any)=>{completions++;assert.deepEqual(input.images[0].imageDisplay,imageDisplay);if(completions===1)throw Error('completion retry');await db.pool.query("UPDATE app_jobs SET status='completed'");return{heroThumb:input.images[0].thumbUrl};}};
  await assert.rejects(recoverOpenAIImageResult(params.jobId,params.userId,deps),/completion retry/);
  assert.deepEqual((await db.pool.query('SELECT stored_images FROM app_openai_image_results')).rows[0].stored_images[0].image.imageDisplay,imageDisplay);
  await recoverOpenAIImageResult(params.jobId,params.userId,deps);
  assert.equal(uploads,1);assert.equal(preparations,1);assert.equal(completions,2);
 }finally{await db.cleanup();}
});
