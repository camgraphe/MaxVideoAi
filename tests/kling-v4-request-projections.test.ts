import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { normalizeMaxVideoProviderElements } from '../frontend/src/lib/video-provider-elements';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { canonicalSettingsSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildKlingV4FalRequest } from '../frontend/src/lib/kling-v4';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

const elements = Array.from({length:7}, (_,i) => ({ frontalImageUrl:`https://media.example/front-${i}.png`, referenceImageUrls:[`https://media.example/ref-${i}.png`], ...(i < 3 ? {voiceId:`voice-${i}`} : {}) }));
const scenes = Array.from({length:10}, (_,i) => ({prompt:`Shot ${i + 1}`,durationSec:3}));
const canonical = (overrides:Record<string,unknown> = {}) => normalizeGenerationRequest({surface:'video',engineId:'kling-v4',mode:'t2v',prompt:'',settings:{durationSec:30,multiPrompt:scenes},references:[],...overrides});

test('V4 element normalization preserves seven elements and their voice binding; V3 stays limited to three', () => {
  assert.equal(normalizeMaxVideoProviderElements(elements).length,3);
  const result = normalizeMaxVideoProviderElements(elements, {engineId:'kling-v4'});
  assert.equal(result.length,7);
  assert.equal(result[2].voiceId,'voice-2');
  assert.throws(() => normalizeMaxVideoProviderElements([...elements,elements[0]], {engineId:'kling-v4'}));
  assert.throws(() => normalizeMaxVideoProviderElements([{...elements[0], referenceImageUrls:Array(4).fill('https://media.example/a.png')}], {engineId:'kling-v4'}));
});

test('route normalization preserves V4 scenes and elements and rejects rounding or inconsistent duration', () => {
  const options = (body:Record<string,unknown>) => buildGenerateRequestOptions({body,engine:KLING_V4_ENGINE,mode:'ref2v',isBytePlusV1a:false});
  const result = options({elements,multiPrompt:scenes.map(scene=>({prompt:scene.prompt,duration:scene.durationSec})),durationSec:30});
  assert.equal(result.ok,true);
  if(result.ok) { assert.equal(result.options.elements?.length,7); assert.equal(result.options.elements?.[0].voiceId,'voice-0'); assert.equal(result.options.durationSec,30); }
  for (const duration of [2.5,'3s',0,31]) assert.equal(options({multiPrompt:[{prompt:'Scene',duration}]}).ok,false);
  assert.equal(options({multiPrompt:[{prompt:'Scene',duration:5}],durationSec:10}).ok,false);
});

test('route normalization preserves V4 reference auto framing and rejects malformed subject fields before cleaning', () => {
  const options = (body:Record<string,unknown>) => buildGenerateRequestOptions({body,engine:KLING_V4_ENGINE,mode:'ref2v',isBytePlusV1a:false});
  const result = options({prompt:'Reference framing',aspectRatio:'auto'});
  assert.equal(result.ok,true);
  if(result.ok) assert.equal(result.options.aspectRatio,'auto');
  for(const patch of [{voiceId:42},{voice_id:42},{voiceId:''},{referenceImageUrls:['',55,null]},
    {reference_image_urls:['https://media.example/valid.png',null]}, {referenceImageUrls:'https://media.example/a.png'},
    {frontalImageUrl:42},{video_url:false},{referenceAssetIds:['valid',55]}]) {
    const invalid=options({elements:[{...elements[0],...patch}]});
    assert.equal(invalid.ok,false,JSON.stringify(patch));
    if(!invalid.ok) assert.equal(invalid.status,400);
  }
});

test('canonical and MCP V4 multi-shot accept thirty seconds and keep older limits', () => {
  assert.equal(canonicalSettingsSchema.safeParse({multiPrompt:scenes}).success,true);
  assert.equal((canonical().settings.multiPrompt as unknown[]).length,10);
  for (const settings of [{durationSec:29,multiPrompt:scenes},{durationSec:31,multiPrompt:[{prompt:'Long',durationSec:31}]},{durationSec:3,multiPrompt:[{prompt:'Fraction',durationSec:1.5},{prompt:'Fraction',durationSec:1.5}]}]) assert.throws(()=>canonical({settings}));
  assert.throws(()=>canonical({engineId:'kling-3-pro'}));
  const candidate = {engine:KLING_V4_ENGINE,surface:'video' as const,publicModes:KLING_V4_ENGINE.modes,modeCaps:KLING_V4_ENGINE.modeCaps!};
  assert.ok(projectAgentModelModeDetails(candidate,'t2v').settings.some(setting=>setting.key==='multiPrompt'));
  assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(canonical({settings:{durationSec:30,multiPrompt:scenes,resolution:'1080p',aspectRatio:'16:9'}}),candidate));
});

test('offline owned-media fixtures carry dimensions, bytes, duration and slots into all V4 media bodies', () => {
  const fixtures = [
    {mode:'i2v', assets:[['opening','first_frame','image'],['ending','last_frame','image']]},
    {mode:'ref2v', assets:[['opening','first_frame','image'],['look','reference','image'],['motion','reference','video']]},
    {mode:'v2v', assets:[['source','source','video'],['look','reference','image']]},
  ] as const;
  for (const {mode,assets} of fixtures) {
    const request=canonical({mode,prompt:'An authored scene',settings:{durationSec:5,resolution:'1080p'},references:assets.map(([assetId,role])=>({kind:'asset',assetId,role}))});
    const resolvedReferences=request.references.map(reference=>{
      assert.equal(reference.kind,'asset');
      const assetId=reference.kind==='asset'?reference.assetId:'';
      const kind=assets.find(asset=>asset[0]===assetId)![2];
      return {assetId,role:reference.role,slot:reference.slot,mediaKind:kind,storageUrl:`https://media.example/${assetId}.${kind==='image'?'png':'mp4'}`,width:1280,height:720,durationSec:kind==='video'?4:null,mimeType:kind==='image'?'image/png':'video/mp4',sizeBytes:4096,originalName:assetId};
    });
    const body=buildPaidVideoRequestBody({request,resolvedReferences,engine:KLING_V4_ENGINE,quoteId:'offline-fixture',canonicalPricing:{membershipTier:'member'}});
    const inputs=body.inputs as Array<{slotId:string;assetId:string;width:number;height:number;size:number;durationSec?:number}>;
    assert.equal(inputs.length,assets.length);
    for (const input of inputs) {assert.equal(input.width,1280);assert.equal(input.height,720);assert.equal(input.size,4096);assert.ok(input.assetId);}
    const provider=buildKlingV4FalRequest(body as GeneratePayload).requestBody;
    if(mode==='i2v') {assert.equal(provider.start_image_url,'https://media.example/opening.png');assert.equal(provider.end_image_url,'https://media.example/ending.png');assert.equal(provider.aspect_ratio,undefined);}
    if(mode==='ref2v') {assert.deepEqual(provider.video_urls,['https://media.example/motion.mp4']);assert.deepEqual(provider.image_urls,['https://media.example/look.png']);assert.equal(provider.end_image_url,undefined);}
    if(mode==='v2v') {assert.equal(provider.video_url,'https://media.example/source.mp4');assert.deepEqual(provider.image_urls,['https://media.example/look.png']);assert.equal(provider.aspect_ratio,undefined);}
    assert.throws(()=>buildPaidVideoRequestBody({request,resolvedReferences:[],engine:KLING_V4_ENGINE,quoteId:'offline-fixture',canonicalPricing:{membershipTier:'member'}}));
  }
});

test('V4 paid body preserves input metadata and authored reference order for reference and edit modes', () => {
  for(const mode of ['ref2v','v2v'] as const) {
    const references = [...(mode==='v2v'?[{kind:'https',url:'https://media.example/source.mp4',role:'source',mediaKind:'video'}]:[]), ...['z','a'].map(id=>({kind:'https',url:`https://media.example/${id}.png`,role:'reference',mediaKind:'image'}))];
    const request=canonical({mode,prompt:'A scene',settings:{durationSec:5},references});
    const body=buildPaidVideoRequestBody({request,engine:KLING_V4_ENGINE,quoteId:'offline',canonicalPricing:{membershipTier:'member'}});
    const inputs=body.inputs as Array<{slotId:string;url:string}>;
    assert.deepEqual(inputs.filter(input=>input.slotId==='image_urls').map(input=>input.url),['https://media.example/z.png','https://media.example/a.png']);
  }
});
