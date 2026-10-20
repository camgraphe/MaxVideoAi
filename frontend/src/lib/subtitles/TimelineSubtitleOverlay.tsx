import React,{useMemo} from 'react';
import {SubtitleOverlay} from './SubtitleOverlay';
import {projectSubtitleClip,type SubtitleClip} from './timeline';
export function ClipSubtitleOverlay({clip,timeMs,width,height}:{clip:SubtitleClip;timeMs:number;width:number;height:number}){
  const document=useMemo(()=>projectSubtitleClip(clip),[clip]);
  return document?<SubtitleOverlay document={document} timeMs={timeMs} width={width} height={height}/>:null;
}
export function TimelineSubtitleOverlay({items,timeMs,width,height}:{items:SubtitleClip[];timeMs:number;width:number;height:number}){
  return <div style={{position:'absolute',inset:0,zIndex:100,pointerEvents:'none'}}>{items.filter(item=>item.subtitleDocument&&timeMs>=item.startSec*1000&&timeMs<(item.startSec+item.durationSec)*1000).map(item=><ClipSubtitleOverlay key={item.id} clip={item} timeMs={timeMs-item.startSec*1000} width={width} height={height}/>)}</div>;
}
