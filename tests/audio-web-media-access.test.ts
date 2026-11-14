import assert from 'node:assert/strict';
import test from 'node:test';

process.env.S3_BUCKET = 'audio-web-test';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'test-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
const base='https://audio-web-test.s3.us-east-1.amazonaws.com';
const pending=import('../frontend/src/server/audio/audio-web-media-access').catch(()=>null);
const record={job_id:'audio-job',user_id:'owner',surface:'audio',status:'completed',video_url:`${base}/renders/owner/video.mp4`,audio_url:`${base}/renders/owner/audio.m4a`,settings_snapshot:{sourceVideoUrl:`${base}/renders/owner/source.mp4`}};

test('Audio website resolves exact owned originals with fresh read grants and no stored URL mutation',async()=>{
  const api=await pending;assert.ok(api?.resolveAudioWebMedia);
  const snapshot=JSON.stringify(record);let reads=0;
  for(const kind of ['video','audio','source'] as const){
    const result=await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind},{read:async input=>{reads++;assert.deepEqual(input,{userId:'owner',jobId:'audio-job'});return record as never}});
    assert.ok(result);const url=new URL(result.url);
    assert.match(url.searchParams.get('X-Amz-Signature')??'',/^[a-f0-9]{64}$/);
    assert.equal(url.searchParams.get('X-Amz-Expires'),'300');
    assert.equal(url.pathname,`/renders/owner/${kind==='source'?'source.mp4':kind==='video'?'video.mp4':'audio.m4a'}`);
  }
  assert.equal(reads,3);assert.equal(JSON.stringify(record),snapshot);
});

test('Audio website denies another account, foreign storage, missing and non-Audio records',async()=>{
  const api=await pending;assert.ok(api?.resolveAudioWebMedia);
  for(const job of [null,{...record,user_id:'other'},{...record,surface:'video'},{...record,video_url:null}]){
    assert.equal(await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'video'},{read:async()=>job as never}),null);
  }
  await assert.rejects(()=>api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'source'},{read:async()=>({...record,settings_snapshot:{sourceVideoUrl:`${base}/renders/other/source.mp4`}}) as never}),/MEDIA_NOT_AVAILABLE/);
});

test('Audio website preserves exact public source and never accepts a caller supplied file URL',async()=>{
  const api=await pending;assert.ok(api?.resolveAudioWebMedia);
  const url='https://cdn.maxvideoai.com/public.mp4?version=original';
  const result=await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'video'},{read:async()=>({...record,video_url:url}) as never});
  assert.equal(result?.url,url);
  assert.equal(await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'audio'},{read:async()=>({...record,audio_url:'file:///etc/passwd'}) as never}),null);
});

test('Audio source restoration accepts pending jobs and resolves a legacy source job only in the same account',async()=>{
  const api=await pending;assert.ok(api?.resolveAudioWebMedia);
  const job={...record,status:'running',settings_snapshot:{sourceJobId:'source-job'}};
  const reads:unknown[]=[];
  const read=async(input:{jobId:string;userId:string})=>{reads.push(input);return (input.jobId==='audio-job'?job:{...record,job_id:'source-job',surface:'video'}) as never};
  assert.equal(await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'video'},{read}),null);
  const source=await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'source'},{read});
  assert.ok(source?.url.includes('X-Amz-Signature='));
  assert.deepEqual(reads.at(-1),{userId:'owner',jobId:'source-job'});
  assert.equal(await api.resolveAudioWebMedia({userId:'owner',jobId:'audio-job',kind:'source'},{read:async input=>(input.jobId==='audio-job'?job:{...record,job_id:'source-job',user_id:'other'}) as never}),null);
});
