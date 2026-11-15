import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from '@playwright/test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SubtitleOverlay} from '../frontend/src/lib/subtitles/SubtitleOverlay';
import {normalizeScribeTranscript} from '../frontend/src/lib/subtitles/document';

test('moving the Pop highlight never shifts the glyphs or changes the caption line breaks', {timeout:30_000}, async()=>{
 const document=normalizeScribeTranscript({text:'Keep your ideas, notes and projects together',language_code:'en',words:[
  {type:'word',text:'Keep',start:0,end:.15},
  {type:'word',text:' your',start:.2,end:.35},
  {type:'word',text:' ideas,',start:.4,end:.55},
  {type:'word',text:' notes',start:.6,end:.75},
  {type:'word',text:' and',start:.8,end:.95},
  {type:'word',text:' projects',start:1,end:1.15},
  {type:'word',text:' together',start:1.2,end:1.5},
 ]},{id:'layout',source:{ref:{type:'asset',assetId:'owned',kind:'video'},fingerprint:'a'.repeat(64),durationMs:2000}});
 document.style.preset='active-word';
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:854,height:480}});
  for(const fontSizePercent of [7,8]){
   document.style.fontSizePercent=fontSizePercent;
   let baseline:Array<{text:string;x:number;y:number;width:number;height:number}>|undefined;
   for(const timeMs of [100,175,300,500,700,900,1100,1300]){
    const html=renderToStaticMarkup(React.createElement(SubtitleOverlay,{document,timeMs,width:854,height:480}));
    await page.setContent(`<body style="margin:0"><main style="position:relative;width:854px;height:480px">${html}</main></body>`);
    const boxes=await page.locator('[data-subtitle-overlay] > span > span').evaluateAll(elements=>elements.map(element=>{
     const range=window.document.createRange();range.selectNodeContents(element);const r=range.getBoundingClientRect();
     return {text:element.textContent??'',x:r.x,y:r.y,width:r.width,height:r.height};
    }));
    assert.equal(boxes.length,7);
    baseline??=boxes;
    assert.deepEqual(boxes,baseline,`font ${fontSizePercent}%, frame ${timeMs}ms: changing the accent must not move the text`);
   }
  }
 }finally{await browser.close();}
});
