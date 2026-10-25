import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { createStoreVideoUploadService } from '../frontend/src/server/uploads/store-media-upload';
import { canonicalMediaAssetFields } from '../frontend/lib/media-identity';
import { prepareVideoExcerpt } from '../frontend/server/video-excerpts/prepare';
import { inspectVideoExcerptBytes, trimVideoExcerptBytes } from '../frontend/server/video-excerpts/media';
import { lumaModifyTariffDurationSec } from '../frontend/src/lib/luma-source-video';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { calculateLumaRay32DirectPrice } from '../frontend/src/lib/luma-agents-pricing';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
const exec=promisify(execFile);
for (const [fps,engineId,mode,selected,maximum,hasAudio,sampleRate=48000] of [
  ['30000/1001','luma-ray-3-2','v2v',6,18,true],['24000/1001','luma-ray-3-2','v2v',6,18,true],
  ['30000/1001','luma-ray-3-2','v2v',5.999,18,true],['24000/1001','luma-ray-3-2','v2v',6.001,18,true],
  ['30000/1001','luma-ray-3-2','v2v',18,18,true],['30000/1001','luma-ray-3-2','v2v',18,18,false],['24000/1001','luma-ray-3-2','reframe',10,10,true],['30000/1001','kling-o3-standard','v2v',3,10,true],
  ['30000/1001','luma-ray-3-2','v2v',18,18,true,44100],['24000/1001','luma-ray-3-2','reframe',10,10,true,44100],
] as const) {
  test(`real ${fps} ${hasAudio?`${sampleRate}Hz audible`:'silent'} excerpt at ${mode} ${selected}s selection stays inside the measured and persisted boundary`,async context=>{
    const directory=await mkdtemp(join(tmpdir(),'excerpt-fractional-'));
    try {
      const path=join(directory,'source.mp4');
      await exec(await ensureExecutableFfmpegPath(ffmpeg.path),['-v','error','-f','lavfi','-i',`color=c=blue:s=160x120:r=${fps}:d=25`,...(hasAudio?['-f','lavfi','-i',`sine=frequency=440:sample_rate=${sampleRate}:duration=25`]:[]),'-c:v','libx264','-threads','1',...(hasAudio?['-c:a','aac']:['-an']),'-y',path],{timeout:20000});
      const original=await readFile(path),originalFacts=await inspectVideoExcerptBytes(original,'video/mp4');
      const source={type:'asset' as const,kind:'video' as const,assetId:'ma_11111111111111111111111111111111'};
      const preparedRef={...source,assetId:'ma_22222222222222222222222222222222'};
      const media:StudioResolvedMedia={id:'source',ref:source,kind:'video',url:'https://media.example/source.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:undefined,originalAccess:{type:'external'}};
      let persisted:StudioResolvedMedia|undefined;
      let persists=0;
      const store=createStoreVideoUploadService({
        uploadFileBuffer:async input=>{await input.beforeUpload?.('user-assets/owner/prepared.mp4');return{key:'user-assets/owner/prepared.mp4',url:'https://media.example/prepared.mp4'};},
        createUploadVideoThumbnail:async()=>null,recordUserAsset:async()=> 'legacy',
        ensureReusableAsset:async()=>({publicId:preparedRef.assetId} as never),
        claimStorageObjectProducer:async({objectKey})=>({objectKey,claimId:'claim',leaseExpiresAt:new Date('2030-01-01')}),
        renewStorageObjectProducer:async({claim})=>claim,settleStorageObjectProducer:async()=>{},scheduleProducerHeartbeat:()=>()=>{},
      });
      const result=await prepareVideoExcerpt('owner',{source,engineId,mode,range:{startSec:1,endSec:1+selected}},{
        engine:async id=>getBaseEngineIncludingHidden(id),resolve:async(_owner,ref)=> (ref as typeof source).assetId===preparedRef.assetId?persisted!:media,
        readAccess:async(_owner,value)=>({url:value.url,expires:null}),download:async()=>({bytes:original,fileName:'source.mp4',mimeType:'video/mp4'}),
        inspect:inspectVideoExcerptBytes,trim:trimVideoExcerptBytes,
        persist:async(owner,bytes,facts,lineage)=>{
          assert.ok(facts.durationSec<=maximum,`video stream ${facts.durationSec} exceeds ${maximum}`);
          assert.ok(Math.abs(selected-facts.durationSec)<=1/originalFacts.fps+0.001);
          const stored=await store({userId:owner,bytes,fileName:'excerpt.mp4',declaredMime:'video/mp4',metadata:{videoExcerpt:lineage}});persists++;
          context.diagnostic(`selected=${selected}s video=${facts.durationSec}s stored=${stored.durationSec}s duration-ceiling=${Math.ceil(stored.durationSec)}s`);
          assert.equal(stored.durationSec,selected,'AAC priming must not lengthen the stored container past the selection');
          assert.ok(stored.durationSec<=maximum,`stored duration ${stored.durationSec} exceeds ${maximum}`);
          assert.ok(Math.abs(selected-stored.durationSec)<=1/originalFacts.fps+0.001);
          assert.equal(stored.mediaFacts?.hasAudio,hasAudio);
          if(hasAudio){
            const preparedPath=join(directory,'prepared.mp4');await writeFile(preparedPath,bytes);
            const pcm=(await exec(await ensureExecutableFfmpegPath(ffmpeg.path),['-v','error','-i',preparedPath,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','pipe:1'],{encoding:'buffer',timeout:15000,maxBuffer:4*1024*1024})).stdout;
            assert.ok(Math.abs(pcm.length/4/48000-selected)<=1024/48000+0.001,'selected audio must remain within one AAC frame');
          }
          persisted={...media,id:'prepared',ref:preparedRef,url:stored.storageUrl,durationSec:stored.durationSec,mediaFacts:stored.mediaFacts};
          return{id:stored.legacyAssetId,...canonicalMediaAssetFields(stored.assetId,'video'),url:stored.storageUrl,durationSec:stored.durationSec,mediaFacts:stored.mediaFacts};
        },
      });
      assert.equal(persists,1);assert.ok(result.asset.durationSec!<=maximum);
      if(engineId==='kling-o3-standard')assert.ok(result.asset.durationSec!>=3,'minimum source duration must remain valid');
      if(engineId==='luma-ray-3-2'&&mode==='v2v'){
        const quantity=lumaModifyTariffDurationSec(result.asset.durationSec!);
        const intended=selected===18?18:selected>6?7:6;
        assert.equal(quantity,intended,'frame rounding must not change canonical tariff class');
        const quote=calculateLumaRay32DirectPrice({mode:'v2v',durationSec:quantity,duration:null,resolution:'720p'});
        assert.equal(quote.totalUsd,selected===18?3.888:selected>6?1.512:1.296);
      }
      if(selected===maximum)assert.ok(Math.ceil(result.asset.durationSec!)<=maximum,'source duration cannot round beyond the model maximum');
      const requested = engineId === 'kling-o3-standard' ? 15 : 5;
      const expectedQuantity = engineId === 'kling-o3-standard' ? 15 : mode === 'reframe' ? 5 : selected === 18 ? 18 : selected > 6 ? 7 : 6;
      await priceCanonicalGeneration({schemaVersion:1,surface:'video',engineId,mode,prompt:'Edit the room',settings:{durationSec:requested,resolution:'720p',aspectRatio:'16:9'},outputCount:1,references:[{kind:'asset',assetId:preparedRef.assetId,role:'source'}]},'member',{
        computeVideoPreflight:async input=>{assert.equal(input.durationSec,expectedQuantity,'normal canonical quoting must use measured source timing or the independent requested duration');return{ok:true,total:150,currency:'USD',pricing:{totalCents:150,currency:'USD',membershipTier:'member'}} as never;},
        estimateImage:async()=>{throw Error('Unexpected image quote');},
      },{resolvedReferences:[{assetId:preparedRef.assetId,role:'source',mediaKind:'video',storageUrl:result.asset.url,mimeType:'video/mp4',sizeBytes:1000,width:160,height:120,durationSec:result.asset.durationSec!}]});
      assert.deepEqual(result.range,{startSec:1,endSec:1+selected});
      assert.deepEqual(await readFile(path),original);
    } finally {await rm(directory,{recursive:true,force:true});}
  });
}
