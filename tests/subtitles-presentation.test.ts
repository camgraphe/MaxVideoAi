import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SubtitleOverlay} from '../frontend/src/lib/subtitles/SubtitleOverlay';
import {editSubtitleDocument,normalizeScribeTranscript} from '../frontend/src/lib/subtitles/document';
import {SUBTITLE_PRESETS,subtitlePresetCopy} from '../frontend/src/lib/subtitles/presets';
const doc=()=>normalizeScribeTranscript({text:'You came back.',language_code:'en',words:[{type:'word',text:'You',start:.1,end:.3},{type:'spacing',text:' '},{type:'word',text:'came',start:.31,end:.5},{type:'spacing',text:' '},{type:'word',text:'back.',start:.51,end:.9}]},{id:'demo',source:{ref:{type:'asset',assetId:'owned',kind:'video'},fingerprint:'a'.repeat(64),durationMs:2000}});
const render=(document:ReturnType<typeof doc>,timeMs:number)=>renderToStaticMarkup(React.createElement(SubtitleOverlay,{document,timeMs,width:854,height:480}));
test('Pop highlights the actual timed word and preserves the spoken text',()=>{
 const document=doc();document.style.preset='active-word';
 const first=render(document,400),next=render(document,600);
 assert.match(first,/data-active-word="true"[^>]*>came/);assert.match(first,/background:#FDE047;color:#111111/);
 assert.match(next,/data-active-word="true"[^>]*>back\./);assert.equal(render(document,901),'');
 assert.equal(first.replace(/<[^>]*>/g,''),'You came back.');
});
test('style choices keep the same timing and edited lines never fabricate word alignment',()=>{
 for(const preset of SUBTITLE_PRESETS){const document=doc();document.style.preset=preset;assert.equal(render(document,0),'');assert.equal(render(document,1000),'');assert.match(render(document,400),new RegExp(`data-preset="${preset}"`));}
 const document=doc();document.style.preset='active-word';
 const edited=editSubtitleDocument(document,{segments:[{...document.segments[0],text:'You returned.'}]});
 assert.doesNotMatch(render(edited,400),/data-active-word/);assert.match(render(edited,400),/You returned\./);
 for(const locale of ['en','fr','es'])assert.equal(subtitlePresetCopy(locale).names.length,3);
});
