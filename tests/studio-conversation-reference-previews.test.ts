import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {startDisposablePostgres} from './helpers/disposable-postgres';

const base = 'https://reference-previews-fixture.s3.us-east-1.amazonaws.com';
Object.assign(process.env, {S3_BUCKET: 'reference-previews-fixture', S3_REGION: 'us-east-1', S3_PUBLIC_BASE_URL: base, S3_ACCESS_KEY_ID: 'fixture-key', S3_SECRET_ACCESS_KEY: 'fixture-secret'});
const ref = (letter: string, kind: 'image'|'video'|'audio' = 'image') => ({type: 'asset' as const, assetId: 'ma_'+letter.repeat(32), kind});
const request = (body: string, origin = 'https://studio.test') => new NextRequest('https://studio.test/api/studio/projects/film/reference-previews', {method: 'POST', headers: {origin, 'content-type': 'application/json'}, body});

test('reference previews resolve exact owned media in a read-only project scope and expose only transient access', async () => {
  const module = await import('../frontend/src/server/studio/conversation-reference-previews').catch(() => null);
  assert.ok(module?.readConversationReferencePreviews, 'The bounded reference preview reader must exist.');
  const database = await startDisposablePostgres('strefs');
  try {
    await database.pool.query(`
      CREATE TABLE studio_projects(id text PRIMARY KEY, user_id text, deleted_at timestamptz);
      CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text, hidden boolean);
      CREATE TABLE job_outputs(id text PRIMARY KEY, job_id text, user_id text, status text);
      CREATE TABLE media_assets(id text PRIMARY KEY, public_id text, user_id text, kind text, url text, thumb_url text, mime_type text, status text, deleted_at timestamptz, source_job_id text, source_output_id text, metadata jsonb, original_name text);
      INSERT INTO studio_projects VALUES ('film','owner',null), ('foreign','other',null), ('deleted','owner',now());
    `);
    const rows = [
      ['a','owner','image',`${base}/user-assets/owner/image.png`,`${base}/user-assets/owner/thumb.jpg`,'image/png',{mediaFacts:{source:'probe',width:640,height:480}},'My image.png'],
      ['b','owner','video',`${base}/user-assets/owner/video.mp4`,`${base}/user-assets/other/private.jpg`,'video/mp4',{mediaFacts:{source:'probe',durationSec:9.25,width:640,height:480}},null],
      ['c','owner','audio','https://cdn.maxvideoai.com/sound.wav?token=exact',null,'audio/wav',{durationSec:99},null],
      ['d','other','image',`${base}/user-assets/other/secret.png`,null,'image/png',{},null],
      ['e','owner','image',`${base}/user-assets/other/forged.png`,null,'image/png',{},null],
      ['f','owner','video','https://cdn.maxvideoai.com/video.mp4',`${base}/user-assets/owner/external-thumb.jpg`,'video/mp4',{},null],
    ];
    for (const [letter,owner,kind,url,thumb,mime,metadata,name] of rows) await database.pool.query('INSERT INTO media_assets VALUES ($1,$2,$3,$4,$5,$6,$7,\'ready\',null,null,null,$8,$9)', [letter,'ma_'+String(letter).repeat(32),owner,kind,url,thumb,mime,JSON.stringify(metadata),name]);
    const client = await database.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const execute = async <T>(sql: string, values?: ReadonlyArray<unknown>) => (await client.query(sql, values as unknown[])).rows as T[];
      const signs: string[] = [];
      const dependencies = {execute, now: () => new Date('2026-10-03T12:00:00Z'), sign: async (key: string, options: {expiresInSeconds?: number}) => {
        assert.equal(options.expiresInSeconds,300); signs.push(key); return 'https://grants.test/'+encodeURIComponent(key)+'?token=read';
      }};
      const assets = await module.readConversationReferencePreviews({userId:'owner',projectId:'film'},{refs:[ref('a'),ref('b','video'),ref('c','audio'),ref('a')]},dependencies);
      assert.equal(assets.length,3,'Repeated references share the same exact lookup and grant.');
      assert.deepEqual(assets[0],{assetId:ref('a').assetId,kind:'image',name:'My image.png',url:'https://grants.test/user-assets%2Fowner%2Fimage.png?token=read',thumbUrl:'https://grants.test/user-assets%2Fowner%2Fthumb.jpg?token=read',expiresAt:'2026-10-03T12:05:00.000Z',durationSec:null,mediaFacts:{source:'probe',width:640,height:480}});
      assert.equal(assets[1].thumbUrl,null,'Foreign thumbnail never falls back to its canonical private URL.');
      assert.equal(assets[1].durationSec,9.25);
      assert.equal(assets[2].url,'https://cdn.maxvideoai.com/sound.wav?token=exact');
      assert.equal(assets[2].durationSec,null,'Requested or historical durations are not measured facts.');
      assert.equal(assets[2].expiresAt,null);
      assert.doesNotMatch(JSON.stringify(assets),/originalAccess|storageKey|reference-previews-fixture|forged|private\.jpg/);
      assert.deepEqual(signs,['user-assets/owner/image.png','user-assets/owner/thumb.jpg','user-assets/owner/video.mp4']);
      const externalWithPrivatePoster = await module.readConversationReferencePreviews({userId:'owner',projectId:'film'},{refs:[ref('f','video')]},dependencies);
      assert.equal(externalWithPrivatePoster[0].url,'https://cdn.maxvideoai.com/video.mp4');
      assert.equal(externalWithPrivatePoster[0].thumbUrl,'https://grants.test/user-assets%2Fowner%2Fexternal-thumb.jpg?token=read');
      assert.equal(externalWithPrivatePoster[0].expiresAt,'2026-10-03T12:05:00.000Z','A private poster expires even when its original is external.');
      for (const projectId of ['foreign','deleted','missing']) await assert.rejects(module.readConversationReferencePreviews({userId:'owner',projectId},{refs:[ref('a')]},dependencies),/STUDIO_PROJECT_NOT_FOUND/);
      for (const asset of [ref('d'),ref('e'),ref('a','video')]) await assert.rejects(module.readConversationReferencePreviews({userId:'owner',projectId:'film'},{refs:[asset]},dependencies),/MEDIA_NOT_AVAILABLE/);
      await assert.rejects(module.readConversationReferencePreviews({userId:'owner',projectId:'film'},{refs:[ref('a')]},{...dependencies,sign:async()=>{throw new Error('Signing service failed with private key');}}),/Signing service failed/);
      const thumbnailFailure = await module.readConversationReferencePreviews({userId:'owner',projectId:'film'},{refs:[ref('a')]},{...dependencies,sign:async(key,options)=>{if(key.endsWith('thumb.jpg'))throw new Error('No thumbnail');return dependencies.sign(key,options);}});
      assert.equal(thumbnailFailure[0].thumbUrl,thumbnailFailure[0].url,'An image may fall back only to its readable original.');
      await client.query('ROLLBACK');
    } finally {client.release();}
  } finally {await database.cleanup();}
});

test('reference preview HTTP boundary enforces session, pilot, same origin, project and bounded canonical input', async () => {
  const module = await import('../frontend/app/api/studio/_lib/studio-reference-previews-handler').catch(() => null);
  assert.ok(module?.handleStudioReferencePreviews, 'The authenticated reference preview handler must exist.');
  let reads = 0;
  const options = {enabled:true, resolveAccess:async()=>({ok:true as const,userId:'owner'}), read:async(actor:unknown,input:unknown)=>{
    reads++; assert.deepEqual(actor,{userId:'owner',projectId:'film'}); assert.deepEqual(input,{refs:[ref('a')]}); return [];
  }};
  const body = JSON.stringify({refs:[ref('a')]});
  assert.equal((await module.handleStudioReferencePreviews(request(body),'film',{...options,resolveAccess:async()=>({ok:false as const,status:401 as const,error:'UNAUTHORIZED'})})).status,401);
  assert.equal((await module.handleStudioReferencePreviews(request(body),'film',{...options,enabled:false})).status,404);
  assert.equal((await module.handleStudioReferencePreviews(request(body,'https://foreign.test'),'film',options)).status,403);
  const crossSite = request(body);crossSite.headers.set('sec-fetch-site','cross-site');
  assert.equal((await module.handleStudioReferencePreviews(crossSite,'film',options)).status,403);
  assert.equal((await module.handleStudioReferencePreviews(request(body),' film',options)).status,400);
  for(const invalid of [{refs:[]},{refs:Array.from({length:9},()=>ref('a'))},{refs:[{...ref('a'),url:'https://foreign.test/secret'}]},{refs:[{...ref('a'),assetId:'internal'}]},{refs:[{type:'job-output',jobId:'job',outputId:'out',kind:'image'}]},{refs:[ref('a')],projectId:'foreign'}]) assert.equal((await module.handleStudioReferencePreviews(request(JSON.stringify(invalid)),'film',options)).status,400);
  assert.equal((await module.handleStudioReferencePreviews(request('{'),'film',options)).status,400);
  assert.equal((await module.handleStudioReferencePreviews(request('x'.repeat(12001)),'film',options)).status,413);
  assert.equal(reads,0,'Denied and invalid requests never reach the media reader.');
  const response = await module.handleStudioReferencePreviews(request(body),'film',options);
  assert.deepEqual(await response.json(),{ok:true,assets:[]});
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(reads,1);
  for(const [message,status] of [['STUDIO_PROJECT_NOT_FOUND',404],['MEDIA_NOT_AVAILABLE',404],['Signing service failed with private key',503]] as const){
    const failed=await module.handleStudioReferencePreviews(request(body),'film',{...options,read:async()=>{throw new Error(message);}});
    assert.equal(failed.status,status); assert.doesNotMatch(await failed.text(),/private key/);
  }
});
