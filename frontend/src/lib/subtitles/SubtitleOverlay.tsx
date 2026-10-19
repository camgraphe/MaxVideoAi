import React from 'react';
import type {SubtitleDocument} from './document';
import {subtitleAtTime,subtitleLayout} from './presentation';
export function SubtitleOverlay({document,timeMs,width,height}:{document:SubtitleDocument;timeMs:number;width:number;height:number}){
  const {segment,words,activeWordId}=subtitleAtTime(document,timeMs);if(!segment)return null;
  const layout=subtitleLayout(document.style,width,height),highContrast=document.style.preset==='high-contrast';
  return <div style={{position:'absolute',left:layout.left,top:layout.top,width:layout.maxWidth,transform:'translateY(-50%)',textAlign:'center',fontFamily:'Arial, Liberation Sans, sans-serif',fontWeight:700,fontSize:layout.fontSize,lineHeight:layout.lineHeight,color:document.style.textColor,whiteSpace:'pre-wrap',overflowWrap:'anywhere',textShadow:'0 1px 2px #000, 1px 0 2px #000, -1px 0 2px #000',pointerEvents:'none'}}>
    <span style={{background:highContrast?'rgba(0,0,0,.94)':undefined,padding:highContrast?'0.15em 0.3em':undefined,boxDecorationBreak:'clone'}}>
      {document.style.preset==='active-word'&&words.length?words.map(word=><span key={word.id} style={{color:word.id===activeWordId?document.style.accentColor:undefined}}>{word.text}</span>):segment.text}
    </span>
  </div>;
}
