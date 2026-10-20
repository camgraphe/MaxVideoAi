import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCreatorSegment, validateCreatorOutputTiming, buildCreatorMuxArgs } from '../frontend/src/server/tools/creator-segment-media';
import { inspectCreatorBytes, trimCreatorBytes, muxCreatorBytes } from '../frontend/src/server/tools/creator-segment-media';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import ffprobe from '../frontend/node_modules/ffprobe-static';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
test('explicit segments reject out-of-bounds and whole source remains explicit', () => {
  assert.deepEqual(validateCreatorSegment({startSec:2,endSec:7},10),{startSec:2,endSec:7});
  for (const segment of [{startSec:-1,endSec:4},{startSec:3,endSec:3},{startSec:0,endSec:11},{startSec:NaN,endSec:5}]) assert.throws(()=>validateCreatorSegment(segment,10));
  assert.equal(validateCreatorSegment(undefined,7.4),null);
});
test('real local FFmpeg trims one selected segment and maps chosen audio without changing either source',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'creator-fixture-'));
  try {
    const path=join(directory,'source.mp4');
    await promisify(execFile)(await ensureExecutableFfmpegPath(ffmpeg.path),['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=30:d=4','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=4','-c:v','libx264','-threads','1','-c:a','aac','-y',path],{timeout:15000});
    const original=await readFile(path);const facts=await inspectCreatorBytes(original,'video','video/mp4');
    const segment=await trimCreatorBytes(original,facts,{startSec:1,endSec:3});
    assert.equal(segment.facts.durationSec,2);assert.equal(segment.facts.hasAudio,true);
    const muted=await muxCreatorBytes(segment.bytes,null);assert.equal(muted.facts.hasAudio,false);assert.equal(muted.facts.durationSec,2);
    const restored=await muxCreatorBytes(muted.bytes,segment.bytes);assert.equal(restored.facts.hasAudio,true);
    validateCreatorOutputTiming(2,restored.facts.audioDurationSec??null,restored.facts.fps);
    assert.deepEqual(await readFile(path),original);
  }finally {await rm(directory,{recursive:true,force:true});}
});
test('finalization cannot silently truncate, loop or time-stretch source sound', () => {
  assert.doesNotThrow(()=>validateCreatorOutputTiming(7.4,7.41,30));
  assert.throws(()=>validateCreatorOutputTiming(7.4,8,30),/duration/);
  assert.throws(()=>validateCreatorOutputTiming(10.34449,10.041667,24),/duration/);
  assert.doesNotThrow(()=>validateCreatorOutputTiming(10.34449,10.333333,24));
  const args=buildCreatorMuxArgs('v.mp4','a.wav','out.mp4');
  assert.ok(args.includes('1:a:0'));
  for (const forbidden of ['-shortest','-t','-stream_loop','atempo','apad']) assert.ok(!args.includes(forbidden));
});

test('real Wan fractional finalization trims generated video only and retains the complete selected voice',async()=>{
  const { trimCreatorGeneratedVideoTail } = await import('../frontend/src/server/tools/creator-segment-media');
  const directory=await mkdtemp(join(tmpdir(),'creator-wan-timing-'));
  try {
    const video=join(directory,'generated.mp4'),audio=join(directory,'voice.wav');
    const binary=await ensureExecutableFfmpegPath(ffmpeg.path);
    await promisify(execFile)(binary,['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=30:d=3','-f','lavfi','-i','sine=frequency=200:sample_rate=48000:duration=3','-c:v','libx264','-threads','1','-c:a','aac','-y',video],{timeout:15000});
    await promisify(execFile)(binary,['-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=2.53','-c:a','pcm_s16le','-y',audio],{timeout:15000});
    const originalAudio=await readFile(audio),videoBytes=await readFile(video),videoFacts=await inspectCreatorBytes(videoBytes,'video','video/mp4');
    const trimmed=await trimCreatorGeneratedVideoTail(videoBytes,videoFacts,2.53);
    assert.equal(trimmed.facts.hasAudio,false);
    validateCreatorOutputTiming(2.53,trimmed.facts.durationSec,trimmed.facts.fps);
    const trimmedPath=join(directory,'trimmed.mp4');await writeFile(trimmedPath,trimmed.bytes);
    const {stdout:frameJson}=await promisify(execFile)(ffprobe.path!,['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',trimmedPath],{timeout:15000});
    const {frames}=JSON.parse(frameJson) as {frames:Array<{best_effort_timestamp_time:string}>};
    // FFprobe 4.0.2 reports 2.533984s and 4.4 reports 2.533333s for the same MP4:
    // MP4 edit-list rounding differs, but both must decode exactly 76 frames.
    assert.equal(frames.length,76);
    frames.forEach((frame,index)=>assert.equal(frame.best_effort_timestamp_time,(index/30).toFixed(6)));
    const final=await muxCreatorBytes(trimmed.bytes,originalAudio);
    assert.equal(final.facts.hasAudio,true);validateCreatorOutputTiming(2.53,final.facts.audioDurationSec??null,final.facts.fps);
    const finalPath=join(directory,'final.mp4');await writeFile(finalPath,final.bytes);
    const decodeAudio=async(path:string)=>(await promisify(execFile)(binary,['-v','error','-i',path,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','pipe:1'],{encoding:'buffer',timeout:15000,maxBuffer:1024*1024})).stdout;
    const selectedPcm=await decodeAudio(audio),finalPcm=await decodeAudio(finalPath);
    assert.equal(selectedPcm.length/4,121440); // All 2.53 seconds at 48 kHz.
    assert.ok(finalPcm.length>=selectedPcm.length,'The final audio retains every selected sample position.');
    // Compare the beginning and last 50 ms at the same sample positions. AAC is
    // lossy, but wrong provider sound, silence, a shifted voice or a cut tail fail.
    for(const [start,end] of [[0,2400],[119040,121440]]){
      let signal=0,error=0;
      for(let sample=start;sample<end;sample++){
        const selected=selectedPcm.readFloatLE(sample*4),actual=finalPcm.readFloatLE(sample*4);
        signal+=selected*selected;error+=(actual-selected)**2;
      }
      assert.ok(error/signal<0.01,`Selected voice differs at samples ${start}–${end}.`);
    }
    assert.deepEqual(await readFile(audio),originalAudio);
    assert.deepEqual(await readFile(video),videoBytes);
    await assert.rejects(trimCreatorGeneratedVideoTail(videoBytes,videoFacts,3.01),/too short/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
