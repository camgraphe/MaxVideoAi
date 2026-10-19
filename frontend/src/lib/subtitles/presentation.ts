import type {SubtitleDocument,SubtitleStyle} from './document';
/** One layout/timing owner for the browser preview and the server composition. */
export function subtitleAtTime(document:SubtitleDocument,timeMs:number){
  const segment=document.segments.find(value=>timeMs>=value.startMs&&timeMs<value.endMs)??null;
  const words=segment?.alignment==='aligned'?document.words.filter(word=>segment.wordIds.includes(word.id)):[];
  return {segment,words,activeWordId:words.find(word=>timeMs>=word.startMs&&timeMs<word.endMs)?.id??null};
}
export function subtitleLayout(style:SubtitleStyle,width:number,height:number){
  const fontSize=Math.max(10,Math.round(Math.min(width,height)*style.fontSizePercent/100));
  return {fontSize,maxWidth:Math.round(width*.86),left:Math.round(width*.07),top:style.position==='top'?Math.round(height*.1):style.position==='center'?Math.round(height*.5):Math.round(height*.82),lineHeight:1.2};
}
