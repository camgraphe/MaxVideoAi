import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {renderSequence,runProcess} from '../server/render';import {probeMedia} from '../server/media';import {fixture} from './domain.test';
test('actual film honours trims, output dimensions, soundtrack and audio-only export',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-render-'));
 try{
  await runProcess('ffmpeg',['-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24:d=3','-f','lavfi','-i','sine=frequency=220:duration=3','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',join(dir,'a.mp4')]);
  await runProcess('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:duration=3',join(dir,'b.mp3')]);
  const p=fixture();p.assets[0].duration=3;p.assets[1].duration=3;
  p.clips=[{id:'one',assetId:'a',track:'video',inFrame:24,outFrame:48,startFrame:0,volume:1},{id:'two',assetId:'a',track:'video',inFrame:0,outFrame:48,startFrame:0,volume:1},{id:'voice',assetId:'b',track:'voice',inFrame:0,outFrame:48,startFrame:24,volume:0.8}];
  const snapshot={...p,revision:0};await renderSequence(snapshot,dir,join(dir,'film.mp4'));
  const info=await probeMedia(join(dir,'film.mp4'));assert.equal(info.width,1280);assert.equal(info.height,720);assert.equal(info.hasAudio,true);assert.ok(Math.abs(info.duration-3)<1/24);
  snapshot.clips=[{id:'voice',assetId:'b',track:'voice',inFrame:24,outFrame:72,startFrame:0,volume:1}];
  await renderSequence(snapshot,dir,join(dir,'podcast.mp3'));const audio=await probeMedia(join(dir,'podcast.mp3'));assert.equal(audio.kind,'audio');assert.ok(Math.abs(audio.duration-2)<0.1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
