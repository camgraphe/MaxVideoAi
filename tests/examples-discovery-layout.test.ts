import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryOpening, selectPreviewIds } from '../frontend/components/examples/examples-discovery-layout';
const videos = Array.from({length:24},(_,i)=>({id:`v${i}`,aspectRatio:i%4===1?'9:16':'16:9'}));
test('opening uses four compatible formats within the same page; other sort/page order stays intact',()=>{
 const {opening,rest}=buildGalleryOpening(videos,true);
 assert.deepEqual(opening.map(v=>v.id),['v0','v1','v2','v3']);
 assert.deepEqual([...opening,...rest],videos);
 for(const input of [videos.slice(0,3),videos.map(v=>({...v,aspectRatio:'9:16'}))])assert.equal(buildGalleryOpening(input,true).opening.length,0);
 assert.deepEqual(buildGalleryOpening(videos,false),{opening:[],rest:videos});
 const measured=videos.map((v,i)=>({...v,aspectRatio:'unknown',outputWidth:i%4===1?480:1280,outputHeight:i%4===1?854:720}));
 assert.equal(buildGalleryOpening(measured,true).opening.length,4);
});
test('opening accepts FLUX codec-rounded 16:9 and 9:16 output dimensions',()=>{
 const flux=[
  {id:'lead',aspectRatio:'16:9',outputWidth:1280,outputHeight:704},
  {id:'portrait',aspectRatio:'9:16',outputWidth:704,outputHeight:1280},
  {id:'side-a',aspectRatio:'16:9',outputWidth:1280,outputHeight:704},
  {id:'side-b',aspectRatio:'16:9',outputWidth:1280,outputHeight:704},
 ];
 assert.deepEqual(buildGalleryOpening(flux,true).opening.map(video=>video.id),flux.map(video=>video.id));
});
test('preview budget is bounded, prioritizes intent and stops every preview when paused',()=>{
 const ids=videos.map(v=>v.id),visible=new Set(ids.slice(0,8));
 assert.deepEqual(selectPreviewIds(ids,visible,null,3,false),['v0','v1','v2']);
 assert.deepEqual(selectPreviewIds(ids,visible,'v7',3,false),['v7','v0','v1']);
 assert.deepEqual(selectPreviewIds(ids,visible,'v7',1,false),['v7']);
 assert.deepEqual(selectPreviewIds(ids,visible,'v20',1,false),['v0']);
 assert.deepEqual(selectPreviewIds(ids,visible,'v7',3,true),[]);
});
