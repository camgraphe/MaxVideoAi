import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { buildContentAddressedFileLeaf } from '../frontend/server/storage';
import { createStoreVideoUploadService } from '../frontend/src/server/uploads/store-media-upload';
test('verified upload persistence keeps excerpt lineage on both owned readers without permitting fact overrides', async()=>{
  const records: Array<Record<string,unknown>> = [];
  const service = createStoreVideoUploadService({
    probeMediaBuffer:async()=>({kind:'video',canonicalMime:'video/mp4',detectedMime:'video/mp4',durationSec:5,width:120,height:160,hasAudio:true}),
    uploadFileBuffer:async input=>{assert.equal(input.contentAddressed,true);assert.equal(input.contentAddressedNamespace,'video-excerpt-v1-test');await input.beforeUpload?.('user-assets/owner/excerpt.mp4');return {key:'user-assets/owner/excerpt.mp4',url:'https://media.example/excerpt.mp4'};},
    createUploadVideoThumbnail:async()=>null,
    recordUserAsset:async input=>{records.push(input.metadata!);return 'legacy';},
    ensureReusableAsset:async input=>{records.push(input.metadata!);return {publicId:'ma_11111111111111111111111111111111'} as never;},
    claimStorageObjectProducer:async({objectKey})=>({objectKey,claimId:'claim',leaseExpiresAt:new Date('2030-01-01')}),
    renewStorageObjectProducer:async({claim})=>claim,settleStorageObjectProducer:async()=>{},scheduleProducerHeartbeat:()=>()=>{},
  });
  const videoExcerpt={version:1,source:{type:'asset',assetId:'original',kind:'video'},range:{startSec:2,endSec:7}};
  await service({userId:'owner',fileName:'excerpt.mp4',declaredMime:'video/mp4',bytes:Buffer.from('video'),contentAddressedNamespace:'video-excerpt-v1-test',metadata:{videoExcerpt,mediaFacts:{source:'probe',durationSec:999}}});
  assert.equal(records.length,2);
  for(const metadata of records) {assert.deepEqual(metadata.videoExcerpt,videoExcerpt);assert.equal((metadata.mediaFacts as {durationSec:number}).durationSec,5);}
});

test('namespaced excerpt keys are stable, distinct and cannot alter ordinary byte-addressed import keys',()=>{
  const bytes=Buffer.from('same video bytes'),digest=createHash('sha256').update(bytes).digest('hex');
  assert.equal(buildContentAddressedFileLeaf(bytes,'video/mp4'),`${digest}.mp4`);
  const prepared=buildContentAddressedFileLeaf(bytes,'video/mp4','video-excerpt-v1-source-range');
  assert.equal(prepared,buildContentAddressedFileLeaf(bytes,'video/mp4','video-excerpt-v1-source-range'));
  assert.notEqual(prepared,`${digest}.mp4`);
  assert.notEqual(prepared,buildContentAddressedFileLeaf(bytes,'video/mp4','video-excerpt-v1-another-source'));
  assert.doesNotMatch(prepared,/[/\\]/);
  assert.throws(()=>buildContentAddressedFileLeaf(bytes,'video/mp4','../untrusted'));
  assert.throws(()=>buildContentAddressedFileLeaf(bytes,'video/mp4','x'.repeat(129)));
});
