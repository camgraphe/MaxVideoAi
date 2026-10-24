import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import {NextRequest} from '../frontend/node_modules/next/server';
import {ensureExecutableFfmpegPath} from '../frontend/server/ffmpeg-runtime';
import {inspectVideoExcerptBytes} from '../frontend/server/video-excerpts/media';
import {isProbedMp4} from '../frontend/server/video-excerpts/flux-ltx-source';
import {prepareVideoExcerpt,persistVideoExcerpt} from '../frontend/server/video-excerpts/prepare';
import {createVideoExcerptPostHandler} from '../frontend/server/video-excerpts/http';
import {createStoreVideoUploadService} from '../frontend/src/server/uploads/store-media-upload';
import {getBaseEngineIncludingHidden} from '../frontend/src/lib/engines';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

// Actual HTTP admission -> encoder -> probe -> storage service -> owned response.
// Only authentication, read-only catalog, owned records and storage/network IO are injected.
test('whole phone MOV becomes private MP4 for FAST; Relight explicitly fits selected timing to 24fps 17n+5',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'operation-http-'));
 try{
  const binary=await ensureExecutableFfmpegPath(ffmpeg.path),input=join(dir,'base.mp4'),phone=join(dir,'phone.mov');
  await promisify(execFile)(binary,['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=25:d=5.56','-f','lavfi','-i','sine=frequency=440:duration=5.56','-c:v','libx264','-threads','1','-c:a','aac','-y',input]);
  await promisify(execFile)(binary,['-v','error','-i',input,'-c','copy','-metadata:s:v:0','rotate=90','-y',phone]);
  const bytes=await readFile(phone),originalFacts=await inspectVideoExcerptBytes(bytes,'video/quicktime');
  assert.equal(isProbedMp4(originalFacts),false);assert.equal(originalFacts.containerMajorBrand,'qt  ');
  const source={type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
  const ref={...source,assetId:'ma_22222222222222222222222222222222'};
  const original:StudioResolvedMedia={id:'source',ref:source,kind:'video',url:'https://store.invalid/original.mov',mime:'video/quicktime',thumbUrl:null,previewUrl:null,originalAccess:{type:'external'}};
  for(const operation of ['flux-fast-edit','h3-relight'] as const){
   let encoded=Buffer.alloc(0),lineage:any;let uploads=0,reads=0;
   const store=createStoreVideoUploadService({
    uploadFileBuffer:async value=>{
     uploads++;encoded=value.data;assert.equal(value.acl,null);assert.equal(value.cacheControl,'private, no-store');assert.equal(value.privateStorageScope,'video-excerpt');assert.match(value.contentAddressedNamespace!,/^video-excerpt-private-v3-/);
     await value.beforeUpload?.('user-assets/owner/copy.mp4');return {key:'user-assets/owner/copy.mp4',url:'https://store.invalid/copy.mp4'};
    },
    createUploadVideoThumbnail:async()=>null,
    recordUserAsset:async value=>{lineage=value.metadata!.videoExcerpt;return value.assetId!;},
    ensureReusableAsset:async()=>({publicId:ref.assetId}) as any,
    claimStorageObjectProducer:async({objectKey})=>({objectKey,claimId:'test',leaseExpiresAt:new Date('2030-01-01')}),
    renewStorageObjectProducer:async({claim})=>claim,settleStorageObjectProducer:async()=>{},scheduleProducerHeartbeat:()=>()=>{},
   });
   const handler=createVideoExcerptPostHandler({userId:async()=> 'owner',prepare:(user,value)=>prepareVideoExcerpt(user,value,{
    engine:async id=>getBaseEngineIncludingHidden(id),
    resolve:async(user,selected)=>{assert.equal(user,'owner');reads++;return (selected as typeof source).assetId===source.assetId?original:{...original,id:'copy',ref,url:'https://store.invalid/copy.mp4',mime:'video/mp4'};},
    readAccess:async(_user,media)=>({url:media.url+'?private=test',expires:null}),
    download:async file=>{assert.equal(file.download_url,original.url+'?private=test');return {bytes,fileName:'phone.mov',mimeType:'video/quicktime'};},
    persist:(user,copy,facts,metadata)=>persistVideoExcerpt(user,copy,facts,metadata,store),
   })});
   const body={source,engineId:operation==='flux-fast-edit'?'flux-3':'minimax-h3-max',mode:'v2v',operation,fieldId:'video_url',range:{startSec:0,endSec:originalFacts.durationSec},...(operation==='h3-relight'?{acceptedCopyDurationSec:124/24}:{})};
   const response=await handler(new NextRequest('https://maxvideoai.com/api/uploads/video/excerpt',{method:'POST',headers:{origin:'https://maxvideoai.com','content-type':'application/json'},body:JSON.stringify(body)}));
   const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
   assert.equal(uploads,1);assert.ok(reads>=4);assert.equal(result.asset.previewUrl,'https://store.invalid/copy.mp4?private=test');
   assert.deepEqual(result.original,source);assert.notEqual(result.asset.assetId,source.assetId);
   const measured=await inspectVideoExcerptBytes(encoded,'video/mp4',{decodedFrames:true});
   assert.equal(isProbedMp4(measured),true);assert.equal(measured.width,120);assert.equal(measured.height,160);assert.equal(measured.hasAudio,true);
   assert.equal(lineage.operation,operation);assert.equal(lineage.storageAccess,'private');assert.equal(lineage.version,3);
   assert.equal(measured.fps,operation==='h3-relight'?24:25);
   if(operation==='h3-relight'){assert.equal(measured.decodedFrameCount,124);assert.equal(measured.constantFrameRate,true);assert.equal(measured.durationSec,Number((124/24).toFixed(6)));assert.equal(result.asset.durationSec,124/24);assert.ok(lineage.copyPlan.removedEndSec>0);}
   else assert.equal(measured.durationSec,originalFacts.durationSec);
   assert.deepEqual(await readFile(phone),bytes);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
