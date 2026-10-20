import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {extractSubtitleAudio} from '../frontend/src/server/subtitles/media';

function probe(path:string){
  return JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,start_time,duration:format=start_time,duration','-of','json',path],{encoding:'utf8'}));
}
function samples(path:string){
  return execFileSync('ffmpeg',['-v','error','-i',path,'-map','0:a:0','-ac','1','-ar','16000','-c:a','pcm_s16le','-f','s16le','pipe:1']);
}
function energy(bytes:Buffer,start:number,end:number){
  let sum=0,count=0;
  for(let index=Math.floor(start*16000);index<Math.min(bytes.length/2,Math.floor(end*16000));index++){
    const value=bytes.readInt16LE(index*2);sum+=value*value;count++;
  }
  assert.ok(count>0,'Expected PCM interval must exist.');
  return Math.sqrt(sum/count);
}

for(const scenario of [
  {name:'aligned audio',origin:0,delay:0,gap:false},
  {name:'delayed audio',origin:0,delay:1,gap:false},
  {name:'delayed audio with a nonzero container origin',origin:5,delay:1,gap:false},
  {name:'delayed audio and an internal timestamp gap',origin:5,delay:1,gap:true},
  {name:'delayed audio extending past the video',origin:5,delay:1,gap:false,audioDuration:5},
])test(`subtitle WAV preserves the original presentation clock for ${scenario.name}`,async t=>{
  const directory=await mkdtemp(join(tmpdir(),'subtitle-offset-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const sourcePath=join(directory,'source.mp4'),outputPath=join(directory,'transcription.wav');
  // The signal begins at delay seconds relative to the video's first frame.
  // Shift the whole container independently; that shift must never become silence.
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=320x180:r=25:d=5',
    '-f','lavfi','-i',`sine=frequency=1000:sample_rate=16000:duration=${scenario.audioDuration??2}`,'-map','0:v','-map','1:a',
    '-af',`asetpts='PTS+${scenario.delay}/TB${scenario.gap?'+gte(T,0.5)/TB':''}'`,
    '-c:v','libx264','-c:a','aac','-output_ts_offset',String(scenario.origin),'-y',sourcePath]);
  const source=probe(sourcePath),origin=Number(source.format.start_time),audio=source.streams.find((stream:any)=>stream.codec_type==='audio');
  assert.ok(Math.abs(origin-scenario.origin)<0.1,JSON.stringify(source));
  const audioOffset=Number(audio.start_time)-origin;
  assert.ok(Math.abs(audioOffset-scenario.delay)<0.1,JSON.stringify(source));
  const facts=await extractSubtitleAudio({sourcePath,outputPath});
  const audioEnd=scenario.delay+(scenario.audioDuration??2)+(scenario.gap?1:0);
  assert.equal(facts.durationMs,Math.max(5,audioEnd)*1000);assert.equal(facts.hasAudio,true);
  const pcm=samples(outputPath),durationSec=pcm.length/2/16000;
  t.diagnostic(JSON.stringify({origin,audioOffset,wavDurationSec:durationSec}));
  if(scenario.delay)assert.ok(energy(pcm,0.2,0.7)<1,'Leading silence must retain the original audio delay.');
  assert.ok(energy(pcm,scenario.delay+0.15,scenario.delay+0.35)>1000,'Audio must begin at the original presentation time.');
  let firstSound=-1;
  for(let index=0;index<pcm.length/2;index++)if(Math.abs(pcm.readInt16LE(index*2))>1000){firstSound=index/16000;break;}
  assert.ok(Math.abs(firstSound-scenario.delay)<0.08,`Signal began at ${firstSound}s, expected ${scenario.delay}s.`);
  if(scenario.gap){
    assert.ok(energy(pcm,scenario.delay+0.8,scenario.delay+1.2)<1,'Internal timestamp gaps must stay silent.');
    assert.ok(energy(pcm,scenario.delay+1.7,scenario.delay+1.9)>1000,'Audio following a gap must keep its original time.');
  }
  assert.ok(durationSec>=audioEnd-0.1);
  assert.ok(durationSec<=facts.durationMs/1000+0.1,'A nonzero absolute origin must not extend the source clock.');
});
