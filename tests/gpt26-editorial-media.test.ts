import assert from 'node:assert/strict';
import test from 'node:test';
import {getRuntimeModelById} from '../frontend/config/model-runtime';
import {readFileSync} from 'node:fs';
import records from '../frontend/config/gpt26-editorial-images.json';
import {parseGpt26EditorialImages,listGpt26EditorialImages} from '../frontend/lib/gpt26-editorial-images';
import {toGpt26EditorialImages} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';

test('both 2.6 edits retain the same actual Flare source, never the Sunburst generation',()=>{
 const images=parseGpt26EditorialImages(records);
 assert.equal(images.length,4);
 const edits=images.filter(image=>image.settings.mode==='i2i');
 assert.equal(edits.length,2);
 assert.ok(edits.every(image=>image.sourceImageId==='gpt26-flare-generation'));
 for(const locale of ['en','fr','es'] as const){
  const titles=['flare','sunburst'].flatMap(variant=>JSON.parse(readFileSync(`content/models/${locale}/gpt-image-2-6-${variant}.json`,'utf8')).examples.editorialImages);
  const views=toGpt26EditorialImages(images,locale,titles);
  for(const edit of edits){
   const view=views.find(image=>image.id===edit.id)!;
   assert.equal(view.source?.original.sha256,images.find(image=>image.id===edit.sourceImageId)?.original.sha256);
   assert.match(view.source?.label??'',/Flare/);
   assert.equal(view.workspaceHref,`/app/image?engine=${edit.engineId}`);
   assert.doesNotMatch(view.metadataLabel,/Nano Banana/);
  }
 }
 for(const id of ['gpt-image-2-6-flare','gpt-image-2-6-sunburst']){
  assert.deepEqual(listGpt26EditorialImages(id),images.filter(image=>image.engineId===id));
  const model=getRuntimeModelById(id)!;
  const published=model.publication.model.published;
  try{model.publication.model.published=false;assert.deepEqual(listGpt26EditorialImages(id),[],'rollback hides editorial media');}
  finally{model.publication.model.published=published;}
 }
});

test('editorial validation rejects source drift, wrong model attribution and signed public URLs',()=>{
 const unknown=structuredClone(records);unknown[3].sourceImageId='missing';
 assert.throws(()=>parseGpt26EditorialImages(unknown));
 const wrongModel=structuredClone(records);wrongModel[3].providerModelId='gpt-image-2.6-flare';
 assert.throws(()=>parseGpt26EditorialImages(wrongModel));
 const signed=structuredClone(records);signed[0].original.url+='?token=private';
 assert.throws(()=>parseGpt26EditorialImages(signed));
 const drift=structuredClone(records);drift[0].display.sourceSha256='0'.repeat(64);
 assert.throws(()=>parseGpt26EditorialImages(drift));
});
