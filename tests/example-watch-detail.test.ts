import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExampleWatchDetail } from '../frontend/server/example-watch-detail';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
const video:GalleryVideo={id:'public-example',userId:'private-owner',engineId:'wan-3-prime',engineLabel:'Wan 3 Prime',prompt:'Complete public prompt',promptExcerpt:'Short',durationSec:22,aspectRatio:'16:9',outputWidth:1280,outputHeight:720,hasAudio:true,createdAt:'',visibility:'public',indexable:true,canUpscale:false,videoUrl:'https://media.maxvideoai.com/example.mp4',thumbUrl:'https://media.maxvideoai.com/example.webp',finalPriceCents:401,currency:'USD',settingsSnapshot:{refs:{imageUrl:'https://private.example/secret.jpg'}}};
test('public detail serializes no ownership/private references and compares only identical executable settings',async()=>{
 const contexts:any[]=[];
 const detail=await projectExampleWatchDetail(video,null,async context=>{contexts.push(context);return {totalCents:200,currency:'USD'};});
 assert.ok(detail);assert.equal(detail.prompt,video.prompt);assert.equal(detail.historicalCost?.amountCents,401);
 assert.equal(detail.scenario?.durationSec,22);assert.equal(detail.scenario?.resolution,'720p');
 assert.equal(detail.references.length,0);assert.ok(!JSON.stringify(detail).includes('private-owner'));assert.ok(!JSON.stringify(detail).includes('secret.jpg'));
 assert.ok(detail.quotes.length>1&&detail.quotes.length<=4);assert.equal(new Set(detail.quotes.map(q=>q.engineId)).size,detail.quotes.length);
 for(const context of contexts){assert.equal(context.durationSec,22);assert.equal(context.resolution,'720p');assert.equal(context.aspectRatio,'16:9');assert.equal(context.mode,'t2v');assert.equal(context.referenceImageCount,0);}
 for(const quote of detail.quotes){const url=new URL(quote.href,'https://maxvideoai.com');assert.equal(url.searchParams.get('engine'),quote.engineId);assert.equal(url.searchParams.get('duration'),'22');}
});
test('missing public configuration never invents a quote; unavailable pricing is omitted',async()=>{
 const missing=await projectExampleWatchDetail({...video,outputWidth:null,outputHeight:null},null,async()=>{throw Error('Must not quote');});
 assert.equal(missing?.scenario,null);assert.deepEqual(missing?.quotes,[]);
 const unavailable=await projectExampleWatchDetail(video,null,async()=>{throw Error('Unavailable');});assert.deepEqual(unavailable?.quotes,[]);
});
test('private or non-discoverable videos do not produce a public detail',async()=>{
 for(const hidden of [{visibility:'private' as const},{indexable:false},{videoUrl:undefined}])assert.equal(await projectExampleWatchDetail({...video,...hidden},null,async()=>({totalCents:1,currency:'USD'})),null);
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
test('public comparisons use the canonical price owner with one scenario and no adaptations',async()=>{
 const {computeCanonicalPublicSnapshot}=await import('../frontend/server/pricing/quote-public');
 const detail=await projectExampleWatchDetail(video,null,context=>computeCanonicalPublicSnapshot(context,{loadOverrides:async()=>({status:'loaded',rules:[],routingRules:[]})}));
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='wan-3-prime')?.amountCents,401);
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='wan-3')?.amountCents,286);
 assert.equal(detail?.quotes.find(quote=>quote.engineId==='seedance-2-5')?.amountCents,1272);
});
