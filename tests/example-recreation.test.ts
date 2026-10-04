import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExampleRecreationHref, parseExampleRecreationSettings, publicExampleResolution } from '../frontend/lib/example-recreation';
import { buildExampleRecreationSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-example-recreation';
import { buildVideoSettingsFormState, resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { getBaseEngines } from '../frontend/src/lib/engines';
const engines = getBaseEngines();
const settings = {durationSec: 22, resolution: '720p', aspectRatio: '16:9', audio: true, mode: 't2v' as const};
const video = {id:'public-example',engineId:'wan-3-prime',engineLabel:'Wan 3 Prime',prompt:'Full original prompt',durationSec:22,aspectRatio:'16:9',createdAt:''};
const query = (engine='wan-3', overrides={}) => new URL(buildExampleRecreationHref(video.id,engine,{...settings,...overrides}),'https://maxvideoai.com').search;
function hydrate(searchString:string){
 const snapshot=buildExampleRecreationSnapshot(video,searchString,engines);assert.ok(snapshot,searchString);
 const resolved=resolveVideoSettingsSnapshot(snapshot,{engines,engineMap:new Map(engines.map(e=>[e.id,e])),createLocalId:p=>p,createFallbackScene:()=>({id:'s',prompt:'',duration:5}),createFallbackKlingElement:()=>({id:'e',frontal:null,references:[null],video:null})});
 return {resolved,form:buildVideoSettingsFormState(resolved,null)};
}

test('quoted comparison survives URL, public video hydration and form coercion with the selected model',()=>{
 const {resolved,form}=hydrate(query());
 assert.equal(form.engineId,'wan-3');assert.equal(form.durationSec,22);assert.equal(form.resolution,'720p');assert.equal(form.aspectRatio,'16:9');assert.equal(form.audio,true);assert.equal(form.mode,'t2v');
 assert.equal(resolved.prompt,video.prompt);assert.deepEqual(resolved.inputAssets,{});assert.equal(resolved.klingElements?.every(e=>!e.frontal&&!e.video),true);
});
test('portrait480p uses its own advertised configuration, not landscape720p defaults',()=>{
 const {form}=hydrate(query('wan-3',{durationSec:30,resolution:'480p',aspectRatio:'9:16'}));
 assert.equal(form.durationSec,30);assert.equal(form.resolution,'480p');assert.equal(form.aspectRatio,'9:16');
});
test('unsupported duration, engine, framing and malformed query never silently hydrate another scenario',()=>{
 for(const q of [query('seedance-2-0'),query('unknown'),query('wan-3',{durationSec:99}),query('wan-3',{aspectRatio:'invented'}),query().replace('duration=22','duration=NaN'),query().replace('audio=1','audio=maybe'),query().replace('mode=t2v','mode=i2v')])assert.equal(buildExampleRecreationSnapshot(video,q,engines),null,q);
});
test('serialized configuration has no price, references or prompt; normal from links do not opt in',()=>{
 assert.equal(parseExampleRecreationSettings(new URLSearchParams('from=public-example&engine=wan-3')),null);
 const href=buildExampleRecreationHref('id with spaces','wan-3',settings);assert.ok(href.includes('from=id+with+spaces'));assert.ok(!href.includes('price'));assert.ok(!href.includes('prompt'));
 assert.deepEqual(parseExampleRecreationSettings(new URL(href,'https://maxvideoai.com').searchParams),settings);
});
test('measured public resolution preserves portrait and refuses unknown/missing dimensions',()=>{
 assert.equal(publicExampleResolution(480,854),'480p');assert.equal(publicExampleResolution(1280,720),'720p');assert.equal(publicExampleResolution(2544,1456),null);assert.equal(publicExampleResolution(undefined,720),null);
});

test('comparison preserves1080p and4k across legacy engine resolution token spellings',()=>{
 for(const [engineId,resolution,durationSec,expected] of [
  ['minimax-h3-max','1080p',15,'1080P'], ['minimax-h3','768p',15,'768P'], ['ltx-2-5-fast','4k',6,'2160p'],
 ] as const){
  const {form}=hydrate(query(engineId,{resolution,durationSec}));assert.equal(form.resolution,expected,engineId);
 }
});
test('LTX Fast long clips cannot silently change resolution or frame rate after a comparison',()=>{
 assert.equal(buildExampleRecreationSnapshot(video,query('ltx-2-3-fast',{durationSec:20,resolution:'4k'}),engines),null);
 const {form}=hydrate(query('ltx-2-3-fast',{durationSec:20,resolution:'1080p'}));
 assert.equal(form.durationSec,20);assert.equal(form.resolution,'1080p');assert.equal(form.fps,25);
});
