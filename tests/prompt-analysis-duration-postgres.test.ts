import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import dns from 'node:dns/promises';
import https from 'node:https';
import type {ClientRequest,IncomingMessage} from 'node:http';
import { NextRequest } from '../frontend/node_modules/next/server';
import sharp from '../frontend/node_modules/sharp';
import {getDb} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

Object.assign(process.env,{ASSET_HOST_ALLOWLIST:'fixture-media.test',FAL_KEY:'fixture',ALIBABA_MODEL_STUDIO_API_KEY:'fixture',ALIBABA_MODEL_STUDIO_ADMIN_ONLY:'false',ALIBABA_MODEL_STUDIO_ENABLED:'true',ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED:'true',
  PROMPT_ASSISTANCE_PERCEPTION_ENABLED:'true',STUDIO_ASSISTANCE_ENABLED:'true',STUDIO_MEDIA_ANALYSIS_ENABLED:'true',STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY:'duration-fixture',
  STUDIO_MEDIA_ANALYSIS_POLICY_JSON:JSON.stringify({version:'duration-fixture',processingNanoUsdPerSecond:100_000,marginPercent:1,video:{maxInputTokens:12000,maxOutputTokens:2200},audio:{maxInputTokens:4096,maxOutputTokens:1200,rateVersion:'fixture',textInputNanoUsd:2500,audioInputNanoUsd:32000,textOutputNanoUsd:10000}})});

test('Milo cost review verifies an older owned Wan Modify output without using requested duration or charging',async t=>{
  const pg=await startDisposablePostgres('milo-duration');const prior=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,deleted_at timestamptz);
    CREATE TABLE engine_settings(engine_id text,options jsonb,pricing jsonb,updated_at timestamptz,updated_by text);
    CREATE TABLE engine_overrides(engine_id text,active boolean,availability text,status text,latency_tier text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,storage_url text,mime_type text,status text,metadata jsonb,width int,height int,updated_at timestamptz);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,metadata jsonb,deleted_at timestamptz,source_job_id text,source_output_id text,width int,height int,updated_at timestamptz);`);
  for(const name of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','64_studio_media_analysis.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql','96_milo_lite_output_allowance.sql','89_composer_reference_analysis.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const user='duration-owner',job='duration-job',output='duration-job:video:0',url='https://fixture-media.test/original.mp4';
  await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,engine_id,status,duration_sec) VALUES($1,$2,'wan-3-prime','completed',24)",[job,user]);
  await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,metadata,width,height) VALUES($1,$2,$3,'video',$4,'video/mp4','ready','{}',720,1280)",[output,job,user,url]);
  const {chooseStudioAssistance}=await import('../frontend/src/server/studio/assistance-ledger');
  const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
  await chooseStudioAssistance(user,{action:'select_terra',expectedRevision:0},studioAssistancePolicy());
  const bytes=readFileSync('tests/fixtures/studio-media/pattern-a.mp4');let downloads=0;
  t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
  t.mock.method(https,'request',(...args:unknown[])=>{
    const [target,options,callback]=args as [URL,https.RequestOptions,(response:IncomingMessage)=>void];
    assert.equal(target.href,url);assert.equal(typeof options.lookup,'function');downloads++;
    const response=Readable.from([bytes]) as IncomingMessage;response.statusCode=200;response.headers={'content-type':'video/mp4','content-length':String(bytes.length)};
    const request=new EventEmitter() as ClientRequest;Object.assign(request,{setTimeout(){return request;},end(){queueMicrotask(()=>callback(response));return request;},destroy(){return request;}});return request;
  });
  const {preparePromptReferenceAnalysis}=await import('../frontend/src/server/prompt-assistance/reference-analysis');
  const input={action:'prepare' as const,sessionId:randomUUID(),requestId:randomUUID(),fieldId:'video_url',slot:0,modality:'visual' as const,startSec:0,
    draft:{surface:'video' as const,workflow:'modify',engineId:'wan-3-prime',mode:'v2v',target:'prompt' as const,text:'Keep the scene',settings:{durationSec:24,resolution:'720p',aspectRatio:'16:9'},
      references:[{fieldId:'video_url',slot:0,label:'Video to modify',ref:{type:'job-output' as const,jobId:job,outputId:output,kind:'video' as const}}]}};
  await t.test('Lite, disabled profiles, expired scope and foreign references stop before inspection',async()=>{
    await pg.pool.query("UPDATE studio_assistance_accounts SET selected_model='gpt-6-luna' WHERE user_id=$1",[user]);
    await assert.rejects(preparePromptReferenceAnalysis(user,input),/Standard or Max/);
    await pg.pool.query("UPDATE studio_assistance_accounts SET selected_model='gpt-6.1-terra' WHERE user_id=$1",[user]);
    process.env.STUDIO_MEDIA_ANALYSIS_ENABLED='false';
    await assert.rejects(preparePromptReferenceAnalysis(user,input),/profile is not available/);
    process.env.STUDIO_MEDIA_ANALYSIS_ENABLED='true';
    const policy=process.env.STUDIO_MEDIA_ANALYSIS_POLICY_JSON!;
    process.env.STUDIO_MEDIA_ANALYSIS_POLICY_JSON=JSON.stringify({...JSON.parse(policy),video:null});
    await assert.rejects(preparePromptReferenceAnalysis(user,input),/not been qualified/);
    process.env.STUDIO_MEDIA_ANALYSIS_POLICY_JSON=policy;
    const expired=randomUUID();
    await pg.pool.query("INSERT INTO prompt_assistance_sessions(user_id,id,scope,expires_at) VALUES($1,$2,'video:modify',clock_timestamp()-interval '1 second')",[user,expired]);
    await assert.rejects(preparePromptReferenceAnalysis(user,{...input,sessionId:expired}),/SESSION_EXPIRED/);
    await assert.rejects(preparePromptReferenceAnalysis('foreign',input),/MEDIA_NOT_AVAILABLE/);
    const other=randomUUID();await pg.pool.query("INSERT INTO prompt_assistance_sessions(user_id,id,scope) VALUES($1,$2,'video:create')",[user,other]);
    await assert.rejects(preparePromptReferenceAnalysis(user,{...input,sessionId:other}),/SESSION_SCOPE_CHANGED/);
    assert.equal(downloads,0);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_media_analysis_runs')).rows[0].n,0);
  });
  const result=await preparePromptReferenceAnalysis(user,input);
  assert.equal(result.status.state,'prepared');assert.equal(result.status.quote.endSec,6);assert.equal(downloads,1);
  const row=(await pg.pool.query('SELECT metadata,width,height,url FROM job_outputs WHERE id=$1',[output])).rows[0];
  assert.deepEqual(row.metadata.mediaFacts,{source:'probe',durationSec:6,width:320,height:180,hasAudio:true});assert.equal(row.url,url);
  assert.equal((await pg.pool.query('SELECT duration_sec FROM app_jobs WHERE job_id=$1',[job])).rows[0].duration_sec,24);
  await preparePromptReferenceAnalysis(user,input);assert.equal(downloads,1,'Repeat cost review reuses persisted measurement without another download.');
  const {createComposerAnalysisService}=await import('../frontend/src/server/studio/media-analysis/service');
  await createComposerAnalysisService(user,input.sessionId).read(result.status.quote.analysisId);assert.equal(downloads,1,'Reading an analysis never qualifies media.');
  await t.test('audio-from-video qualifies duration with the same original without new inspection',async()=>{
    const audio=await preparePromptReferenceAnalysis(user,{...input,requestId:randomUUID(),modality:'audio'});
    assert.equal(audio.status.quote.endSec,6);assert.equal(audio.status.quote.profile,'audio-window-v1');assert.equal(downloads,1);
  });
  await t.test(
    'native bearer references reach the same owned pixels and bounded video excerpt as the site',
    async (subtest) => {
      const { handleMobileMilo, handleMobileMiloAnalysis } = await import('../frontend/src/server/mobile/milo');
      const { preparePromptPerception } = await import('../frontend/src/server/prompt-assistance/perception');
      const { buildPromptAssistanceContext } = await import('../frontend/src/server/prompt-assistance/context');
      const { initialStatus } = await import('./helpers/milo-status-fixture');
      const nativeSession = randomUUID();
      const imageId = 'ma_' + '1'.repeat(32),
        videoId = 'ma_' + '2'.repeat(32);
      const photoUrl = 'https://fixture-media.test/native-photo.png';
      await pg.pool.query(
        `INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,metadata)
         VALUES('native-image',$1,$2,'image',$3,'image/png','ready','{}'),
               ('native-video',$4,$2,'video',$5,'video/mp4','ready',$6)`,
        [
          imageId,
          user,
          photoUrl,
          videoId,
          url,
          JSON.stringify({ mediaFacts: { source: 'probe', durationSec: 6, hasAudio: true } }),
        ],
      );
      const post = (path: string, body: unknown) =>
        new NextRequest('https://fixture.test/api/mobile/milo' + path, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'x-maxvideoai-auth-mode': 'bearer', authorization: 'Bearer fixture' },
        });
      const deps = {
        enabled: true,
        user: async (_req: unknown, consent?: boolean) => {
          assert.equal(consent, true);
          return user;
        },
      };
      const original = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#ff0000' } })
        .png()
        .toBuffer();
      let pixelReads = 0;
      subtest.mock.method(globalThis, 'fetch', async (raw: unknown) => {
        assert.equal(raw, photoUrl);
        pixelReads++;
        return new Response(new Uint8Array(original), { headers: { 'content-type': 'image/png' } });
      });
      const { readMobileModels } = await import('../frontend/src/server/mobile/catalog');
      const catalog = await readMobileModels({ surface: 'video', mediaReferences: true });
      const imageModel = catalog.find((model) =>
        model.modes.some((mode) => mode.mode === 'i2v' && mode.referenceImageField),
      );
      const videoModel = catalog.find(
        (model) =>
          model.id === input.draft.engineId &&
          model.modes.some((mode) => mode.mode === 'v2v' && mode.sourceVideo),
      );
      assert.ok(imageModel && videoModel, JSON.stringify(catalog.map((model) => model.id)));
      const imageField = imageModel.modes.find((mode) => mode.mode === 'i2v')!.referenceImageField!;
      const photoRequest = {
        sessionId: randomUUID(),
        requestId: randomUUID(),
        locale: 'en',
        message: 'Describe the attached photo.',
        assistanceModel: initialStatus.selectedModel,
        assistanceRevision: initialStatus.revision,
        draftRevision: 1,
        draft: {
          ...input.draft,
          engineId: imageModel.id,
          workflow: 'create',
          mode: 'i2v',
          settings: {},
          references: [
            {
              fieldId: imageField,
              slot: 0,
              label: 'Photo',
              ref: { type: 'asset', kind: 'image', assetId: imageId },
            },
          ],
        },
      };
      const chat = await handleMobileMilo(post('', { action: 'message', request: photoRequest }), {
        ...deps,
        send: async (owner, request) => {
          const context = await buildPromptAssistanceContext(owner, request);
          const perception = await preparePromptPerception(
            owner,
            request,
            initialStatus.selectedModel,
            context,
          );
          const pixels = perception.content.find((item) => item.type === 'input_image');
          assert.ok(pixels?.image_url);
          assert.ok(pixels.image_url.startsWith('data:image/jpeg;base64,'));
          const decoded = await sharp(Buffer.from(pixels.image_url.split(',')[1], 'base64'))
            .raw()
            .toBuffer({ resolveWithObject: true });
          assert.deepEqual([decoded.info.width, decoded.info.height], [32, 16]);
          assert.ok(decoded.data[0] > 250 && decoded.data[1] < 5 && decoded.data[2] < 5);
          return {
            sessionId: request.sessionId,
            requestId: request.requestId,
            draftRevision: 1,
            target: 'prompt',
            message: request.message,
            state: 'complete',
            reply: { reply: 'Fixture result.', text: null },
            assistance: initialStatus,
          };
        },
      });
      assert.equal(chat.status, 200, JSON.stringify(await chat.json()));
      assert.equal(pixelReads, 1);
      const prepared = await handleMobileMiloAnalysis(
        post('/analyses', {
          ...input,
          sessionId: nativeSession,
          requestId: randomUUID(),
          startSec: 1,
          endSec: 3,
          draft: {
            ...input.draft,
            references: [
              {
                fieldId: 'video_url',
                slot: 0,
                label: 'Clip',
                ref: { type: 'asset', kind: 'video', assetId: videoId },
              },
            ],
          },
        }),
        deps,
      );
      const response = await prepared.json();
      assert.equal(prepared.status, 200, JSON.stringify(response));
      assert.equal(response.result.sessionId, nativeSession);
      const video = response.result.status;
      assert.equal(video.state, 'prepared');
      assert.deepEqual(
        [video.quote.ref.assetId, video.quote.startSec, video.quote.endSec, video.quote.confirmationRequired],
        [videoId, 1, 3, true],
      );
      assert.ok(video.quote.maxCredits > 0);
      assert.equal(downloads, 1, 'Saved duration requires no second download or paid analysis.');
    },
  );

  await t.test('an aborted qualification never creates a quote, selection, reservation or late measurement',async subtest=>{
    await pg.pool.query("UPDATE job_outputs SET metadata='{}' WHERE id=$1",[output]);
    const quotes=(await pg.pool.query('SELECT count(*)::int n FROM studio_media_analysis_runs')).rows[0].n;
    const selections=(await pg.pool.query('SELECT count(*)::int n FROM prompt_assistance_analysis_selections')).rows[0].n;
    const deadline=new AbortController(),originalTimeout=AbortSignal.timeout;
    subtest.mock.method(AbortSignal,'timeout',(milliseconds:number)=>milliseconds===20_000?deadline.signal:originalTimeout.call(AbortSignal,milliseconds));
    subtest.mock.method(dns,'lookup',async()=>{deadline.abort();return [{address:'8.8.8.8',family:4}];});
    await assert.rejects(preparePromptReferenceAnalysis(user,{...input,requestId:randomUUID()}),/REFERENCE_DURATION_UNKNOWN/);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(downloads,1);
    assert.deepEqual((await pg.pool.query('SELECT metadata FROM job_outputs WHERE id=$1',[output])).rows[0].metadata,{});
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_media_analysis_runs')).rows[0].n,quotes);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM prompt_assistance_analysis_selections')).rows[0].n,selections);
  });
  for(const table of ['studio_assistance_calls','studio_assistance_credit_funding','app_receipts'])
    assert.equal((await pg.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0,'Cost review must not reserve or charge.');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_media_analysis_runs WHERE state<>'prepared'")).rows[0].n,0);
  await t.test('a sent Lite message starts its saved recommendation exactly once',async()=>{
    await pg.pool.query("UPDATE job_outputs SET metadata=$2::jsonb WHERE id=$1",[output,JSON.stringify(row.metadata)]);
    const {composerScope}=await import('../frontend/src/server/prompt-assistance/repository');
    const {openStudioAssistanceTurn}=await import('../frontend/src/server/studio/assistance-ledger');
    const {startRecommendedPromptAnalysis}=await import('../frontend/src/server/prompt-assistance/reference-analysis');
    const requestId=randomUUID(),scope=composerScope(user,input.sessionId);
    await pg.pool.query("UPDATE studio_assistance_accounts SET selected_model='gpt-6-luna' WHERE user_id=$1",[user]);
    await openStudioAssistanceTurn(scope,requestId,studioAssistancePolicy());
    const sentMessage={requestId,sessionId:input.sessionId,draftRevision:0,message:'Describe the camera in this reference',draft:input.draft};
    const reply={reply:'I’ll inspect this excerpt.',text:null,analysisRequest:{fieldId:'video_url',slot:0,modality:'visual',startSec:1,endSec:5,ref:input.draft.references[0].ref}};
    await pg.pool.query("INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,input_hash,input_json,lease_id,state,model,reply_json) VALUES($1,$2,$3,'fixture',$4,$5,'complete','gpt-6-luna',$6)",[user,input.sessionId,requestId,JSON.stringify(sentMessage),randomUUID(),JSON.stringify(reply)]);
    await assert.rejects(startRecommendedPromptAnalysis(user,input.sessionId,requestId),/pilot is unavailable/i);
    process.env.STUDIO_MEDIA_ANALYSIS_SPONSORED_PILOT='true';
    try {
      await assert.rejects(startRecommendedPromptAnalysis('foreign',input.sessionId,requestId),/REQUEST_NOT_FOUND/);
      const started=await startRecommendedPromptAnalysis(user,input.sessionId,requestId);
      const replay=await startRecommendedPromptAnalysis(user,input.sessionId,requestId);
      assert.equal(started.status.state,'queued');
      assert.deepEqual([started.status.quote.startSec,started.status.quote.endSec],[1,5]);
      assert.equal(started.status.quote.analysisId,replay.status.quote.analysisId);
      assert.equal(started.status.quote.confirmationRequired,false);
      assert.equal((await createComposerAnalysisService(user,input.sessionId).readByRequest(requestId))?.quote.analysisId,started.status.quote.analysisId);
      assert.equal(await createComposerAnalysisService(user,randomUUID()).readByRequest(requestId),null);
      assert.equal(await createComposerAnalysisService('foreign',input.sessionId).readByRequest(requestId),null);
      assert.equal((await pg.pool.query("SELECT selected_model FROM studio_assistance_accounts WHERE user_id=$1",[user])).rows[0].selected_model,'gpt-6-luna');
      assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_analysis_credit_allocations')).rows[0].n,0);
    } finally {
      delete process.env.STUDIO_MEDIA_ANALYSIS_SPONSORED_PILOT;
    }
  });
});
