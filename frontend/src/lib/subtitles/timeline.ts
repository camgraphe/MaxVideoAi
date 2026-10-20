import {projectSubtitles} from './project';
import type {SubtitleDocument} from './document';
export type SubtitleClip={id:string;startSec:number;durationSec:number;sourceStartSec?:number;subtitle?:{documentId:string;revision:number};subtitleDocument?:SubtitleDocument};
/** Local clip clock is identical in browser preview and Remotion Sequence, including export in/out trimming. */
export function projectSubtitleClip(clip:SubtitleClip):Pick<SubtitleDocument,'words'|'segments'|'style'>|null{
  const document=clip.subtitleDocument;if(!document||!clip.subtitle)return null;
  if(clip.subtitle.documentId!==document.id||clip.subtitle.revision!==document.revision)throw new Error('SUBTITLE_REFERENCE_INVALID');
  const start=Math.round((clip.sourceStartSec??0)*1000),end=Math.round(((clip.sourceStartSec??0)+clip.durationSec)*1000);
  const segments=projectSubtitles(document,{clipId:clip.id,sourceInMs:start,sourceOutMs:end,timelineStartMs:0,playbackRate:1}).filter(segment=>segment.text.trim().length>0);
  const words=Array.from(new Map(segments.flatMap(segment=>segment.words).map(word=>[word.id,word])).values());
  return {style:document.style,segments,words};
}
