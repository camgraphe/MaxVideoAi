import {join} from 'node:path';import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {runProcess,ffmpeg} from './render';import {StudioError} from '../shared/timeline';
import type {Asset} from '../shared/types';
export interface Metadata {kind:'image'|'video'|'audio';duration:number;width:number;height:number;hasAudio:boolean;}
export async function probeMedia(path:string):Promise<Metadata>{
 const info=JSON.parse((await runProcess('ffprobe',['-v','error','-show_format','-show_streams','-of','json',path])).toString());
 const video=info.streams.find((s:any)=>s.codec_type==='video'&&!s.disposition?.attached_pic),audio=info.streams.find((s:any)=>s.codec_type==='audio');
 const format=info.format?.format_name??'',image=video&&(/image2|pipe/.test(format)||['png','mjpeg','webp'].includes(video.codec_name)&&!Number(info.format?.duration));
 if(!video&&!audio)throw new StudioError('Ce fichier ne contient pas de média utilisable.');
 const duration=image?0:Number(info.format?.duration??video?.duration??audio?.duration);
 if(!image&&(!Number.isFinite(duration)||duration<1||duration>600))throw new StudioError('Les sources audio/vidéo doivent durer entre 1 seconde et 10 minutes.');
 if(video&&(video.width>8192||video.height>8192))throw new StudioError('Dimensions maximales : 8 192 pixels.');
 return {kind:image?'image':video?'video':'audio',duration,width:video?.width??0,height:video?.height??0,hasAudio:!!audio};
}
export async function waveform(path:string):Promise<number[]>{
 const b=await runProcess('ffmpeg',['-v','error','-i',path,'-vn','-ac','1','-ar','8000','-f','f32le','pipe:1']);
 const samples=Math.floor(b.length/4),peaks:number[]=[];for(let i=0;i<128;i++){let max=0;for(let j=Math.floor(samples*i/128);j<Math.floor(samples*(i+1)/128);j++)max=Math.max(max,Math.abs(b.readFloatLE(j*4)));peaks.push(max);}const max=Math.max(...peaks,0.001);return peaks.map(p=>p/max);
}
export function mediaDir(root:string,projectId:string){if(!/^[a-f0-9-]{36}$/.test(projectId))throw new StudioError('Projet invalide.');return join(root,'media',projectId);}
export async function importMedia(root:string,projectId:string,bytes:Buffer,name:string):Promise<Asset>{
 if(!bytes.length||bytes.length>100*1024*1024)throw new StudioError('Référence vide ou supérieure à 100 Mo.',413);
 // SVG/HTML never enter the media pipeline, regardless of filename.
 if(/<(svg|html|!doctype)/i.test(bytes.subarray(0,1024).toString()))throw new StudioError('Référence non prise en charge. Utilisez une image, vidéo ou un audio.');
 const dir=mediaDir(root,projectId);await mkdir(dir,{recursive:true});const id=crypto.randomUUID(),input=join(dir,id+'.original');await writeFile(input,bytes);
 try{
  const metadata=await probeMedia(input),ext=metadata.kind==='image'?'.jpg':metadata.kind==='video'?'.mp4':'.mp3',file=id+ext,output=join(dir,file);
  if(metadata.kind==='image')await ffmpeg(['-i',input,'-vf','scale=1920:1920:force_original_aspect_ratio=decrease','-frames:v','1',output],1);
  else if(metadata.kind==='video')await ffmpeg(['-i',input,'-map','0:v:0','-map','0:a:0?','-vf','scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-threads','2','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],metadata.duration);
  else await ffmpeg(['-i',input,'-vn','-c:a','libmp3lame','-b:a','192k',output],metadata.duration);
  const preview=await probeMedia(output);const asset:Asset={id,name:name.replace(/[\x00-\x1f]/g,'').slice(0,120)||'Référence',...preview,file,original:id+'.original',origin:'import'};
  if(asset.kind==='video'){asset.poster=id+'.jpg';await ffmpeg(['-i',output,'-frames:v','1','-vf','scale=640:-2',join(dir,asset.poster)],1);}
  if(asset.kind==='audio')asset.peaks=await waveform(output);return asset;
 }catch(e){await rm(input,{force:true});throw e;}
}
