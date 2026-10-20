import assert from 'node:assert/strict';
import test from 'node:test';
import {createScribeAdapter} from '../frontend/src/server/subtitles/scribe';

test('Scribe submits only its verified endpoint and polling never submits again',async()=>{
  const calls:Array<{method:string;endpoint:string;input?:unknown}>=[];let complete=false;
  const adapter=createScribeAdapter({
    submit:async(endpoint,input)=>{calls.push({method:'submit',endpoint,input});return {request_id:'scribe-request'};},
    status:async(endpoint,requestId)=>{assert.equal(requestId,'scribe-request');calls.push({method:'status',endpoint});return {status:complete?'COMPLETED':'IN_PROGRESS'};},
    result:async(endpoint,requestId)=>{assert.equal(requestId,'scribe-request');calls.push({method:'result',endpoint});return {data:{text:'Bonjour',language_code:'fra',words:[{text:'Bonjour',type:'word',start:0,end:1}]}};},
  });
  const submission=await adapter.submit({audioUrl:'https://owned.example/audio.wav',language:'fra',keyterms:['MaxVideoAI']});assert.equal(submission.requestId,'scribe-request');
  assert.deepEqual((calls[0].input as object),{audio_url:'https://owned.example/audio.wav',language_code:'fra',keyterms:['MaxVideoAI'],diarize:true,tag_audio_events:false});
  assert.equal((await adapter.poll(submission.requestId)).state,'pending');assert.equal(calls.filter(c=>c.method==='result').length,0);
  complete=true;assert.equal((await adapter.poll(submission.requestId)).state,'completed');assert.equal(calls.filter(c=>c.method==='submit').length,1);
  assert.ok(calls.every(c=>c.endpoint==='fal-ai/elevenlabs/speech-to-text/scribe-v2'));
  await assert.rejects(adapter.submit({audioUrl:'https://owned.example/audio.wav',keyterms:Array(101).fill('term')}));
  assert.equal(calls.filter(c=>c.method==='submit').length,1);
});

test('Scribe records a terminal rejected result but keeps network failures retryable',async()=>{
  const dependencies={submit:async()=>({request_id:'r'}),status:async()=>({status:'COMPLETED'}),result:async()=>{throw Object.assign(new Error('invalid audio'),{status:422});}};
  assert.deepEqual(await createScribeAdapter(dependencies).poll('r'),{state:'failed',message:'SUBTITLE_PROVIDER_REJECTED'});
  await assert.rejects(createScribeAdapter({...dependencies,result:async()=>{throw new Error('connection reset');}}).poll('r'),/connection reset/);
});
