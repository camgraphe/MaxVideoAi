import {parseSubtitleDocument,type SubtitleDocument} from './document';
function timecode(ms:number,format:'srt'|'vtt'){
  const part=(value:number,size=2)=>String(value).padStart(size,'0');
  return `${part(Math.floor(ms/3600000))}:${part(Math.floor(ms/60000)%60)}:${part(Math.floor(ms/1000)%60)}${format==='srt'?',':'.'}${part(ms%1000,3)}`;
}
function safeText(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r\n?/g,'\n').replace(/\n{2,}/g,'\n');}
export function serializeSubtitles(value:SubtitleDocument,format:'srt'|'vtt'):string{
  if(format!=='srt'&&format!=='vtt')throw new Error('SUBTITLE_FORMAT_UNSUPPORTED');
  const document=parseSubtitleDocument(value);
  const cues=document.segments.map((segment,index)=>`${format==='srt'?`${index+1}\n`:''}${timecode(segment.startMs,format)} --> ${timecode(segment.endMs,format)}\n${safeText(segment.text)}\n`).join('\n');
  return (format==='vtt'?'WEBVTT\n\n':'')+cues;
}
