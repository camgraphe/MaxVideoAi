import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { inspectVideoExcerptBytes, trimVideoExcerptBytes, withVideoExcerptSlot } from '../frontend/server/video-excerpts/media';
const exec = promisify(execFile);
test('real 60s rotated video produces an accurate 33s portrait excerpt with the selected audible content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'excerpt-fixture-'));
  try {
    const binary = await ensureExecutableFfmpegPath(ffmpeg.path), input = join(dir, 'source.mp4'), rotated = join(dir, 'rotated.mp4');
    await exec(binary, ['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=30:d=60', '-f','lavfi','-i',"aevalsrc=sin(2*PI*(440+440*gte(t\\,20))*t):s=48000:d=60",'-c:v','libx264','-threads','1','-c:a','aac','-y',input], {timeout:30000});
    await exec(binary, ['-v','error','-i',input,'-c','copy','-metadata:s:v:0','rotate=90','-y',rotated], {timeout:15000});
    const bytes = await readFile(rotated), facts = await inspectVideoExcerptBytes(bytes, 'video/mp4');
    assert.equal(facts.durationSec, 60); assert.equal(facts.width, 120); assert.equal(facts.height, 160);
    const result = await trimVideoExcerptBytes(bytes, facts, {startSec:21,endSec:54});
    assert.equal(result.facts.width, 120); assert.equal(result.facts.height, 160);
    assert.equal(result.facts.hasAudio, true); assert.ok(Math.abs(result.facts.durationSec - 33) <= 1/30);
    assert.equal(result.facts.videoCodec, 'h264'); assert.equal(result.facts.audioCodec, 'aac');
    assert.deepEqual(await readFile(rotated), bytes);
    const output = join(dir,'cut.mp4'); await writeFile(output,result.bytes);
    const pcm = (await exec(binary, ['-v','error','-i',output,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','pipe:1'], {encoding:'buffer',timeout:15000,maxBuffer:8*1024*1024})).stdout;
    // Count zero crossings in the middle second: choosing the wrong passage retains 440 Hz.
    let crossings=0; for(let i=48001;i<96000;i++) if(pcm.readFloatLE((i-1)*4)<=0 && pcm.readFloatLE(i*4)>0) crossings++;
    assert.ok(Math.abs(crossings-880)<=2, `selected audio frequency ${crossings}`);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('worker guard bounds concurrent work and releases slots on failure', async () => {
  let release!: () => void;
  const hold = withVideoExcerptSlot('a', () => new Promise<void>(resolve => {release=resolve;}));
  await assert.rejects(withVideoExcerptSlot('a', async () => undefined), /busy/i);
  await assert.rejects(withVideoExcerptSlot('b', async () => {throw new Error('test failure');}), /test failure/);
  await withVideoExcerptSlot('b', async () => undefined);
  release(); await hold;
  await withVideoExcerptSlot('a', async () => undefined);
});

test('valid WebM without stream duration uses the measured container duration and preserves silence', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'excerpt-webm-'));
  try {
    const path=join(dir,'source.webm');
    await exec(await ensureExecutableFfmpegPath(ffmpeg.path), ['-v','error','-f','lavfi','-i','color=c=red:s=160x120:r=24:d=3','-an','-c:v','libvpx-vp9','-threads','1','-y',path], {timeout:15000});
    const bytes=await readFile(path), facts=await inspectVideoExcerptBytes(bytes,'video/webm');
    assert.equal(facts.durationSec,3);assert.equal(facts.hasAudio,false);
    const result=await trimVideoExcerptBytes(bytes,facts,{startSec:0.5,endSec:2.5});
    assert.equal(result.facts.hasAudio,false);assert.equal(result.facts.durationSec,2);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('probe fallback handles N/A stream timing and identifies the actual video after an attached cover', async()=>{
  const {resolveVideoExcerptFacts}=await import('../frontend/server/video-excerpts/media');
  const measured=resolveVideoExcerptFacts({streams:[
    {index:0,codec_type:'video',codec_name:'png',width:640,height:640,duration:'60',avg_frame_rate:'0/0',disposition:{attached_pic:1}},
    {index:2,codec_type:'video',codec_name:'vp9',width:160,height:120,duration:'N/A',avg_frame_rate:'24/1'},
  ],format:{format_name:'webm',duration:'60'}},'video/webm',100);
  assert.equal(measured.durationSec,60);assert.equal(measured.width,160);assert.equal(measured.videoStreamIndex,2);
});

test('stored container rounding allows one frame while rejecting changed timing, geometry or audio',async()=>{
  const {validateStoredVideoExcerptFacts}=await import('../frontend/server/video-excerpts/media');
  const source={kind:'video' as const,width:120,height:160,durationSec:3.2,fps:30,hasAudio:true,sizeBytes:1,mimeType:'video/mp4',videoCodec:'h264',audioCodec:'aac'};
  const stored={durationSec:3.208,width:120,height:160,mediaFacts:{hasAudio:true}};
  assert.doesNotThrow(()=>validateStoredVideoExcerptFacts(source,stored));
  assert.throws(()=>validateStoredVideoExcerptFacts(source,{...stored,durationSec:3.3}));
  assert.throws(()=>validateStoredVideoExcerptFacts(source,{...stored,width:160}));
  assert.throws(()=>validateStoredVideoExcerptFacts(source,{...stored,mediaFacts:{hasAudio:false}}));
});
