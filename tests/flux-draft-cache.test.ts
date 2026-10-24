import assert from 'node:assert/strict';
import test from 'node:test';
import { qualifyFluxDraftPair, checkFluxDraftCacheAvailability, fluxDraftQuoteBinding } from '../frontend/server/flux-draft-cache';
const source={ownerId:'owner',jobId:'draft',outputId:'out',providerRequestId:'request',attemptId:9,endpoint:'blackforestlabs/flux-3/image-to-video/draft',outputUrl:'owned',outputSha256:'a'.repeat(64)};
const proof={providerVideoUrl:'https://v3.fal.media/files/output.mp4',cacheUrl:'https://v3.fal.media/files/cache.bin',providerRequestId:'request',videoIdentity:'same-video',audioIdentity:'same-audio',ownedVideoIdentity:'same-video',ownedAudioIdentity:'same-audio',ownedSha256:source.outputSha256,durationSec:10.041667,fps:24,decodedFrameCount:241};
test('unknown expiry admits exact paired native Draft with measured fractional quantity',()=>{
 const pair=qualifyFluxDraftPair(source,proof);
 assert.equal(pair.durationSec,10.041667);assert.equal(pair.expiresAt,null);
 const binding=fluxDraftQuoteBinding(pair);
 assert.equal(JSON.stringify(binding).includes('fal.media'),false);
 assert.equal(binding.fluxDraftSource.durationSec,10.041667);
 for(const facts of [{durationSec:20+1/24,fps:24,decodedFrameCount:481},{durationSec:20.04,fps:25,decodedFrameCount:501}]) assert.equal(qualifyFluxDraftPair(source,{...proof,...facts}).durationSec,facts.durationSec);
});
test('wrong output, request, missing cache and Extend caches cannot qualify; Draft remains independent',()=>{
 for(const change of [{cacheUrl:''},{providerRequestId:'other'},{ownedSha256:'b'.repeat(64)},{ownedVideoIdentity:'other'},{ownedAudioIdentity:'other'},{durationSec:21.001}]) assert.throws(()=>qualifyFluxDraftPair(source,{...proof,...change}));
 assert.throws(()=>qualifyFluxDraftPair({...source,endpoint:'blackforestlabs/flux-3/extend-video/draft'},proof));
});
test('cache availability uses pinned bounded GET, rejects known invalidation and never invents TTL',async()=>{
 let opened=0,cancelled=0;
 const deps={lookupHost:async()=>[{address:'8.8.8.8',family:4 as const}],openPinnedHttps:async()=>{opened++;return{statusCode:200,headers:{},body:(async function*(){yield new Uint8Array([1]);yield new Uint8Array(1000);})(),cancel:()=>{cancelled++;}};}};
 const pair=qualifyFluxDraftPair(source,proof);
 await checkFluxDraftCacheAvailability(pair,deps);assert.equal(opened,1);assert.equal(cancelled,1);
 await assert.rejects(()=>checkFluxDraftCacheAvailability({...pair,invalidatedAt:'2026-01-01'},deps));
 await assert.rejects(()=>checkFluxDraftCacheAvailability({...pair,expiresAt:'2020-01-01'},deps));
 await assert.rejects(()=>checkFluxDraftCacheAvailability({...pair,cacheUrl:'https://localhost/x'},deps));assert.equal(opened,1);
});
