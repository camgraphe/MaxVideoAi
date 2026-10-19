import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { prepareCreatorProfile } from '../frontend/src/server/tools/creator-profiles';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';

const asset = (id: string, kind: 'image' | 'video' | 'audio') => ({ type: 'asset' as const, assetId: id, kind });
const image = { role: 'source', source: asset('product', 'image') };
const video = { role: 'source', source: asset('clip', 'video'), segment: { startSec: 2, endSec: 12 } };
const audio = { role: 'audio', source: asset('voice', 'audio') };
function measured(input: typeof image, durationSec: number | null = null) {
  return { input, asset: asset(input.source.assetId, input.source.kind), url: `https://owned.example/${input.source.assetId}`,
    facts: { kind: input.source.kind, width: input.source.kind === 'audio' ? null : 1024, height: input.source.kind === 'audio' ? null : 1024,
      durationSec, audioDurationSec:durationSec,audioStartSec:0, fps: input.source.kind === 'video' ? 30 : null, hasAudio: input.source.kind !== 'image', sizeBytes: 5000,
      mimeType: input.source.kind === 'image' ? 'image/png' : input.source.kind === 'audio' ? 'audio/wav' : 'video/mp4' },
    fingerprint: 'source-fingerprint' };
}
test('creator settings reject arbitrary provider controls and mismatched media roles', () => {
  assert.equal(creatorOperationInputSchema.safeParse({toolId:'product-photo-editor',version:1,inputs:[image],settings:{action:'studio',instruction:'White background'}}).success,true);
  for (const bad of [
    {toolId:'product-photo-editor',version:1,inputs:[video],settings:{action:'studio'}},
    {toolId:'lip-sync',version:1,inputs:[image,audio],settings:{mode:'photo',loop:true}},
    {toolId:'motion-transfer',version:1,inputs:[image],settings:{}},
    {toolId:'product-photo-editor',version:1,inputs:[image,image],settings:{action:'studio'}},
  ]) assert.equal(creatorOperationInputSchema.safeParse(bad).success,false);
});
test('product photo maps exact source first and style second to existing canonical GPT edit', () => {
  const style = {role:'style',source:asset('mood','image')};
  const request = creatorOperationInputSchema.parse({toolId:'product-photo-editor',version:1,inputs:[style,image],settings:{action:'lifestyle',instruction:'On a desk'}});
  const result = prepareCreatorProfile(request,[measured(style),measured(image)]);
  assert.equal(result.request.engineId,'gpt-image-2-5-flare');
  assert.equal(result.request.mode,'i2i');
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:'product',role:'source'},{kind:'asset',assetId:'mood',role:'reference'}]);
  assert.equal(result.request.outputCount,1);
  assert.match(result.request.prompt,/On a desk/);
});
test('Wan Lip photo preserves fractional audio authority with an explicit generated-tail policy', () => {
  const request = creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[image,audio],settings:{mode:'photo'}});
  const result = prepareCreatorProfile(request,[measured(image),measured(audio,7.4)]);
  assert.equal(result.request.engineId,'wan-3');
  assert.equal(result.request.mode,'ref2v');
  assert.equal(result.expectedDurationSec,7.4);
  assert.equal(result.request.settings.durationSec,8);
  assert.equal(result.request.settings.resolution,'480p');assert.equal(result.request.settings.aspectRatio,'1:1');
  assert.deepEqual(result.outputTiming,{kind:'trim-generated-tail',generatedDurationSec:8});
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:'product',role:'reference'},{kind:'asset',assetId:'voice',role:'reference'}]);
  assert.equal(result.audioPolicy,'preserve');
});
test('Wan edit rejects implicit duration rounding and requests the measured explicit segment', () => {
  const request = creatorOperationInputSchema.parse({toolId:'product-video-editor',version:1,inputs:[video],settings:{action:'background',instruction:'Studio wall',audioPolicy:'mute'}});
  assert.throws(()=>prepareCreatorProfile(request,[measured(video,7.4)]),/whole-second/);
  const result = prepareCreatorProfile(request,[measured(video,10)]);
  assert.equal(result.request.engineId,'wan-3');
  assert.equal(result.request.mode,'v2v');
  assert.equal(result.request.settings.durationSec,10);
  assert.equal(result.request.settings.audio,false);
  assert.equal(result.audioPolicy,'mute');
});
test('explicit specialist profiles remain closed and do not silently switch to Wan', () => {
  const request = creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[video,audio],profileId:'lip-video-latentsync-v1',settings:{mode:'video'}});
  assert.throws(()=>prepareCreatorProfile(request,[measured(video,10),measured(audio,7)]),/same duration/);
  assert.throws(()=>prepareCreatorProfile(request,[measured(video,10),measured(audio,10)]),/qualification/);
});
test('motion references preserve source roles and reject a mismatched requested specialist', () => {
  const motion = {role:'motion',source:asset('performance','video')};
  const request = creatorOperationInputSchema.parse({toolId:'motion-transfer',version:1,inputs:[image,motion],settings:{orientation:'video',audioPolicy:'preserve'}});
  const result=prepareCreatorProfile(request,[measured(image),measured(motion,10)]);
  assert.equal(result.request.engineId,'wan-3');
  assert.equal(result.request.mode,'ref2v');
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:'performance',role:'reference'},{kind:'asset',assetId:'product',role:'reference'}]);
  assert.match(result.profile.disclosure,/reference/);
  assert.throws(()=>prepareCreatorProfile({...request,profileId:'motion-kling-v3-v1'},[measured(image),measured(motion,10)]),/qualification/);
});
test('every enabled profile normalizes, validates against real registry and uses canonical pricing',async()=>{
  const motion={role:'motion',source:asset('performance','video')};
  for(const [input,sources] of [
    [{toolId:'product-photo-editor',version:1,inputs:[image],settings:{action:'studio'}},[measured(image)]],
    [{toolId:'product-photo-editor',version:1,inputs:[image],settings:{action:'studio',model:'nano-banana-2'}},[measured(image)]],
    [{toolId:'lip-sync',version:1,inputs:[image,audio],settings:{mode:'photo'}},[measured(image),measured(audio,7.4)]],
    [{toolId:'lip-sync',version:1,inputs:[video,audio],settings:{mode:'video'}},[measured(video,7.4),measured(audio,7.4)]],
    [{toolId:'product-video-editor',version:1,inputs:[video],settings:{}},[measured(video,10)]],
    [{toolId:'motion-transfer',version:1,inputs:[image,motion],settings:{}},[measured(image),measured(motion,10)]],
  ] as const){
    const prepared=prepareCreatorProfile(creatorOperationInputSchema.parse(input),[...sources]);
    const request=normalizeGenerationRequest(prepared.request);
    const entry=getFalEngineById(request.engineId)!;
    const resolvedReferences=request.references.map(reference=>{
      assert.equal(reference.kind,'asset');
      const source=sources.find(source=>source.asset.assetId===(reference as {assetId:string}).assetId)!;
      return {assetId:source.asset.assetId,role:reference.role,...(reference.slot===undefined?{}:{slot:reference.slot}),mediaKind:source.facts.kind,storageUrl:source.url,width:source.facts.width,height:source.facts.height,durationSec:source.facts.durationSec,mimeType:source.facts.mimeType,sizeBytes:source.facts.sizeBytes};
    });
    const candidate={engine:entry.engine,surface:request.surface,publicModes:[request.mode],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
    assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences}),request.engineId);
    const price=await priceCanonicalGeneration(request,'member',undefined,{resolvedReferences});
    assert.ok(price.priceCents>0,request.engineId);
  }
});


test('Wan Lip video uses a source video and reference audio with a bounded output envelope',()=>{
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[video,audio],settings:{mode:'video',resolution:'720p'}});
  const result=prepareCreatorProfile(input,[measured(video,2.53),measured(audio,2.53)]);
  assert.equal(result.profile.id,'lip-video-wan-v1');assert.equal(result.request.engineId,'wan-3');assert.equal(result.request.mode,'v2v');
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:'clip',role:'source'},{kind:'asset',assetId:'voice',role:'reference',slot:0}]);
  assert.equal(result.expectedDurationSec,2.53);assert.equal(result.request.settings.durationSec,3);assert.equal(result.request.settings.resolution,'720p');
  assert.deepEqual(result.outputTiming,{kind:'trim-generated-tail',generatedDurationSec:3});
  assert.throws(()=>prepareCreatorProfile(input,[measured(video,10.041667),measured(audio,10.34449)]),/same duration/);
  assert.throws(()=>prepareCreatorProfile(input,[{...measured(video,3),facts:{...measured(video,3).facts,fps:15}},measured(audio,3)]),/16 fps/);
  assert.throws(()=>prepareCreatorProfile(input,[measured(video,15.01),measured(audio,15.01)]),/15/);
});
test('Wan Lip rejects retired LTX quotes and oversized or unsupported audio before canonical submission',()=>{
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[image,audio],settings:{mode:'photo'}});
  assert.throws(()=>prepareCreatorProfile({...input,profileId:'lip-photo-ltx-v1'},[measured(image),measured(audio,7.4)]),/qualification/);
  for(const patch of [{sizeBytes:16*1024*1024},{mimeType:'audio/aac'}]) {
    assert.throws(()=>prepareCreatorProfile(input,[measured(image),{...measured(audio,7.4),facts:{...measured(audio,7.4).facts,...patch}}]),/MP3|WAV|15 MB/);
  }
});

test('Wan video accepts frame-quantized media only for explicitly matched passages that cover all the audio',()=>{
  const passageVideo={...video,segment:{startSec:1,endSec:3.53}};
  const passageAudio={...audio,segment:{startSec:0,endSec:2.53}};
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[passageVideo,passageAudio],settings:{mode:'video'}});
  const result=prepareCreatorProfile(input,[measured(passageVideo,2.533333),measured(passageAudio,2.53)]);
  assert.equal(result.expectedDurationSec,2.53);assert.equal(result.request.settings.durationSec,3);
  assert.throws(()=>prepareCreatorProfile(input,[measured(passageVideo,2.5),measured(passageAudio,2.53)]),/same duration/);
  assert.throws(()=>prepareCreatorProfile(input,[measured(passageVideo,2.6),measured(passageAudio,2.53)]),/same duration/);
  assert.throws(()=>prepareCreatorProfile(input,[measured({...passageVideo,segment:undefined},2.533333),measured(passageAudio,2.53)]),/same duration/);
});
