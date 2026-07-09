import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';

function getSeedreamEntry() {
  const entry = listFalEngines().find((candidate) => candidate.id === 'seedream');
  assert.ok(entry, 'seedream should be registered');
  return entry;
}

function getSeedreamProEntry() {
  const entry = listFalEngines().find((candidate) => candidate.id === 'seedream-5-0-pro');
  assert.ok(entry, 'seedream-5-0-pro should be registered');
  return entry;
}

test('Seedream 5.0 Lite is registered as a public ByteDance image model', () => {
  const entry = getSeedreamEntry();

  assert.equal(entry.modelSlug, 'seedream');
  assert.equal(entry.marketingName, 'Seedream');
  assert.equal(entry.provider, 'ByteDance');
  assert.equal(entry.brandId, 'bytedance');
  assert.equal(entry.family, 'seedream');
  assert.equal(entry.type, 'image');
  assert.equal(entry.category, 'image');
  assert.deepEqual(entry.engine.modes, ['t2i', 'i2i']);
  assert.equal(entry.engine.providerMeta?.provider, 'byteplus_modelark');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'seedream-5-0-260128');
  assert.ok(entry.engine.resolutions.includes('4K'));
  assert.ok(entry.engine.resolutions.includes('6240x2656'));
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'aspect_ratio')?.values, [
    'auto',
    '1:1',
    '4:3',
    '3:4',
    '16:9',
    '9:16',
    '3:2',
    '2:3',
    '21:9',
  ]);
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, [
    '2K',
    '3K',
    '4K',
  ]);
  assert.deepEqual(
    entry.modes[0]?.ui.aspectRatio,
    entry.engine.inputSchema?.optional?.find((field) => field.id === 'aspect_ratio')?.values
  );
  assert.equal(entry.engine.inputLimits.imageMaxMB, 10);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'num_images')?.max, 15);
  assert.match(
    entry.engine.inputSchema?.optional?.find((field) => field.id === 'num_images')?.description ?? '',
    /sequential(?:_image_generation| image generation)/i
  );
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls')?.maxCount, 10);
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'output_format')?.values, [
    'jpeg',
    'png',
  ]);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'watermark')?.type, 'boolean');
  assert.equal(entry.surfaces.app.enabled, true);
  assert.equal(entry.surfaces.modelPage.indexable, true);
  assert.equal(entry.surfaces.modelPage.includeInSitemap, true);
  assert.equal(entry.surfaces.compare.includeInHub, false);
});

test('Seedream copy links to Seedance without unsafe acceptance claims', () => {
  const entry = getSeedreamEntry();
  const searchable = [
    entry.seo.title,
    entry.seo.description,
    entry.seoText,
    entry.prompts.map((prompt) => `${prompt.title} ${prompt.prompt} ${prompt.notes ?? ''}`).join(' '),
    entry.faqs?.map((faq) => `${faq.question} ${faq.answer}`).join(' ') ?? '',
  ].join(' ');

  assert.match(searchable, /Seedance 2\.0/);
  assert.match(searchable, /reference image/i);
  assert.doesNotMatch(searchable, /guaranteed compatibility|review-free|bypass|always accepted|no moderation/i);
});

test('Seedream 5.0 Pro is registered with direct BytePlus Pro-only options', () => {
  const entry = getSeedreamProEntry();

  assert.equal(entry.modelSlug, 'seedream-5-0-pro');
  assert.equal(entry.marketingName, 'Seedream 5.0 Pro');
  assert.equal(entry.provider, 'ByteDance');
  assert.equal(entry.brandId, 'bytedance');
  assert.equal(entry.family, 'seedream');
  assert.equal(entry.type, 'image');
  assert.equal(entry.category, 'image');
  assert.deepEqual(entry.engine.modes, ['t2i', 'i2i']);
  assert.equal(entry.engine.providerMeta?.provider, 'byteplus_modelark');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'seedream-5-0-pro-260628');
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, [
    '2K',
    '4K',
  ]);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'num_images')?.max, 1);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls')?.maxCount, 10);
  assert.equal(entry.surfaces.app.enabled, true);
  assert.equal(entry.surfaces.modelPage.indexable, true);
  assert.equal(entry.surfaces.compare.includeInHub, false);
});
