import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import records from '../frontend/config/seedream-editorial-images.json';
import {listSeedreamEditorialImages,parseSeedreamEditorialImages} from '../frontend/lib/seedream-editorial-images';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {listModelEditorialImages} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';

const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');

test('Seedream editorial media preserves the exact original, prompt and display lineage',()=>{
 const images=parseSeedreamEditorialImages(records);
 assert.ok(images.length>=2);
 for(const image of images){
  assert.equal(hash(image.prompt),image.provenance.promptSha256);
  for(const file of [image.original,image.display]){
   const bytes=readFileSync(path.join('frontend/public',file.url));
   assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
  }
  assert.equal(image.display.sourceSha256,image.original.sha256);
  assert.equal(image.settings.mode,'t2i');
 }
});

test('Seedream media cannot misattribute a sibling model or publish mutable/private file paths',()=>{
 const mutate=(change:(item:any)=>void)=>{const copy=structuredClone(records);change(copy[0]);return copy;};
 assert.throws(()=>parseSeedreamEditorialImages(mutate(item=>{item.providerModelId='dola-seedream-5-5-261028';})));
 assert.throws(()=>parseSeedreamEditorialImages(mutate(item=>{item.display.sourceSha256='a'.repeat(64);})));
 assert.throws(()=>parseSeedreamEditorialImages(mutate(item=>{item.original.url='/private/signed.jpg?token=secret';})));
 assert.throws(()=>parseSeedreamEditorialImages(mutate(item=>{delete item.providerModelId;})),'Direct provider outputs require the response model.');
 const mcp=structuredClone(records).find(image=>image.provenance.kind==='maxvideoai_mcp_generation');
 assert.ok(mcp,'The Pro example has a completed MCP receipt.');
 assert.throws(()=>parseSeedreamEditorialImages([{...mcp,providerModelId:'dola-seedream-5-0-pro-260628'}]),'Do not invent a raw provider response for MCP output.');
 assert.throws(()=>parseSeedreamEditorialImages([...records,records[0]]));
 assert.deepEqual(listSeedreamEditorialImages('private-user-model'),[]);
});

test('Seedream heroes and localized galleries use only accepted outputs from the selected model',()=>{
 for(const engineId of [...new Set(records.map(image=>image.engineId))]){
  const images=listSeedreamEditorialImages(engineId);
  const hero=images.find(image=>image.role==='hero');assert.ok(hero);
  const engine=getFalEngineById(engineId);assert.equal(engine?.media?.imagePath,hero.display.url);
  for(const locale of ['en','fr','es'] as const){
   const content=JSON.parse(readFileSync(`content/models/${locale}/${engineId}.json`,'utf8'));
   const titles=content.examples.editorialImages;
   const gallery=listModelEditorialImages(engineId,locale,titles);
   assert.equal(gallery.length,images.length);
   for(const image of gallery){assert.equal(image.engineId,engineId);assert.ok(image.metadataLabel.includes('2K'));assert.equal(image.prompt,images.find(source=>source.id===image.id)?.prompt);}
  }
  assert.throws(()=>listModelEditorialImages(engineId,'fr',[]),'No English fallback for missing localized captions.');
 }
});
