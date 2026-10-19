import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCreatorSegment, validateCreatorOutputTiming, buildCreatorMuxArgs } from '../frontend/src/server/tools/creator-segment-media';
import { inspectCreatorBytes, trimCreatorBytes, muxCreatorBytes } from '../frontend/src/server/tools/creator-segment-media';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
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
  const args=buildCreatorMuxArgs('v.mp4','a.wav','out.mp4');
  assert.ok(args.includes('1:a:0'));
  for (const forbidden of ['-shortest','-t','-stream_loop','atempo','apad']) assert.ok(!args.includes(forbidden));
});
