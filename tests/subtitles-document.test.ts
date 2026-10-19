import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeScribeTranscript, parseSubtitleDocument, editSubtitleDocument, DEFAULT_SUBTITLE_STYLE} from '../frontend/src/lib/subtitles/document';
import {serializeSubtitles} from '../frontend/src/lib/subtitles/serialize';
import {projectSubtitles} from '../frontend/src/lib/subtitles/project';

const source={ref:{type:'asset' as const,assetId:'owned-video',kind:'video' as const},fingerprint:'a'.repeat(64),durationMs:5000};
const response={text:'Bonjour <Amélie> & vous.',language_code:'fra',language_probability:.99,words:[
  {text:'Bonjour',type:'word',start:.5,end:1},{text:' ',type:'spacing',start:1,end:1.1},
  {text:'<Amélie>',type:'word',start:1.1,end:1.8},{text:' ',type:'spacing',start:1.8,end:1.9},
  {text:'&',type:'word',start:1.9,end:2},{text:' ',type:'spacing',start:2,end:2.1},
  {text:'vous.',type:'word',start:2.1,end:2.8},
]};
const document=()=>normalizeScribeTranscript(response,{id:'subtitle-1',source});

test('Scribe normalization keeps Unicode, spacing and exact word times without inventing timings',()=>{
  const doc=document();assert.equal(doc.segments[0].text,'Bonjour <Amélie> & vous.');
  assert.deepEqual(doc.words.map(w=>[w.startMs,w.endMs]),[[500,1000],[1100,1800],[1900,2000],[2100,2800]]);
  assert.throws(()=>normalizeScribeTranscript({...response,words:[{text:'unsafe',type:'word'}]},{id:'bad',source}),/TIMING/);
  const empty=normalizeScribeTranscript({...response,text:'',words:[]},{id:'silence',source});assert.equal(empty.segments.length,0);
});

test('document validation rejects duplicate identities, invalid timing and references',()=>{
  const doc=document();
  assert.throws(()=>parseSubtitleDocument({...doc,words:[doc.words[0],doc.words[0]]}));
  assert.throws(()=>parseSubtitleDocument({...doc,words:[{...doc.words[0],endMs:Infinity}]}));
  assert.throws(()=>parseSubtitleDocument({...doc,segments:[{...doc.segments[0],wordIds:['missing']}]}));
  assert.throws(()=>parseSubtitleDocument({...doc,segments:[{...doc.segments[0],endMs:6000}]}));
  assert.throws(()=>parseSubtitleDocument({...doc,segments:[doc.segments[0],{...doc.segments[0],id:'overlap'}]}));
});

test('text correction changes exports and marks alignment without mutating source words or revision',()=>{
  const doc=document();const corrected=editSubtitleDocument(doc,{segments:[{...doc.segments[0],text:'Bonjour Amélie corrigée.'}]});
  assert.equal(corrected.segments[0].alignment,'edited');assert.equal(corrected.revision,doc.revision);
  assert.equal(doc.segments[0].text,'Bonjour <Amélie> & vous.');assert.deepEqual(corrected.words,doc.words);
  assert.match(serializeSubtitles(corrected,'srt'),/Bonjour Amélie corrigée\./);
  const styled=editSubtitleDocument(doc,{style:{...DEFAULT_SUBTITLE_STYLE,preset:'high-contrast'}});
  assert.equal(styled.segments[0].alignment,'aligned');
});

test('SRT and VTT serialize bounded milliseconds and escape user markup safely',()=>{
  const doc=document();const srt=serializeSubtitles(doc,'srt'),vtt=serializeSubtitles(doc,'vtt');
  assert.match(srt,/00:00:00,500 --> 00:00:02,800/);assert.match(vtt,/^WEBVTT\n\n/);
  assert.match(vtt,/00:00:00\.500 --> 00:00:02\.800/);
  for(const text of [srt,vtt]) {assert.match(text,/&lt;Amélie&gt; &amp; vous/);assert.doesNotMatch(text,/<Amélie>/);}
});

test('source trim projects intersecting words and cues into sequence time and rejects unsupported speed',()=>{
  const doc=document();const projected=projectSubtitles(doc,{clipId:'clip-a',sourceInMs:1000,sourceOutMs:2200,timelineStartMs:4000,playbackRate:1});
  assert.deepEqual([projected[0].startMs,projected[0].endMs],[4000,5200]);
  assert.deepEqual(projected[0].words.map(w=>[w.startMs,w.endMs]),[[4100,4800],[4900,5000],[5100,5200]]);
  assert.equal(projected[0].text,'<Amélie> & vous.');
  assert.throws(()=>projectSubtitles(doc,{clipId:'clip-a',sourceInMs:0,sourceOutMs:3000,timelineStartMs:0,playbackRate:2}),/SPEED/);
  assert.deepEqual(projectSubtitles(doc,{clipId:'clip-a',sourceInMs:3000,sourceOutMs:4000,timelineStartMs:0,playbackRate:1}),[]);
});
