import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import { mapLegacyJobRowToOutputs, type LegacyJobMediaRow } from '../frontend/server/media-library-records';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { claimGenerationPoll } from '../frontend/server/generation-poll-state';

test('MOV and JPEG checkpoints recover partial copies and projections without another debit or completed original loss',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('byteplus-output-recovery');
    const query = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
    let lookups = 0, originals = 0, playbacks = 0, frames = 0, projections = 0;
    let frameUnavailable = true, projectionUnavailable = true;
    let projected: LegacyJobMediaRow | null = null;
    const original = 'https://media.maxvideoai.com/renders/owner/original.mov';
    const frame = { url: 'https://media.maxvideoai.com/renders/owner/last.jpg', mimeType: 'image/jpeg',
      sha256: 'a'.repeat(64), sizeBytes: 123, width: 64, height: 48 };
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
      await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,provider,provider_job_id,status,
        duration_sec,aspect_ratio,payment_status,final_price_cents,currency,settings_snapshot,updated_at)
        VALUES ('mov-frame','owner','seedance-2-5','Seedance 2.5','byteplus_modelark','cgt-owned','running',4,
        '16:9','paid_wallet',71,'USD',$1,now()-interval '1 minute')`, [{ byteplusTransport: 'modelark', inputMode: 't2v',
        core: { resolution: '720p', aspectRatio: '16:9' }, advanced: { extraInputValues: { output_format: 'mov', return_last_frame: true } } }]);
      await db.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES ('owner','charge',71,'USD','mov-frame')");
      const poll = async () => {
        await db.pool.query(`UPDATE app_jobs SET updated_at=now()-interval '1 minute',
          settings_snapshot=settings_snapshot-'byteplusStorageCopy' WHERE job_id='mov-frame'`);
        return runBytePlusPoll({ jobId: 'mov-frame', deps: {
          queryFn: query,
          getBytePlusModelArkClientFn: () => ({ retrieveTask: async () => { lookups++;
            return { providerJobId: 'cgt-owned', status: 'completed', rawStatus: 'succeeded',
              videoUrl: 'https://supplier.test/source.mov', lastFrameUrl: 'https://supplier.test/last.jpg',
              outputFormat: 'mov', message: null, usage: { totalTokens: 100000 }, raw: {} }; } }) as never,
          copyBytePlusVideoOriginalFn: async () => { originals++; return original; },
          ensureBytePlusCompatiblePlaybackFn: async () => { playbacks++; return 'https://media.maxvideoai.com/renders/owner/playback.mp4'; },
          copyBytePlusLastFrameFn: async () => { frames++; if (frameUnavailable) throw new Error('frame unavailable'); return frame; },
          ensureFastStartVideoFn: async () => 'https://media.maxvideoai.com/wrong.mp4',
          ensureJobThumbnailFn: async () => 'https://media.maxvideoai.com/poster.jpg',
          upsertLegacyJobOutputsFn: async row => { projections++; if (projectionUnavailable) throw new Error('projection unavailable'); projected = row; },
          recordBytePlusPollEventFn: async () => undefined, applyBytePlusTrialOutcomeSafelyFn: async () => undefined,
          generateAndPersistJobPreviewVideoFn: async () => null, generateAndPersistJobKeyframesFn: async () => [],
        } as never });
      };
      const read = async () => (await query<{ status: string; video_url: string; settings_snapshot: Record<string, unknown> }>("SELECT * FROM app_jobs WHERE job_id='mov-frame'"))[0];
      const nextPoll = () => db.pool.query("UPDATE generation_poll_state SET started_at=now()-interval '1 minute',lease_until=now()-interval '1 second' WHERE job_id='mov-frame'");
      await poll();
      assert.equal((await read()).video_url, original, 'original must checkpoint before the frame copy fails');
      assert.equal((await read()).status, 'processing');
      frameUnavailable = false;
      await nextPoll();
      await poll();
      assert.equal((await read()).status, 'processing', 'projection outage must remain recoverable');
      projectionUnavailable = false;
      await nextPoll();
      await Promise.all([poll(), poll()]);
      assert.equal((await read()).status, 'completed');
      assert.equal((await read()).video_url, original);
      assert.equal(originals, 1);
      assert.equal(playbacks, 1);
      assert.equal(frames, 2);
      assert.equal(lookups, 2, 'all copied artifacts survive expired provider output URLs');
      const outputs = mapLegacyJobRowToOutputs(projected!);
      assert.equal(outputs.find(output => output.kind === 'image')?.metadata.role, 'last_frame');
      assert.equal(outputs.find(output => output.kind === 'video')?.metadata.playbackVideoUrl, 'https://media.maxvideoai.com/renders/owner/playback.mp4');
      assert.ok(projections >= 2);
      assert.deepEqual((await query("SELECT type,amount_cents FROM app_receipts WHERE job_id='mov-frame'")), [{ type: 'charge', amount_cents: 71 }]);
    } finally { await db.cleanup(); }
  });

test('BytePlus artifact lease prevents duplicate long copies while other pollers retain their normal default',
  { timeout: 90_000 }, async () => {
    const db = await startDisposablePostgres('byteplus-artifact-lease');
    const query = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
      await db.pool.query("INSERT INTO app_jobs(job_id,user_id,engine_id,status) VALUES ('lease','owner','seedance-2-5','running')");
      const claim = await (claimGenerationPoll as unknown as (id: string, query: unknown, options: unknown) => ReturnType<typeof claimGenerationPoll>)('lease', query, { leaseDurationMs: 600000 });
      assert.ok(claim);
      const [row] = await query<{ lease_seconds: number }>("SELECT EXTRACT(EPOCH FROM lease_until-started_at)::integer AS lease_seconds FROM generation_poll_state WHERE job_id='lease'");
      assert.equal(row.lease_seconds, 600);
      assert.equal(await claimGenerationPoll('lease', query), null);
      await claim.release();
    } finally { await db.cleanup(); }
  });

test('exhausted returned-frame recovery retains its original and stops automatic artifact work',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('bp-frame-exhausted');
    const query = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
    const previousLimit = process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
    process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = '1';
    let lookups = 0, frames = 0;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
      await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,status,duration_sec,
        settings_snapshot,updated_at) VALUES ('exhausted','owner','seedance-2-5','byteplus_modelark','cgt-exhausted',
        'running',4,$1,now()-interval '1 minute')`, [{ byteplusTransport: 'modelark', inputMode: 't2v',
        core: { resolution: '720p', aspectRatio: '16:9' }, advanced: { extraInputValues: { return_last_frame: true } } }]);
      const poll = async () => {
        await db.pool.query("UPDATE app_jobs SET updated_at=now()-interval '1 minute' WHERE job_id='exhausted'");
        await db.pool.query("UPDATE generation_poll_state SET started_at=now()-interval '1 minute',lease_until=now()-interval '1 second' WHERE job_id='exhausted'");
        await runBytePlusPoll({ jobId: 'exhausted', deps: { queryFn: query,
          getBytePlusModelArkClientFn: () => ({ retrieveTask: async () => { lookups++; return { providerJobId: 'cgt-exhausted',
            status: 'completed', rawStatus: 'succeeded', videoUrl: 'https://supplier.test/video.mp4',
            lastFrameUrl: 'https://supplier.test/last.jpg', message: null, usage: null, raw: {} }; } }) as never,
          ensureFastStartVideoFn: async () => 'https://media.maxvideoai.com/renders/owner/original.mp4',
          copyBytePlusLastFrameFn: async () => { frames++; throw new Error('frame unavailable'); },
          ensureJobThumbnailFn: async () => 'https://media.maxvideoai.com/poster.jpg',
          upsertLegacyJobOutputsFn: async () => {}, recordBytePlusPollEventFn: async () => {},
          applyBytePlusTrialOutcomeSafelyFn: async () => {}, generateAndPersistJobPreviewVideoFn: async () => null,
          generateAndPersistJobKeyframesFn: async () => [],
        } });
      };
      await poll();
      await poll();
      const [job] = await query<{ status: string; video_url: string }>("SELECT status,video_url FROM app_jobs WHERE job_id='exhausted'");
      assert.equal(job.status, 'provider_polling_stalled');
      assert.equal(job.video_url, 'https://media.maxvideoai.com/renders/owner/original.mp4');
      assert.equal(frames, 1);
      assert.equal(lookups, 1);
    } finally {
      if (previousLimit === undefined) delete process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
      else process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = previousLimit;
      await db.cleanup();
    }
  });

test('projection recovery has bounded attempts and expiry while all copied artifacts and money remain intact',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('bp-projection-bound');
    const query = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
    const previousLimit = process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
    process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = '2';
    const original = 'https://media.maxvideoai.com/original.mov';
    const playback = 'https://media.maxvideoai.com/playback.mp4';
    const frame = {url:'https://media.maxvideoai.com/last.jpg',mimeType:'image/jpeg',sha256:'a'.repeat(64),width:64,height:48,sizeBytes:123};
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql','utf8'));
      for (const expired of [false,true]) {
        const id = expired ? 'expired-projection' : 'bounded-projection';
        let projections = 0;
        await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,status,duration_sec,video_url,settings_snapshot,created_at,updated_at)
          VALUES($1,'owner','seedance-2-5','byteplus_modelark',$2,'processing',4,$3,$4,now()-$5::interval,now()-interval '1 minute')`,
          [id,`cgt-${id}`,original,{byteplusTransport:'modelark',inputMode:'t2v',core:{resolution:'720p',aspectRatio:'16:9'},advanced:{extraInputValues:{output_format:'mov',return_last_frame:true}},
            byteplusDurableOutput:{providerJobId:`cgt-${id}`,videoUrl:original,thumbUrl:'https://media.maxvideoai.com/poster.jpg',costBreakdown:{},playbackVideoUrl:playback,lastFrame:frame},
            ...(expired ? {byteplusStorageCopy:{attempts:1,firstFailedAt:new Date(Date.now()-4*60*60_000).toISOString(),lastReason:'provider_output_artifacts_failed'}} : {})},expired?'4 hours':'1 minute']);
        const poll = async () => {
          await db.pool.query("UPDATE app_jobs SET updated_at=now()-interval '1 minute',settings_snapshot=CASE WHEN settings_snapshot ? 'byteplusStorageCopy' THEN jsonb_set(settings_snapshot,'{byteplusStorageCopy,nextRetryAt}','null'::jsonb,false) ELSE settings_snapshot END WHERE job_id=$1",[id]);
          await db.pool.query("UPDATE generation_poll_state SET started_at=now()-interval '1 minute',lease_until=now()-interval '1 second' WHERE job_id=$1",[id]);
          await runBytePlusPoll({jobId:id,deps:{queryFn:query,
            getBytePlusModelArkClientFn:()=>({retrieveTask:async()=>{throw new Error('Durable recovery must never look up the provider.');}}) as never,
            ensureFastStartVideoFn:async()=>{throw new Error('Do not copy the original again.');},ensureBytePlusCompatiblePlaybackFn:async()=>{throw new Error('Do not transcode again.');},
            copyBytePlusLastFrameFn:async()=>{throw new Error('Do not copy the JPEG again.');},ensureJobThumbnailFn:async()=>null,
            upsertLegacyJobOutputsFn:async()=>{projections++;throw new Error('Projection unavailable.');},recordBytePlusPollEventFn:async()=>{},
            applyBytePlusTrialOutcomeSafelyFn:async()=>{},generateAndPersistJobPreviewVideoFn:async()=>null,generateAndPersistJobKeyframesFn:async()=>[]}});
        };
        await poll(); await poll(); await poll(); await poll();
        const [row] = await query<{status:string;video_url:string;settings_snapshot:any}>('SELECT status,video_url,settings_snapshot FROM app_jobs WHERE job_id=$1',[id]);
        assert.equal(projections,expired?0:2,`Projection failures must obey the same count/window as artifact copies: ${JSON.stringify(row)}`);
        assert.equal(row.status,'provider_polling_stalled');assert.equal(row.video_url,original);
        assert.equal(row.settings_snapshot.byteplusDurableOutput.playbackVideoUrl,playback);assert.deepEqual(row.settings_snapshot.byteplusDurableOutput.lastFrame,frame);
        assert.equal(row.settings_snapshot.byteplusStorageCopy.attempts,expired?1:2);
      }
      assert.equal((await db.pool.query('SELECT count(*)::int AS count FROM app_receipts')).rows[0].count,0);
    } finally {
      if (previousLimit===undefined) delete process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS; else process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS=previousLimit;
      await db.cleanup();
    }
  });
