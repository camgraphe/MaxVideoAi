import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {MODEL_LAUNCH_WAVES} from '../frontend/config/model-launch-waves';
import {PREFERRED_MEDIA} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media';
import {requiresPinnedModelPromptingDemo} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-prompt-source';
import {validateModelLaunchWaveDocument} from '../frontend/server/model-launch-assets-validation';
import {toFeaturedMedia} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';
import {parseModelPromptingContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import {buildModelPromptingViewModel} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model';

test('Flash preserves the selected hero and detailed prompt as separate real outputs',()=>{
 const wave=MODEL_LAUNCH_WAVES.find(wave=>String(wave.id)==='kling-v4-flash');
 assert.ok(wave,'Flash has its own accepted-media wave');
 const pack=JSON.parse(readFileSync(wave.sourceManifest,'utf8'));
 assert.equal(validateModelLaunchWaveDocument(wave.id,pack).ok,true);
 assert.deepEqual(PREFERRED_MEDIA['kling-v4-flash'],{
  hero:'job_external_fal_6712f839e8fdd81095934387795fdac464ae58ac',
  demo:'job_external_fal_d7520a41bbe895c4a4647a559218c446429d5989',
 });
 assert.equal(requiresPinnedModelPromptingDemo('kling-v4-flash'),true);
 const demo=pack.assets.find((asset:any)=>asset.videoId===PREFERRED_MEDIA['kling-v4-flash'].demo);
 assert.ok(demo);
 for(const locale of ['en','fr','es'] as const){
  const content=JSON.parse(readFileSync(`content/models/${locale}/kling-v4-flash.json`,'utf8'));
  assert.equal(content.prompting.demo.prompt,demo.prompt);
  assert.equal(content.prompting.tabs[0].copy,demo.prompt);
  assert.equal(content.prompting.tabs[0].matchPublicExample,true);
  const media=toFeaturedMedia({id:demo.videoId,href:`/app?job=${demo.videoId}`,engineLabel:'Kling 4.0 Flash',engineIconId:'kling-v4-flash',
   priceLabel:null,prompt:'A short gallery excerpt.',promptFull:demo.prompt,aspectRatio:'16:9',durationSec:15,hasAudio:true,videoUrl:demo.videoUrl},true);
  const view=buildModelPromptingViewModel({content:parseModelPromptingContent(content.prompting,'kling-v4-flash',locale),locale,
   engineId:'kling-v4-flash',modelSlug:'kling-v4-flash',appGenerationEnabled:true,imageAnchorId:'prompting',isVideoEngine:true,isImageEngine:false,
   supportsNativeAudio:true,demoPromptSource:'media',defaultDemoPromptSource:'media',demoMedia:media,
   defaultDemoPresentation:{audioBadgeLabel:'',altContext:''},referenceWorkflows:[]});
  assert.equal(view.demo?.prompt,demo.prompt,'Detailed demonstrations preserve the complete structured film prompt');
  assert.equal(view.demo?.title,content.prompting.demo.title,'The selected film keeps its localized editorial title');
  assert.doesNotMatch(JSON.stringify(content),/selection pending|sélection des médias en cours|selección de medios pendiente/i);
 }
 const wrongMode=structuredClone(pack);wrongMode.assets[0].mode='v2v';
 assert.equal(validateModelLaunchWaveDocument(wave.id,wrongMode).ok,false,'Flash cannot borrow V4 Modify evidence');
 const noPreview=structuredClone(pack);delete noPreview.assets[0].previewVideoUrl;
 assert.equal(validateModelLaunchWaveDocument(wave.id,noPreview).ok,false);
});
