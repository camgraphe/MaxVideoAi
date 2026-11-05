import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {MODEL_LAUNCH_WAVES} from '../frontend/config/model-launch-waves';
import {PREFERRED_MEDIA} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media';
import {requiresPinnedModelPromptingDemo} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-prompt-source';
import {validateModelLaunchWaveDocument} from '../frontend/server/model-launch-assets-validation';

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
 for(const locale of ['en','fr','es']){
  const content=JSON.parse(readFileSync(`content/models/${locale}/kling-v4-flash.json`,'utf8'));
  assert.equal(content.prompting.demo.prompt,demo.prompt);
  assert.equal(content.prompting.tabs[0].copy,demo.prompt);
  assert.equal(content.prompting.tabs[0].matchPublicExample,true);
  assert.doesNotMatch(JSON.stringify(content),/selection pending|sélection des médias en cours|selección de medios pendiente/i);
 }
 const wrongMode=structuredClone(pack);wrongMode.assets[0].mode='v2v';
 assert.equal(validateModelLaunchWaveDocument(wave.id,wrongMode).ok,false,'Flash cannot borrow V4 Modify evidence');
 const noPreview=structuredClone(pack);delete noPreview.assets[0].previewVideoUrl;
 assert.equal(validateModelLaunchWaveDocument(wave.id,noPreview).ok,false);
});
