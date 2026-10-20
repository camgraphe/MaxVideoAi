import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {renderSubtitleSequenceAudio} from '../frontend/src/server/subtitles/sequence-render';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
test('real sequence audio render retains cuts, trims, simultaneous gain and mute without requesting visual-only media',{timeout:180000},async t=>{
  const browserExecutable=process.env.STUDIO_RENDER_BROWSER_EXECUTABLE??chromium.executablePath();assert.ok(existsSync(browserExecutable));
  const directory=mkdtempSync(join(tmpdir(),'subtitle-mix-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const ffmpeg=(args:string[])=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{maxBuffer:8*1024*1024});
  for(const [name,first,last] of [['voice',220,440],['music',660,880]] as const)ffmpeg(['-f','lavfi','-i',`sine=frequency=${first}:sample_rate=48000:duration=1`,'-f','lavfi','-i',`sine=frequency=${last}:sample_rate=48000:duration=3`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]','-c:a','pcm_s16le',join(directory,name+'.wav')]);
  const paths:string[]=[];const server=createServer((req,res)=>{const name=req.url!.slice(1);paths.push(name);if(!['voice.wav','music.wav'].includes(name)){res.writeHead(404).end();return;}const data=readFileSync(join(directory,name));res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':data.length}).end(data);});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise<void>(done=>{server.close(()=>done());server.closeAllConnections();}));
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const base={durationSec:3,startSec:0,sourceStartSec:1,sourceDurationSec:4,title:'Audio',status:'completed' as const};
  const items:WorkspaceTimelineItem[]=[{...base,id:'image',outputNodeId:'image',track:'video',mediaKind:'image',mediaUrl:url+'/must-not-fetch.jpg',sourceWidth:320,sourceHeight:180},
    {...base,id:'voice',outputNodeId:'voice',track:'audio',mediaKind:'audio',mediaUrl:url+'/voice.wav',audioMix:{volume:80,muted:false}},
    {...base,id:'music',outputNodeId:'music',track:'audio-2',mediaKind:'audio',mediaUrl:url+'/music.wav',startSec:.5,durationSec:2,audioMix:{volume:25,muted:false}}];
  for(const muted of [false,true]){
    const manifest=buildWorkspaceTimelineRenderManifest({items:items.map(item=>item.id==='music'?{...item,audioMix:{volume:25,muted}}:item),nodes:[],projectName:'Mix',sequenceId:'seq',sequenceName:'Sequence',projectSettings:{fps:30,resolution:'720p',aspectRatio:'16:9'}});
    const outputPath=join(directory,muted?'muted.wav':'mix.wav');const facts=await renderSubtitleSequenceAudio({manifest,userId:'fixture',outputPath,browserExecutable},{prepareMedia:async manifest=>manifest});assert.equal(facts.durationMs,3000);assert.equal(facts.hasAudio,true);
    const pcm=ffmpeg(['-i',outputPath,'-ac','1','-ar','48000','-f','f32le','pipe:1']);
    const amplitude=(freq:number,start:number,end:number)=>{let re=0,im=0;for(let n=start*48000;n<end*48000;n++){const value=pcm.readFloatLE(n*4);re+=value*Math.cos(2*Math.PI*freq*n/48000);im+=value*Math.sin(2*Math.PI*freq*n/48000);}return 2*Math.hypot(re,im)/((end-start)*48000);};
    const voice=amplitude(440,.8,1.2),music=amplitude(880,.8,1.2);assert.ok(voice>.08&&voice<.12);assert.ok(amplitude(220,.8,1.2)<.002);assert.ok(amplitude(660,.8,1.2)<.002);assert.ok(amplitude(880,.1,.4)<.002);assert.ok(amplitude(880,2.6,2.9)<.002);assert.ok(muted?music/voice<.02:music/voice>.27&&music/voice<.36);
  }
  assert.ok(paths.length>0);assert.ok(paths.every(path=>path.endsWith('.wav')),'Audio-only renders never fetch the image');
});
