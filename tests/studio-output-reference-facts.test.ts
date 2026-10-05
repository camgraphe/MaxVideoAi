import assert from 'node:assert/strict';
import test from 'node:test';
import type {StudioMediaExecutor} from '../frontend/src/server/studio/media-resolver';

// Only this isolated test process configures storage; every HEAD is injected.
process.env.S3_PUBLIC_BASE_URL = 'https://studio-reference-metadata.test';
const resolver = import('../frontend/src/server/studio/media-resolver');
const original = 'https://cdn.maxvideoai.com/original.png';
const output = {id:'output-1',job_id:'job-1',user_id:'owner',job_user_id:'owner',kind:'image',url:original,
  mime_type:'image/png',status:'ready',hidden:false,width:1920,height:1080,
  metadata:{mediaFacts:{source:'probe',width:1920,height:1080}}};
const ref = {type:'job-output',jobId:'job-1',outputId:'output-1',kind:'image'} as const;
const saved = {id:'saved-1',public_id:`ma_${'a'.repeat(32)}`,user_id:'owner',kind:'image',
  url:'https://studio-reference-metadata.test/media-assets/owner/copied.png',mime_type:'image/png',
  source_job_id:'job-1',source_output_id:'output-1',status:'ready',deleted_at:null,size_bytes:8192,
  width:1920,height:1080,metadata:{originUrl:original}};

test('production-shaped output without size_bytes reuses measured saved facts without promotion or network',async()=>{
  const {resolveStudioMedia}=await resolver;
  const reads:string[]=[];
  const execute:StudioMediaExecutor=async(sql)=>{reads.push(sql);return sql.includes('FROM media_assets')?[saved]:[output];};
  const result=await resolveStudioMedia('owner',ref,execute,{completeReferenceFacts:true,referenceFactsSignal:AbortSignal.timeout(8_000),
    headReferenceMetadata:async()=>{assert.fail('Exact saved measurements need no HEAD');}});
  assert.equal(result.sizeBytes,8192);
  assert.equal(result.url,original,'The native identity is preserved, not replaced with the saved copy');
  assert.deepEqual(result.ref,ref);
  assert.equal(reads.filter(sql=>sql.includes('FROM job_outputs')).length,2,'Revalidate the native source after fact lookup');
  for(const sql of reads)assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|CREATE|ALTER/);
});

test('saved measurements require exact owner, job, output, kind and unchanged original identity',async()=>{
  const {resolveStudioMedia}=await resolver;
  for(const delta of [{user_id:'other'},{source_job_id:'other'},{source_output_id:'other'},{kind:'video'},
    {status:'processing'},{deleted_at:'today'},{metadata:{originUrl:'https://cdn.maxvideoai.com/other.png'}},
    {url:'https://studio-reference-metadata.test/media-assets/other/copied.png'},
    {mime_type:'image/jpeg'},{size_bytes:0},{size_bytes:1.5}]) {
    const result=await resolveStudioMedia('owner',ref,async sql=>sql.includes('FROM media_assets')?[{...saved,...delta}]:[output],
      {completeReferenceFacts:true,headReferenceMetadata:async()=>{assert.fail('External originals must never be probed');}});
    assert.equal(result.sizeBytes,null,JSON.stringify(delta));
  }
});

test('ordinary reads do not HEAD or read saved assets; owned storage completion uses one HEAD of original only',async()=>{
  const {resolveStudioMedia}=await resolver;
  const owned={...output,url:'https://studio-reference-metadata.test/renders/images/owner/original.png',
    thumb_url:'https://studio-reference-metadata.test/renders/thumbs/owner/preview.jpg'};
  let heads=0,savedReads=0;
  const execute:StudioMediaExecutor=async sql=>{if(sql.includes('FROM media_assets')){savedReads++;return [];}return [owned];};
  const head=async(key:string,signal:AbortSignal)=>{
    heads++;assert.equal(key,'renders/images/owner/original.png');assert.equal(signal,budget);
    return {size:16384,mime:'image/png'};
  };
  const budget=AbortSignal.timeout(8_000);
  assert.equal((await resolveStudioMedia('owner',ref,execute,{headReferenceMetadata:head})).sizeBytes,null);
  assert.equal(heads,0);assert.equal(savedReads,0);
  assert.equal((await resolveStudioMedia('owner',ref,execute,{completeReferenceFacts:true,referenceFactsSignal:budget,headReferenceMetadata:head})).sizeBytes,16384);
  assert.equal(heads,1);assert.equal(savedReads,1);
  for(const delta of [{user_id:'other'},{job_user_id:'other'},{status:'processing'},{hidden:true},{job_id:'other'},
    {id:'other'},{url:'https://studio-reference-metadata.test/renders/images/other/original.png'}]) {
    await assert.rejects(resolveStudioMedia('owner',ref,async()=>[{...owned,...delta}],{completeReferenceFacts:true,headReferenceMetadata:head}),/MEDIA_NOT_AVAILABLE/);
  }
  assert.equal(heads,1,'Authorization failures precede metadata access');
});

test('source drift during fact reads never returns a completed reference',async()=>{
  const {resolveStudioMedia}=await resolver;
  for(const delta of [{url:'https://cdn.maxvideoai.com/replaced.png'},{user_id:'other'},{hidden:true},{status:'processing'},
    {metadata:{mediaFacts:{source:'probe',width:640,height:480}}}]) {
    let reads=0;
    await assert.rejects(resolveStudioMedia('owner',ref,async sql=>{
      if(sql.includes('FROM media_assets'))return [saved];
      return [reads++===0?output:{...output,...delta}];
    },{completeReferenceFacts:true,headReferenceMetadata:async()=>{assert.fail('No HEAD');}}),/MEDIA_NOT_AVAILABLE/);
  }
});

test('HEAD validates measured byte count/MIME and shares one abort budget across references',async()=>{
  const {resolveStudioMedia}=await resolver;
  const owned={...output,url:'https://studio-reference-metadata.test/renders/images/owner/original.png'};
  const execute:StudioMediaExecutor=async sql=>sql.includes('FROM media_assets')?[]:[owned];
  for(const size of [null,0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    const result=await resolveStudioMedia('owner',ref,execute,{completeReferenceFacts:true,headReferenceMetadata:async()=>({size,mime:'image/png'})});
    assert.equal(result.sizeBytes,null);
  }
  await assert.rejects(resolveStudioMedia('owner',ref,execute,{completeReferenceFacts:true,headReferenceMetadata:async()=>({size:4096,mime:'image/jpeg'})}),/MEDIA_NOT_AVAILABLE/);
  const controller=new AbortController();let heads=0;
  const options={completeReferenceFacts:true,referenceFactsSignal:controller.signal,headReferenceMetadata:async(_key:string,signal:AbortSignal)=>{
    heads++;assert.equal(signal,controller.signal);controller.abort();return {size:4096,mime:'image/png'};
  }};
  await assert.rejects(resolveStudioMedia('owner',ref,execute,options),{name:'AbortError'});
  await assert.rejects(resolveStudioMedia('owner',ref,execute,options),{name:'AbortError'});
  assert.equal(heads,1,'The second reference cannot allocate a fresh metadata timeout');
});

test('URL-bound generated video measurements need no HEAD; stale provenance supplies no size',async()=>{
  const {resolveStudioMedia}=await resolver;
  const url='https://cdn.maxvideoai.com/original.mp4';
  const facts={source:'probe',version:1,probe:'ffprobe',original:{url,sha256:'a'.repeat(64),sizeBytes:27000},
    durationSec:6,videoDurationSec:6,audioDurationSec:null,containerDurationSec:6};
  for(const stale of [false,true]) {
    const row={...output,kind:'video',url,mime_type:'video/mp4',metadata:{mediaFacts:{...facts,original:{...facts.original,url:stale?'https://cdn.maxvideoai.com/other.mp4':url}}}};
    const pending=resolveStudioMedia('owner',{...ref,kind:'video'},async sql=>sql.includes('FROM media_assets')?[]:[row],
      {completeReferenceFacts:true,headReferenceMetadata:async()=>{assert.fail('No external HEAD');}});
    if(stale)await assert.rejects(pending,/MEDIA_NOT_AVAILABLE/);
    else assert.equal((await pending).sizeBytes,27000);
  }
});
