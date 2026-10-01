import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Snapshot,Settings} from '../shared/types';
import {sequenceDuration} from '../shared/timeline';
export function runProcess(command:string,args:string[],signal?:AbortSignal,onStdout?:(s:string)=>void):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{signal,stdio:['ignore','pipe','pipe']});const chunks:Buffer[]=[];let errors='';
  child.stdout.on('data',(b:Buffer)=>{chunks.push(b);onStdout?.(b.toString());});child.stderr.on('data',b=>{errors=(errors+b.toString()).slice(-6000);});
  child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error(signal?.aborted?'Traitement annulé.':errors.slice(-1500)||`Impossible de lancer ${command}.`)));
 });
}
export function dimensions(s:Settings){const n=s.resolution;return s.ratio==='9:16'?[n,Math.round(n*16/9)]:s.ratio==='1:1'?[n,n]:[Math.round(n*16/9),n];}
function fitFilter(s:Settings){const [w,h]=dimensions(s);return s.fit==='cover'?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`:`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x191c1a`;}
export async function ffmpeg(args:string[],duration:number,signal?:AbortSignal,progress?:(n:number)=>void){
 let buffer='';await runProcess('ffmpeg',['-hide_banner','-loglevel','error','-y',...args,'-progress','pipe:1','-nostats'],signal,s=>{buffer+=s;const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines)if(line.startsWith('out_time_us=')){const t=Number(line.split('=')[1]);if(Number.isFinite(t))progress?.(Math.min(0.99,t/1e6/Math.max(duration,0.01)));}});
}
export async function renderAnimation(input:string,output:string,options:{duration:number;motion:'gentle'|'pan'|'still';fps:number},signal?:AbortSignal,progress?:(n:number)=>void){
 const frames=Math.round(options.duration*options.fps);
 const filter=options.motion==='still'?`scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=${options.fps}`:
  `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='${options.motion==='gentle'?'1+0.06*on/'+frames:'1.08'}':x='${options.motion==='pan'?'(iw-iw/zoom)*on/'+frames:'(iw-iw/zoom)/2'}':y='(ih-ih/zoom)/2':d=1:s=1280x720:fps=${options.fps}`;
 await ffmpeg(['-loop','1','-i',input,'-vf',filter,'-frames:v',String(frames),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',output],options.duration,signal,progress);
}
export async function renderSequence(snapshot:Snapshot,dir:string,output:string,signal?:AbortSignal,progress?:(n:number)=>void):Promise<void>{
 const work=await mkdtemp(join(dir,'render-'));const fps=snapshot.settings.fps,duration=sequenceDuration(snapshot);
 const videos=snapshot.clips.filter(c=>c.track==='video'),audios=snapshot.clips.filter(c=>c.track!=='video');
 try{
  let base:string|undefined;
  if(videos.length){
   const parts:string[]=[];
   for(const [i,c] of videos.entries()){
    const asset=snapshot.assets.find(a=>a.id===c.assetId);if(!asset)throw new Error('Source de rendu manquante.');const part=join(work,`part-${i}.mp4`),len=(c.outFrame-c.inFrame)/fps;
    const args=['-ss',String(c.inFrame/fps),'-i',join(dir,asset.file)];
    const sourceSound=asset.hasAudio&&snapshot.settings.sourceAudio;
    if(!sourceSound)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
    args.push('-map','0:v:0','-map',sourceSound?'0:a:0':'1:a:0','-t',String(len),'-vf',`${fitFilter(snapshot.settings)},fps=${fps},setsar=1`,'-af',`aresample=48000,apad,volume=${c.volume}`,'-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',part);
    await ffmpeg(args,len,signal,n=>progress?.((i+n)/videos.length*0.75));parts.push(part);
   }
   const list=join(work,'parts.txt');await writeFile(list,parts.map(p=>`file '${p.replace(/'/g,"'\\''")}'`).join('\n'));
   base=join(work,'base.mp4');await ffmpeg(['-f','concat','-safe','0','-i',list,'-c','copy',base],duration,signal);
  }
  const args:string[]=[];const filters:string[]=[];const labels:string[]=[];let index=0;
  if(base){args.push('-i',base);filters.push(`[0:a]apad,atrim=duration=${duration}[sound0]`);labels.push('[sound0]');index=1;}
  else{args.push('-f','lavfi','-i',`anullsrc=r=48000:cl=stereo:d=${duration}`);filters.push('[0:a]anull[sound0]');labels.push('[sound0]');index=1;}
  for(const c of audios){
   const a=snapshot.assets.find(a=>a.id===c.assetId);if(!a)throw new Error('Source audio manquante.');
   args.push('-i',join(dir,a.file));const label=`sound${index}`,delay=Math.round(c.startFrame/fps*1000);
   filters.push(`[${index}:a]atrim=start=${c.inFrame/fps}:end=${c.outFrame/fps},asetpts=PTS-STARTPTS,aresample=48000,volume=${c.volume},adelay=${delay}:all=1[${label}]`);labels.push(`[${label}]`);index++;
  }
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad,atrim=duration=${duration}[mix]`);
  args.push('-filter_complex',filters.join(';'));
  if(base)args.push('-map','0:v:0','-map','[mix]','-c:v','copy','-c:a','aac','-movflags','+faststart');else args.push('-map','[mix]','-c:a','libmp3lame','-b:a','192k');
  args.push('-t',String(duration),output);await ffmpeg(args,duration,signal,n=>progress?.(0.75+n*0.25));
 }finally{await rm(work,{recursive:true,force:true});}
}
