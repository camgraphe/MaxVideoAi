import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {createHash} from 'node:crypto';
test('draft upload verifies image bytes and reuses an immutable private object',async()=>{
 const {storeDraftEditorialMedia}=await import('../frontend/src/server/editorial/media-upload.ts');
 const data=await sharp({create:{width:640,height:360,channels:3,background:'blue'}}).webp().toBuffer(),sha=createHash('sha256').update(data).digest('hex');
 const objects=new Map<string,Buffer>();let writes=0;
 const dependencies={read:async(key:string)=>objects.get(key)??null,put:async(key:string,bytes:Buffer)=>{writes++;objects.set(key,bytes)},assertPrivate:async()=>{}};
 const first=await storeDraftEditorialMedia(data,'image/webp',sha,dependencies);const second=await storeDraftEditorialMedia(data,'image/webp',sha,dependencies);
 assert.equal(writes,1);assert.deepEqual(first,second);assert.equal(first.storageKey,`editorial/drafts/${sha}.webp`);assert.equal(first.width,640);assert.equal(first.height,360);
 await assert.rejects(storeDraftEditorialMedia(data,'image/png',sha,dependencies),/format/i);
 await assert.rejects(storeDraftEditorialMedia(data,'image/webp','0'.repeat(64),dependencies),/hash/i);
 await assert.rejects(storeDraftEditorialMedia(Buffer.from('<svg onload="evil()"/>'),'image/webp',sha,dependencies));
});
test('a publicly reachable draft object cannot be accepted',async()=>{
 const {storeDraftEditorialMedia}=await import('../frontend/src/server/editorial/media-upload.ts');
 const data=await sharp({create:{width:640,height:360,channels:3,background:'blue'}}).webp().toBuffer(),sha=createHash('sha256').update(data).digest('hex');
 await assert.rejects(storeDraftEditorialMedia(data,'image/webp',sha,{read:async()=>null,put:async()=>{},assertPrivate:async()=>{throw Error('Draft object is publicly readable');}}),/publicly readable/);
});
