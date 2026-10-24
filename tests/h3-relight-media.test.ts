import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { inspectVideoExcerptBytes } from '../frontend/server/video-excerpts/media';
import { prepareH3RelightCopy } from '../frontend/server/video-excerpts/h3-relight';
import { validateH3Source } from '../frontend/lib/h3-source-operations';
test('real 25fps 139-frame rotated source is rejected then explicitly prepared to 124 frames, with audio and original intact',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'h3-media-test-'));
 try {
  const binary=await ensureExecutableFfmpegPath(ffmpeg.path), input=join(directory,'source.mp4'),rotated=join(directory,'phone.mov');
  await promisify(execFile)(binary,['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=25:d=5.56','-f','lavfi','-i','sine=frequency=440:duration=5.56','-c:v','libx264','-threads','1','-c:a','aac','-y',input]);
  await promisify(execFile)(binary,['-v','error','-i',input,'-c','copy','-metadata:s:v:0','rotate=90','-y',rotated]);
  const bytes=await readFile(rotated), source=await inspectVideoExcerptBytes(bytes,'video/quicktime',{decodedFrames:true});
  assert.equal(source.fps,25);assert.equal(source.decodedFrameCount,139);assert.ok(validateH3Source('h3-relight',source));
  const result=await prepareH3RelightCopy(bytes,'video/quicktime');
  assert.equal(result.facts.decodedFrameCount,124);assert.equal(result.facts.fps,24);assert.equal(result.facts.constantFrameRate,true);
  assert.equal(result.facts.width,120);assert.equal(result.facts.height,160);assert.equal(result.facts.hasAudio,true);
  assert.ok(Math.abs(result.facts.durationSec-124/24)<0.000001);assert.ok(result.plan.removedEndSec>0);
  assert.deepEqual(await readFile(rotated),bytes);
 } finally {await rm(directory,{recursive:true,force:true});}
});

import {inspectOwnedH3Source} from '../frontend/server/video-excerpts/h3-relight';
import {withVideoExcerptSlot} from '../frontend/server/video-excerpts/media';
test('H3 admission rejects same-account and global saturation before signing/downloading/decoding; releases after failure',async()=>{
 let reads=0;
 const dependencies={createReadUrl:async()=>{reads++;throw new Error('injected read failure');},download:async()=>{throw new Error('must not download');},inspect:inspectVideoExcerptBytes};
 const busy=(error:unknown)=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='RATE_LIMITED'&&'retryable' in error&&error.retryable);
 await withVideoExcerptSlot('one',async()=>{
  await assert.rejects(inspectOwnedH3Source('owned','h3-recast','one',dependencies),busy);
  await withVideoExcerptSlot('two',async()=>{
   await assert.rejects(inspectOwnedH3Source('owned','h3-relight','three',dependencies),busy);
  });
 });
 assert.equal(reads,0);
 for(let i=0;i<2;i++) await assert.rejects(inspectOwnedH3Source('owned','h3-recast','one',dependencies),/injected read failure/);
 assert.equal(reads,2);
});
