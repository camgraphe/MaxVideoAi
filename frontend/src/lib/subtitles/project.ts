import {parseSubtitleDocument,type SubtitleDocument,type SubtitleSegment,type SubtitleWord} from './document';
export type ProjectedSubtitleSegment=SubtitleSegment&{clipId:string;sourceSegmentId:string;words:SubtitleWord[]};
/** Studio's actual preview/export contract currently supports speed 1 only. */
export function projectSubtitles(value:SubtitleDocument,clip:{clipId:string;sourceInMs:number;sourceOutMs:number;timelineStartMs:number;playbackRate:number}):ProjectedSubtitleSegment[]{
  const document=parseSubtitleDocument(value);
  if(clip.playbackRate!==1)throw new Error('SUBTITLE_SPEED_UNSUPPORTED');
  if(!clip.clipId||![clip.sourceInMs,clip.sourceOutMs,clip.timelineStartMs].every(Number.isSafeInteger)||clip.sourceInMs<0||clip.timelineStartMs<0||clip.sourceOutMs<=clip.sourceInMs||clip.sourceOutMs>document.source.durationMs)throw new Error('SUBTITLE_PROJECTION_BOUNDS');
  const offset=clip.timelineStartMs-clip.sourceInMs;const wordsById=new Map(document.words.map(word=>[word.id,word]));
  return document.segments.filter(segment=>segment.endMs>clip.sourceInMs&&segment.startMs<clip.sourceOutMs).map(segment=>{
    const words=segment.wordIds.map(id=>wordsById.get(id)!).filter(word=>word.endMs>clip.sourceInMs&&word.startMs<clip.sourceOutMs).map(word=>({...word,startMs:Math.max(word.startMs,clip.sourceInMs)+offset,endMs:Math.min(word.endMs,clip.sourceOutMs)+offset}));
    return {...segment,id:`${clip.clipId}:${segment.id}`,sourceSegmentId:segment.id,clipId:clip.clipId,startMs:Math.max(segment.startMs,clip.sourceInMs)+offset,endMs:Math.min(segment.endMs,clip.sourceOutMs)+offset,words,wordIds:words.map(word=>word.id),text:segment.alignment==='aligned'?words.map(word=>word.text).join('').trim():segment.text};
  });
}
