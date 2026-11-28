import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HISTORICAL_REPLAY_QUERY, assertHistoricalReplayWindow, loadHistoricalReplayGroups } from '../frontend/app/(core)/admin/routing/_lib/historical-replay-query';
import { buildHistoricalReplay } from '../frontend/app/(core)/admin/routing/_lib/historical-replay';
import { ADMIN_EXCLUDED_USER_IDS } from '../frontend/lib/admin/exclusions';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('exports one parameterized, bounded read for the SELECT-only audit reader', () => {
  assert.match(HISTORICAL_REPLAY_QUERY, /^WITH /);
  assert.doesNotMatch(HISTORICAL_REPLAY_QUERY, /;/);
  assert.doesNotThrow(() => assertHistoricalReplayWindow('2026-10-29','2026-11-28'));
  assert.throws(() => assertHistoricalReplayWindow('2026-02-30','2026-04-01'));
  assert.throws(() => assertHistoricalReplayWindow('2026-10-28','2026-11-28'));
  assert.throws(() => assertHistoricalReplayWindow("2026-10-29'--",'2026-11-28'));
});

test('Madrid boundaries, private media roles, final owner, credits and measured supplier usage survive hourly grouping', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(missing);
  const db = await startDisposablePostgres('routing-history');
  t.after(() => db.cleanup());
  const execute = async <T>(sql: string,args?: readonly unknown[]):Promise<T[]> => (await db.pool.query(sql, args ? [...args] : [])).rows;
  await execute(`CREATE TABLE app_jobs(id bigserial PRIMARY KEY,job_id text,user_id text,provider text,provider_job_id text, engine_id text,
    surface text,status text,payment_status text,created_at timestamptz, duration_sec int,settings_snapshot jsonb,pricing_snapshot jsonb,cost_breakdown_usd jsonb)`);
  await execute('CREATE TABLE fal_queue_log(job_id text,engine_id text,provider text,provider_job_id text,payload jsonb)');
  await execute(readFileSync('neon/migrations/21_provider_attempts.sql','utf8'));
  const basicSettings = (engineId:string) => ({
    schemaVersion:1, surface:'video',engineId,inputMode:'t2v',prompt:'  Private text 💡  ',
    core:{resolution:'720p',aspectRatio:'16:9',audio:true},advanced:{seed:null,extraInputValues:null},
    refs:{inputs:null,videoUrls:null,referenceImages:[],audioUrl:null,imageUrl:null,firstFrameUrl:null,endImageUrl:null,lastFrameUrl:null,elements:null},
  });
  const h3 = 'minimax-h3', wan='wan-3', seed='seedance-2-5', kling='kling-3-pro';
  type Job = {engine?:string; provider?:string; remote?:string|null; created?:string; status?:string; user?:string; surface?:string;
    payment?:string; settings?:unknown; price?:unknown; cost?:unknown};
  async function insert(j:Job={}) {
    const engine=j.engine??h3;
    const rows=await execute<{id:string}>(`INSERT INTO app_jobs(user_id,provider,provider_job_id,engine_id,surface,status,payment_status,
      created_at,duration_sec,settings_snapshot,pricing_snapshot,cost_breakdown_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,5,$9,$10,$11) RETURNING id`,
      [j.user??'private-user',j.provider??'fal',j.remote===undefined?'private-remote':j.remote,engine,j.surface??'video',j.status??'completed',
        j.payment??'paid_wallet',j.created??'2026-10-25T01:12:00Z',j.settings===undefined?basicSettings(engine):j.settings,j.price??{currency:'USD',totalCents:100},j.cost??{}]);
    const id=rows[0].id;
    await execute('UPDATE app_jobs SET job_id=$1::text WHERE id=$1::bigint',[id]);
    return id;
  }
  const attempt = (id:string,index:number,provider:string,status:string,snapshot:unknown={},remote:string|null=null,model:string|null=null) => execute(
    'INSERT INTO provider_attempts(job_id,attempt_index,provider,status,request_snapshot,provider_job_id,provider_model) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,index,provider,status,snapshot,remote,model]);
  // 30 Madrid days spanning the switch back to CET: the repeated 02:00 is two separate UTC buckets.
  await insert({created:'2026-10-01T21:59:59Z'});
  await insert({created:'2026-10-01T22:00:00Z'});
  await insert({created:'2026-10-31T23:00:00Z'});
  await insert({created:'2026-10-25T00:05:00Z'}); await insert({}); await insert({});
  await insert({user:ADMIN_EXCLUDED_USER_IDS[0]}); await insert({surface:'image'});
  await insert({status:'failed',payment:'refunded',remote:null});
  await insert({engine:'unpriced-engine',settings:null,price:{currency:'EUR',totalCents:200}});
  const hs=basicSettings(h3);
  const h3ReferenceId=await insert({settings:{...hs,inputMode:'ref2v',advanced:{extraInputValues:{prompt_expansion_mode:'disabled'}},refs:{...hs.refs,
    referenceImages:['https://private.media/a'],inputs:[{kind:'image',slotId:'reference_image_urls',url:'https://private.media/a'}]}}});
  await execute("INSERT INTO fal_queue_log VALUES($1,$2,'fal','private-remote',$3)",[h3ReferenceId,h3,{request:{aspectRatio:'adaptive'}}]);
  await insert({settings:{...hs,inputMode:'i2v',refs:{...hs.refs,imageUrl:'private-start',inputs:[{kind:'audio',slotId:'target_audio_url',url:'private-audio'}]}}});
  const duplicateOwner=await insert({price:{currency:'USD',totalCents:444}});
  await attempt(duplicateOwner,1,'fal','completed',{},'old-remote');
  const media={mode:'ref2v',resolution:'720p',durationSec:5,aspectRatio:'16:9',hasStartImage:false,hasEndImage:false,
    referenceImageCount:0,referenceVideoCount:1,referenceAudioCount:0,inputVideoDurationSec:3.5,audioEnabled:true};
  const ws={...basicSettings(wan),inputMode:'ref2v'};
  const wanId=await insert({engine:wan,settings:ws});
  await attempt(wanId,1,'alibaba_model_studio','failed',media);
  await attempt(wanId,2,'fal','completed',{},'private-remote');
  const multiple=await insert({engine:wan,settings:ws});
  await attempt(multiple,1,'alibaba_model_studio','failed',{...media,referenceVideoCount:2});
  const clipsId=await insert({engine:wan,settings:{...ws,refs:{...ws.refs,inputs:[
    {kind:'video',slotId:'reference_video_urls',url:'private-clip-one',durationSec:1.5},{kind:'video',slotId:'reference_video_urls',url:'private-clip-two',durationSec:2}]}}});
  await attempt(clipsId,1,'alibaba_model_studio','failed',{...media,referenceVideoCount:2});
  for (const [price,settings,snapshot] of [
    [333,{...ws,advanced:{...ws.advanced,safetyChecker:false}},media],
    [334,ws,{...media,unreviewedWanOptions:true}],
  ] as const) {
    const id=await insert({engine:wan,settings,price:{currency:'USD',totalCents:price}});
    await attempt(id,1,'alibaba_model_studio','failed',snapshot);
  }
  for (const costStatus of ['list_estimate_from_provider_usage','list_estimate_from_dimensions'])
    await insert({engine:seed,provider:'byteplus_modelark',settings:{...basicSettings(seed),inputMode:'ref2v',advanced:{extraInputValues:{output_format:'mp4'}},
      refs:{...basicSettings(seed).refs,inputs:[{kind:'image',slotId:'image_urls',url:'private-ref'}],referenceImages:['private-ref']}},cost:{provider_cost_status:costStatus,provider_tokens:30000,generate_audio:true}});
  await insert({engine:kling}); await insert({engine:kling,settings:{...basicSettings(kling),advanced:{extraInputValues:{camera_control:{type:'test'}}}}});
  const seedSettings=basicSettings(seed);
  for (const variant of [{...seedSettings,advanced:{extraInputValues:{output_format:'mov'}}},
    {...seedSettings,seedanceWorkflow:{step:'draft'}}]) {
    await insert({engine:seed,provider:'byteplus_modelark',price:{currency:'USD',totalCents:111},settings:variant,
      cost:{provider_cost_status:'list_estimate_from_provider_usage',provider_tokens:5000,generate_audio:true}});
  }
  const cfg=await insert({engine:kling,price:{currency:'USD',totalCents:222},settings:{...basicSettings(kling),
    advanced:{cfgScale:0.5,extraInputValues:null}}});
  await execute("INSERT INTO fal_queue_log VALUES($1,$2,'fal','private-remote',$3),($1,$2,'fal','private-remote',$4)",
    [cfg,kling,{request:{aspectRatio:'16:9'}},{request:{aspectRatio:'1:1'}}]);
  const groups=await loadHistoricalReplayGroups('2026-10-02','2026-11-01',execute);
  assert.equal(groups.reduce((sum,g)=>sum+g.jobs,0),21);
  assert.equal(groups.find(g=>g.engineId===h3 && g.jobs===2)?.bucketAt,'2026-10-25T01:00:00Z');
  assert.equal(groups[0].bucketAt,'2026-10-01T22:00:00Z');
  const text=groups[0].request!;
  assert.equal(text.promptCharacters,14); assert.equal(text.images,0); assert.equal(text.audioEnabled,true); assert.equal(text.h3PromptExpansion,'balanced');
  const ref=groups.find(g=>g.engineId===h3 && g.mode==='ref2v')!.request!;
  assert.equal(ref.images,1); assert.equal(ref.aspectRatio,'adaptive'); assert.equal(text.aspectRatio,null); assert.equal(ref.h3PromptExpansion,'disabled');
  const i2v=groups.find(g=>g.engineId===h3 && g.mode==='i2v')!.request!;
  assert.equal(i2v.aspectRatio,null); assert.equal(i2v.hasAudioReference,true);
  assert.equal(groups.find(g=>g.status==='failed')?.historicalProvider,null);
  assert.equal(groups.find(g=>g.status==='failed')?.paidWallet,false);
  assert.equal(groups.find(g=>g.ceilingMicros===4440000)?.historicalProvider,null);
  assert.ok([3330000,3340000].every(cap=>groups.find(g=>g.ceilingMicros===cap)?.request?.hasUnpricedOptions===true));
  const wanGroups=groups.filter(g=>g.engineId===wan && g.ceilingMicros===1000000);
  assert.equal(wanGroups.length,3); assert.ok(wanGroups.every(g=>g.historicalProvider==='fal' && g.request?.inputVideoSeconds===3.5));
  assert.deepEqual(wanGroups.map(g=>g.request!.referenceVideoSeconds??[]).sort((a,b)=>a.length-b.length),[[],[3.5],[1.5,2]]);
  assert.ok(groups.filter(g=>g.engineId===seed && g.ceilingMicros===1000000).every(g=>g.request?.hasUnpricedOptions===false && g.request?.images===1));
  assert.deepEqual(groups.filter(g=>g.engineId===seed && g.ceilingMicros===1000000).map(g=>g.request?.observedVideoTokens??0).sort((a,b)=>a-b),[0,30000]);
  assert.deepEqual(groups.filter(g=>g.engineId===kling && g.ceilingMicros===1000000).map(g=>g.request?.requiresDirectControls).sort(),[false,true]);
  assert.equal(groups.filter(g=>g.engineId===seed && g.ceilingMicros===1110000 && g.request?.hasUnpricedOptions).reduce((n,g)=>n+g.jobs,0),2);
  const cfgGroup=groups.find(g=>g.ceilingMicros===2220000)!;
  assert.equal(cfgGroup.request?.hasUnpricedOptions,false); assert.equal(cfgGroup.request?.aspectRatio,null);
  assert.equal(groups.find(g=>g.engineId==='unpriced-engine')?.ceilingMicros,null);
  assert.doesNotMatch(JSON.stringify(groups),/private|https|Private text/);
  assert.deepEqual(await loadHistoricalReplayGroups('2026-10-02','2026-11-01',execute),groups);

  await t.test('priced Kling and Wan attempts replay their attested options independently of the final owner', async () => {
    const created = '2026-10-29T15:20:00Z';
    const settings = (engineId: string, images: number, resolution: string, aspectRatio: string) => {
      const base = basicSettings(engineId);
      return { ...base, inputMode: 'ref2v', core: { ...base.core, resolution, aspectRatio },
        refs: { ...base.refs, inputs: Array.from({ length: images }, (_, i) => ({
          slotId: engineId === 'kling-v4' ? 'image_urls' : 'reference_image_urls', kind: 'image', url: 'private-image-' + i,
        })) } };
    };
    const exact = { engineId: 'kling-v4', mode: 'ref2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9',
      promptLength: 14, ownedReferenceImages: true, hasSeed: false, unreviewedOptions: false, audioEnabled: true,
      hasStartImage: false, hasEndImage: false, referenceImageCount: 3, referenceVideoCount: 0, referenceAudioCount: 0 };
    const fal = 'kling/v4/reference-to-video', sandbase = 'kuaishou/kling-v4.0/sandbase';
    const scenario = { engine: exact.engineId, created, settings: settings(exact.engineId, 3, '720p', '16:9') };
    const native = await insert(scenario);
    await attempt(native, 1, 'fal', 'completed', exact, 'private-remote', fal);
    const fallback = await insert(scenario);
    await attempt(fallback, 1, 'videorouter', 'failed', exact, null, sandbase);
    await attempt(fallback, 2, 'fal', 'completed', { fallbackFrom: 'videorouter' }, 'private-remote', fal);
    const hosted = await insert({ ...scenario, provider: 'videorouter' });
    await attempt(hosted, 1, 'videorouter', 'completed', exact, 'private-remote', sandbase);
    const legacy = await insert({ ...scenario, settings: { ...scenario.settings, ownedReferenceImages: true, hasSeed: false } });
    await execute("INSERT INTO fal_queue_log VALUES($1,'kling-v4','fal','private-remote',$2)", [legacy, { request: { aspectRatio: '16:9' } }]);

    const wanScenario = { engine: 'wan-3', created, provider: 'alibaba_model_studio',
      settings: settings('wan-3', 1, '480p', '9:16') };
    const wanSnapshot = { ...media, engineId: 'wan-3', resolution: '480p', aspectRatio: '9:16', referenceImageCount: 1,
      inputVideoDurationSec: 0, referenceVideoCount: 0, unreviewedWanOptions: false, trimmedPromptLength: 14 };
    const wanNative = await insert(wanScenario);
    await attempt(wanNative, 1, wanScenario.provider, 'completed',
      { ...wanSnapshot, ownedReferenceImages: true, hasSeed: false, promptExpansionEnabled: true }, 'private-remote', 'wan3.0-video');
    const wanLegacy = await insert(wanScenario);
    await attempt(wanLegacy, 1, wanScenario.provider, 'completed', wanSnapshot, 'private-remote', 'wan3.0-video');
    const legacyText = await insert({ engine: 'wan-3-prime', created, provider: 'alibaba_model_studio',
      settings: { ...basicSettings('wan-3-prime'), inputMode: 't2v', advanced: { seed: null, extraInputValues: { enable_prompt_expansion: true } } } });
    await attempt(legacyText, 1, 'alibaba_model_studio', 'completed',
      { ...wanSnapshot, engineId: 'wan-3-prime', mode:'t2v', resolution:'720p', aspectRatio:'16:9', referenceImageCount:0 },
      'private-remote', 'wan3.0-video-prime');
    const rows = (await loadHistoricalReplayGroups('2026-10-02','2026-11-01',execute))
      .filter(row => row.bucketAt === '2026-10-29T15:00:00Z');
    assert.equal(rows.reduce((n, row) => n + row.jobs, 0), 7);
    assert.equal(rows.filter(row => row.engineId === 'kling-v4' && row.request?.ownedReferenceImages)
      .reduce((n, row) => n + row.jobs, 0), 3);
    assert.equal(rows.filter(row => row.engineId === 'wan-3' && row.request?.ownedReferenceImages).length, 1);
    assert.doesNotMatch(JSON.stringify(rows), /private|https/);
    for (const row of rows) {
      assert.equal(row.request?.hasUnpricedOptions, false);
      const report = buildHistoricalReplay([row]);
      const trace = report.traces[0];
      assert.equal(trace.excludedReason, null);
      if (row.engineId === 'kling-v4') {
        assert.equal(row.request?.images, 3);
        if (row.request?.ownedReferenceImages) {
          assert.equal(row.jobs, row.historicalProvider === 'fal' ? 2 : 1);
          assert.equal(row.request.hasSeed, false);
          assert.equal(trace.installed?.provider, 'videorouter');
          assert.equal(trace.historicalMicros, row.historicalProvider === 'fal' ? 785_000 : 683_932);
          assert.equal(trace.installed.costMicros, 683_932);
        } else {
          assert.equal(row.request?.hasSeed, undefined);
          assert.deepEqual(trace.installed?.order, ['fal']);
          assert.equal(report.totals.installedSavingsMicros, 0);
        }
      } else if (row.engineId === 'wan-3-prime') {
        assert.equal(row.request?.hasSeed, false);
        assert.equal(row.request?.promptExpansionEnabled, true);
        assert.equal(trace.installed?.provider, 'videorouter');
      } else if (row.request?.ownedReferenceImages) {
        assert.equal(row.request.hasSeed, false);
        assert.equal(row.request.promptExpansionEnabled, true);
        assert.equal(row.request.promptCharacters, 14);
        assert.equal(trace.installed?.provider, 'videorouter');
        assert.equal(trace.installed.costMicros, 113_263);
      } else {
        assert.equal(row.request?.promptExpansionEnabled, undefined);
        assert.equal(trace.offers.some(offer => offer.provider === 'videorouter'), false);
      }
    }
  });
});
