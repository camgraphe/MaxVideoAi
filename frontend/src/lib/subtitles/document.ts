import {z} from 'zod';
import {toolAssetRefSchema} from '../toolbox/contract';

export const SUBTITLE_LIMITS={durationMs:1_800_000,words:20_000,segments:10_000,text:500} as const;
const id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:-]+$/);
const ms=z.number().int().min(0).max(SUBTITLE_LIMITS.durationMs);
const text=z.string().min(1).max(SUBTITLE_LIMITS.text).refine(value=>value.trim().length>0&&!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value),'Invalid subtitle text');
export const subtitleStyleSchema=z.object({
  preset:z.enum(['clean','active-word','high-contrast']),
  position:z.enum(['bottom','center','top']),
  fontSizePercent:z.number().finite().min(2).max(10),
  textColor:z.string().regex(/^#[a-fA-F0-9]{6}$/),
  accentColor:z.string().regex(/^#[a-fA-F0-9]{6}$/),
}).strict();
export const DEFAULT_SUBTITLE_STYLE:z.infer<typeof subtitleStyleSchema>={preset:'active-word',position:'bottom',fontSizePercent:7,textColor:'#FFFFFF',accentColor:'#FDE047'};
export const subtitleSourceSchema=z.object({
  ref:toolAssetRefSchema.refine(ref=>ref.kind==='video'||ref.kind==='audio','An audio or video source is required'),
  fingerprint:z.string().regex(/^[a-f0-9]{64}$/),durationMs:ms.positive(),
  sequenceMix:z.object({sequenceId:id,revision:z.number().int().positive(),audioManifestHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().optional(),
}).strict();
export const subtitleWordSchema=z.object({id,text,startMs:ms,endMs:ms,speakerId:id.optional()}).strict();
export const subtitleSegmentSchema=z.object({id,text,startMs:ms,endMs:ms,wordIds:z.array(id).max(200),alignment:z.enum(['aligned','edited'])}).strict();
export const subtitleDocumentSchema=z.object({
  version:z.literal(1),id,revision:z.number().int().positive(),source:subtitleSourceSchema,
  language:z.string().min(2).max(24).regex(/^[A-Za-z0-9-]+$/),
  words:z.array(subtitleWordSchema).max(SUBTITLE_LIMITS.words),
  segments:z.array(subtitleSegmentSchema).max(SUBTITLE_LIMITS.segments),style:subtitleStyleSchema,
}).strict().superRefine((doc,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
  const words=new Map<string,typeof doc.words[number]>();let previous=-1;
  for(const word of doc.words){
    if(words.has(word.id)||word.startMs<previous||word.endMs<word.startMs||word.endMs>doc.source.durationMs)fail('Invalid word identity or timing');
    words.set(word.id,word);previous=word.startMs;
  }
  const ids=new Set<string>();let end=0;
  for(const segment of doc.segments){
    if(ids.has(segment.id)||segment.startMs<end||segment.endMs<=segment.startMs||segment.endMs>doc.source.durationMs)fail('Invalid segment identity or timing');
    ids.add(segment.id);end=segment.endMs;
    if(new Set(segment.wordIds).size!==segment.wordIds.length||segment.wordIds.some(key=>!words.has(key)))fail('Invalid segment word references');
    if(segment.alignment==='aligned'){
      const selected=segment.wordIds.map(key=>words.get(key)).filter((w):w is typeof doc.words[number]=>!!w);
      if(!selected.length||selected.some(w=>w.startMs<segment.startMs||w.endMs>segment.endMs)||selected.map(w=>w.text).join('').trim()!==segment.text)fail('Aligned text must match its timed words');
    }
  }
});
export const subtitleSequenceAttachmentSchema=z.object({documentId:id,revision:z.number().int().positive(),audioManifestHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type SubtitleSequenceAttachment=z.infer<typeof subtitleSequenceAttachmentSchema>;
export type SubtitleDocument=z.infer<typeof subtitleDocumentSchema>;
export type SubtitleSource=z.infer<typeof subtitleSourceSchema>;
export type SubtitleWord=z.infer<typeof subtitleWordSchema>;
export type SubtitleSegment=z.infer<typeof subtitleSegmentSchema>;
export type SubtitleStyle=z.infer<typeof subtitleStyleSchema>;
export function parseSubtitleDocument(value:unknown):SubtitleDocument{return subtitleDocumentSchema.parse(value);}

export function buildSubtitleSegments(words:SubtitleWord[],durationMs:number):SubtitleSegment[]{
  const groups:SubtitleWord[][]=[];let current:SubtitleWord[]=[];
  for(const word of words){
    const end=current.reduce((n,w)=>Math.max(n,w.endMs),0);
    if(current.length&&word.startMs>=end&&(current.length>=12||current.map(w=>w.text).join('').length+word.text.length>48||word.endMs-current[0].startMs>3500||word.startMs-end>700||/[.!?。！？]\s*$/.test(current.at(-1)!.text))){groups.push(current);current=[];}
    current.push(word);
  }
  if(current.length)groups.push(current);
  return groups.map((group,index)=>({id:`segment-${index+1}`,text:group.map(w=>w.text).join('').trim(),startMs:group[0].startMs,endMs:Math.min(durationMs,Math.max(group[0].startMs+1,...group.map(w=>w.endMs))),wordIds:group.map(w=>w.id),alignment:'aligned'}));
}
const scribeSchema=z.object({text:z.string().max(200_000),language_code:z.string(),language_probability:z.number().optional(),words:z.array(z.object({text:z.string().max(500),type:z.enum(['word','spacing','audio_event']),start:z.number().finite().optional().nullable(),end:z.number().finite().optional().nullable(),speaker_id:z.string().nullable().optional()})).max(60_000)});
export function normalizeScribeTranscript(value:unknown,params:{id:string;source:SubtitleSource}):SubtitleDocument{
  const result=scribeSchema.parse(value),source=subtitleSourceSchema.parse(params.source);const words:SubtitleWord[]=[];let spacing='';
  for(const token of result.words){
    if(token.type==='spacing'){spacing=token.text.replace(/\s/g,' ').slice(0,4);continue;}
    if(token.type==='audio_event')continue;
    if(token.start===undefined||token.start===null||token.end===undefined||token.end===null)throw new Error('SUBTITLE_WORD_TIMING_MISSING');
    const startMs=Math.round(token.start*1000),endMs=Math.round(token.end*1000);
    if(startMs<0||endMs<startMs||endMs>source.durationMs||startMs>=source.durationMs)throw new Error('SUBTITLE_WORD_TIMING_INVALID');
    words.push({id:`word-${words.length+1}`,text:(words.length?spacing:'')+token.text,startMs,endMs,...token.speaker_id?{speakerId:token.speaker_id}:{}});spacing='';
  }
  return parseSubtitleDocument({version:1,id:params.id,revision:1,source,language:result.language_code,words,segments:buildSubtitleSegments(words,source.durationMs),style:DEFAULT_SUBTITLE_STYLE});
}
export const subtitleEditSchema=z.object({segments:z.array(subtitleSegmentSchema).max(SUBTITLE_LIMITS.segments).optional(),style:subtitleStyleSchema.optional()}).strict();
export function editSubtitleDocument(value:SubtitleDocument,change:unknown):SubtitleDocument{
  const document=parseSubtitleDocument(value),edit=subtitleEditSchema.parse(change),old=new Map(document.segments.map(segment=>[segment.id,segment]));
  const segments=edit.segments?.map(segment=>({...segment,alignment:old.get(segment.id)?.text===segment.text&&old.get(segment.id)?.alignment==='aligned'&&segment.startMs===old.get(segment.id)?.startMs&&segment.endMs===old.get(segment.id)?.endMs?'aligned' as const:'edited' as const}))??document.segments;
  return parseSubtitleDocument({...document,segments,style:edit.style??document.style});
}
