import test from 'node:test';
import assert from 'node:assert/strict';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listNano21EditorialImages, nano21EditorialImageSchema } from '../frontend/lib/nano21-editorial-images';
import { createHash } from 'node:crypto';

test('Nano21 hero is a real durable image, without borrowing a video or another model', () => {
  const media=getFalEngineById('nano-banana-2-1')!.media;
  assert.match(media?.imagePath ?? '', /^https:\/\/media\.maxvideoai\.com\/marketing-media\/nano21-[a-f0-9]+\/[a-f0-9]{64}\.webp$/);
  assert.match(media?.videoUrl ?? '',/\.png$/);
});

test('all fourteen public images retain native identity, exact originals and display lineage',()=>{
  const images=listNano21EditorialImages('nano-banana-2-1');
  assert.equal(images.length,14);
  assert.equal(images[0].id,'nano21-fashion-identity');
  assert.equal(images[1].id,'nano21-storm-world');
  assert.equal(images.filter(image=>image.role==='hero').length,1);
  for(const image of images){
    assert.equal(image.providerModelId,'gemini-nano-banana-2.1');
    assert.equal(image.original.width,1376);assert.equal(image.original.height,768);
    assert.equal(createHash('sha256').update(image.prompt).digest('hex'),image.provenance.promptSha256);
    assert.equal(image.variants.length,3);
    assert.ok(image.variants.every(file=>file.sourceSha256===image.original.sha256));
    assert.equal('jobId' in image,false,'external trial images must not invent app jobs');
  }
  assert.deepEqual(listNano21EditorialImages('nano-banana-2'),[]);
});

test('public editorial validation refuses signed URLs and a derivative from another image',()=>{
  const source=listNano21EditorialImages('nano-banana-2-1')[0];
  const signed=structuredClone(source);signed.original.url+='?signature=private';
  assert.equal(nano21EditorialImageSchema.safeParse(signed).success,false);
  const wrong=structuredClone(source);wrong.display.sourceSha256='0'.repeat(64);
  assert.equal(nano21EditorialImageSchema.safeParse(wrong).success,false);
});
