import assert from 'node:assert/strict';
import test from 'node:test';
import { createConversationMediaReadAccess } from '../frontend/src/server/studio/conversation-media-read-access';
import { readVideoExcerptSource } from '../frontend/server/video-excerpts/source-access';
import { createVideoExcerptPostHandler } from '../frontend/server/video-excerpts/http';
import { NextRequest } from '../frontend/node_modules/next/server';
const source={type:'asset' as const,kind:'video' as const,assetId:'ma_11111111111111111111111111111111'};
const media={id:'original',ref:source,kind:'video' as const,url:'https://canonical.example/full.mp4',mime:'video/mp4',previewUrl:'https://canonical.example/short.mp4',thumbUrl:null,durationSec:60,originalAccess:{type:'owned-storage' as const,storageKey:'user-assets/owner/full.mp4'}};
test('owned source access signs the resolved full timeline without replacing canonical identity',async()=>{
 const result=await readVideoExcerptSource('owner',{source},{resolve:async(owner,ref)=>{assert.equal(owner,'owner');assert.deepEqual(ref,source);return media;},readAccess:async(owner,resolved)=>{assert.equal(owner,'owner');assert.equal(resolved,media);return createConversationMediaReadAccess(owner,resolved,{sign:async(key,options)=>{assert.equal(key,'user-assets/owner/full.mp4');assert.equal(options?.expiresInSeconds,300);return 'https://signed.example/full.mp4?token=short-lived';}});}});
 assert.deepEqual(result,{previewUrl:'https://signed.example/full.mp4?token=short-lived'});
 assert.equal(media.url,'https://canonical.example/full.mp4');
});
test('source read rejects arbitrary URLs, audio refs, unauthenticated and unavailable sources before signing',async()=>{
 let signed=0;
 const dependencies={resolve:async()=>{throw Error('MEDIA_NOT_AVAILABLE');},readAccess:async()=>{signed++;return{url:'secret',expires:null};}};
 for(const payload of [{url:'https://arbitrary.example/file.mp4'},{source,url:'https://arbitrary.example'},{source:{...source,kind:'audio'}}])await assert.rejects(readVideoExcerptSource('owner',payload,dependencies), (e:any)=>e.code==='PARAMETER_INVALID');
 await assert.rejects(readVideoExcerptSource('',{source},dependencies),(e:any)=>e.code==='AUTH_REQUIRED');
 await assert.rejects(readVideoExcerptSource('other',{source},dependencies),(e:any)=>e.code==='SOURCE_UNAVAILABLE');
 assert.equal(signed,0);
});
test('source read shares same-origin authenticated bounded no-store HTTP boundary',async()=>{
 let calls=0;
 const handler=createVideoExcerptPostHandler({userId:async()=> 'owner',prepare:async()=>{calls++;return{previewUrl:'https://signed.example/full.mp4'};}});
 const req=(origin:string)=>new NextRequest('https://maxvideoai.com/api/uploads/video/excerpt/source',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({source})});
 assert.equal((await handler(req('https://evil.example'))).status,403);
 const response=await handler(req('https://maxvideoai.com'));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
});
