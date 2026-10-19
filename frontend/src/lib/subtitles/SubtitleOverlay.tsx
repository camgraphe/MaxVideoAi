import React from 'react';
import type {SubtitleDocument} from './document';
import {subtitleAtTime,subtitleLayout} from './presentation';
import {activeSubtitleWordStyle,subtitleAppearance} from './presets';
export function SubtitleOverlay({document,timeMs,width,height}:{document:Pick<SubtitleDocument,'segments'|'words'|'style'>;timeMs:number;width:number;height:number}){
  const {segment,words,activeWordId}=subtitleAtTime(document,timeMs);if(!segment)return null;
  const layout=subtitleLayout(document.style,width,height),highContrast=document.style.preset==='high-contrast';
  return <div data-subtitle-overlay data-preset={document.style.preset} style={{position:'absolute',left:layout.left,top:layout.top,width:layout.maxWidth,transform:'translateY(-50%)',textAlign:'center',fontFamily:'Arial, Liberation Sans, sans-serif',fontSize:layout.fontSize,lineHeight:1.4,color:document.style.textColor,whiteSpace:'pre-wrap',overflowWrap:'anywhere',...subtitleAppearance(document.style.preset),pointerEvents:'none'}}>
    <span style={{background:highContrast?'rgba(0,0,0,.94)':undefined,padding:highContrast?'0.15em 0.3em':undefined,boxDecorationBreak:'clone'}}>
      {document.style.preset==='active-word'&&words.length?words.map(word=><React.Fragment key={word.id}>{word.text.match(/^\s*/)?.[0]}<span data-active-word={word.id===activeWordId||undefined} style={word.id===activeWordId?activeSubtitleWordStyle(document.style.accentColor):undefined}>{word.text.trimStart()}</span></React.Fragment>):segment.text}
    </span>
  </div>;
}
