import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExampleWatchDetail } from '../frontend/server/example-watch-detail';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
const video:GalleryVideo={id:'public-example',userId:'private-owner',engineId:'wan-3-prime',engineLabel:'Wan 3 Prime',prompt:'Complete public prompt',promptExcerpt:'Short',durationSec:22,aspectRatio:'16:9',outputWidth:1280,outputHeight:720,hasAudio:true,createdAt:'',visibility:'public',indexable:true,canUpscale:false,videoUrl:'https://media.maxvideoai.com/example.mp4',thumbUrl:'https://media.maxvideoai.com/example.webp',finalPriceCents:401,currency:'USD',settingsSnapshot:{refs:{imageUrl:'https://private.example/secret.jpg'}}};
test('public detail serializes no ownership/private references and offers three executable proposals',async()=>{
 const contexts:any[]=[];
 const detail=await projectExampleWatchDetail(video,null,async context=>{contexts.push(context);return {totalCents:200,currency:'USD'};});
 assert.ok(detail);assert.equal(detail.prompt,video.prompt);assert.equal(detail.historicalCost?.amountCents,401);
 assert.equal(detail.recreateHref,'/app?from=public-example');
 assert.equal(detail.scenario?.durationSec,22);assert.equal(detail.scenario?.resolution,'720p');
 assert.equal(detail.references.length,0);assert.ok(!JSON.stringify(detail).includes('private-owner'));assert.ok(!JSON.stringify(detail).includes('secret.jpg'));
 assert.equal(detail.quotes.length,3);assert.equal(new Set(detail.quotes.map(q=>q.engineId)).size,detail.quotes.length);
 for(const context of contexts){assert.equal(context.mode,'t2v');assert.equal(context.referenceImageCount,0);}
 for(const quote of detail.quotes){const url=new URL(quote.href,'https://maxvideoai.com');assert.equal(url.searchParams.get('engine'),quote.engineId);assert.equal(url.searchParams.get('duration'),'22');}
});
test('missing source configuration still offers explicit proposals; unavailable pricing is omitted',async()=>{
 const missing=await projectExampleWatchDetail({...video,outputWidth:null,outputHeight:null},null,async()=>({totalCents:250,currency:'USD'}));
 assert.equal(missing?.scenario,null);assert.equal(missing?.quotes.length,3);assert.ok(missing?.quotes.every(q=>q.settings.durationSec===22));
 const unavailable=await projectExampleWatchDetail(video,null,async()=>{throw Error('Unavailable');});assert.deepEqual(unavailable?.quotes,[]);
});
test('private or non-discoverable videos do not produce a public detail',async()=>{
 for(const hidden of [{visibility:'private' as const},{indexable:false},{videoUrl:undefined}])assert.equal(await projectExampleWatchDetail({...video,...hidden},null,async()=>({totalCents:1,currency:'USD'})),null);
});
test('unavailable source engines do not offer a misleading recreate action',async()=>{
 const detail=await projectExampleWatchDetail({...video,engineId:'unavailable-source'},null,async()=>({totalCents:200,currency:'USD'}));
 assert.equal(detail?.recreateHref,null);
});
test('measured configuration wins, references need explicit editorial approval, and source images never enter app links',async()=>{
 const {VIDEO_SEO_EDITORIAL_ENTRIES}=await import('../frontend/config/video-seo-editorial');
 const editorial={...VIDEO_SEO_EDITORIAL_ENTRIES[0],id:video.id,showSourceImages:true,seoStatus:'approved' as const};
 const image='https://media.maxvideoai.com/reference.webp';
 const configured={...video,settingsSnapshot:{inputMode:'i2v',core:{resolution:'1080p'},refs:{imageUrl:image,referenceImages:[image,'https://media.maxvideoai.com/signed.jpg?X-Amz-Signature=secret']}}};
 const approved=await projectExampleWatchDetail(configured,editorial,async()=>({totalCents:250,currency:'USD'}));
 assert.equal(approved?.scenario?.resolution,'720p');assert.ok(approved?.references.some(reference=>reference.url===image));assert.ok(approved?.references.every(reference=>!reference.url.includes('Signature')));
 assert.ok(approved?.quotes.every(quote=>!quote.href.includes('reference')));
 for(const change of [{showSourceImages:false},{seoStatus:'draft' as const}]){
  const detail=await projectExampleWatchDetail(configured,{...editorial,...change},async()=>({totalCents:250,currency:'USD'}));assert.deepEqual(detail?.references,[]);
 }
 const unknown=await projectExampleWatchDetail({...configured,outputWidth:1281,outputHeight:719},editorial,async()=>{throw Error('Unknown measured size');});assert.equal(unknown?.scenario,null);
});
test('public comparisons use the canonical price owner while prioritizing identical configurations',async()=>{
 const {computeCanonicalPublicSnapshot}=await import('../frontend/server/pricing/quote-public');
 const detail=await projectExampleWatchDetail(video,null,context=>computeCanonicalPublicSnapshot(context,{loadOverrides:async()=>({status:'loaded',rules:[],routingRules:[]})}));
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='wan-3-prime')?.amountCents,401);
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='wan-3')?.amountCents,286);
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='seedance-2-5')?.amountCents,1272);
});

test('unusual output sizes and aspect ratios still get three honest, executable configurations',async()=>{
 const {computeCanonicalPublicSnapshot}=await import('../frontend/server/pricing/quote-public');
 const {buildExampleRecreationSnapshot}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-example-recreation');
 const {getBaseEngines}=await import('../frontend/src/lib/engines');
 for (const source of [
  {...video, durationSec:6,outputWidth:1590,outputHeight:910,aspectRatio:'159:91'},
  {...video, durationSec:30,outputWidth:480,outputHeight:854,aspectRatio:'9:16'},
  {...video, durationSec:90,outputWidth:1080,outputHeight:1920,aspectRatio:'9:16'},
  {...video, durationSec:7,hasAudio:false,outputWidth:1920,outputHeight:1080},
 ]) {
  const contexts:any[]=[];
  const detail=await projectExampleWatchDetail(source,null,context=>{contexts.push(context);return computeCanonicalPublicSnapshot(context,{loadOverrides:async()=>({status:'loaded',rules:[],routingRules:[]})});});
  assert.equal(detail?.quotes.length,3);
  assert.equal(new Set(detail.quotes.map(q=>q.engineId)).size,3);
  assert.equal(new Set(detail.quotes.map(q=>q.amountCents)).size,3,'prefer different canonical prices where available');
  for(const q of detail.quotes){
   assert.ok(q.amountCents>0);
   const params=new URL(q.href,'https://maxvideoai.com').searchParams;
   assert.equal(Number(params.get('duration')),q.settings.durationSec);
   assert.equal(params.get('resolution'),q.settings.resolution);
   assert.equal(params.get('aspect'),q.settings.aspectRatio);
   assert.equal(params.get('audio'),q.settings.audio?'1':'0');
   assert.ok(buildExampleRecreationSnapshot({...source,outputWidth:source.outputWidth??undefined,outputHeight:source.outputHeight??undefined},params.toString(),getBaseEngines()));
   const context=contexts.find(c=>c.engine.id===q.engineId);
   assert.equal(context.durationSec,q.settings.durationSec);
   assert.equal(context.aspectRatio,q.settings.aspectRatio);
   if(source.durationSec<=30)assert.equal(q.settings.durationSec,source.durationSec,'prefer exact duration even when resolution changes');
  }
  if(source.durationSec===90)assert.ok(detail.quotes.some(q=>q.changed.includes('durationSec')));
 }
});
