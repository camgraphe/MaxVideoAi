import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';

function getEntry(id: string) {
  const entry = listFalEngines().find((candidate) => candidate.id === id);
  assert.ok(entry, `${id} should be registered`);
  return entry;
}

test('Nano Banana Lite exposes only the Vertex Google Lite image options', () => {
  const entry = getEntry('nano-banana-lite');

  assert.equal(entry.modelSlug, 'nano-banana-lite');
  assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_image');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-3.1-flash-lite-image');
  assert.deepEqual(entry.engine.modes, ['t2i', 'i2i']);
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, ['1k']);
  assert.deepEqual(entry.modes[0]?.ui.resolution, ['1k']);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'enable_web_search'), undefined);
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls')?.maxCount, 14);
  assert.doesNotMatch(entry.defaultFalModelId, /fal-ai/i);
});

test('Nano Banana 2 routes through Vertex with Flash-specific options', () => {
  const entry = getEntry('nano-banana-2');

  assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_image');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-3.1-flash-image');
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, [
    '0.5k',
    '1k',
    '2k',
    '4k',
  ]);
  assert.ok(entry.engine.inputSchema?.optional?.find((field) => field.id === 'enable_web_search'));
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls')?.maxCount, 14);
  assert.doesNotMatch(entry.modes[0]?.falModelId ?? '', /fal-ai/i);
  assert.doesNotMatch(entry.modes[1]?.falModelId ?? '', /fal-ai/i);
});

test('Nano Banana Pro routes through Vertex with Pro-only options', () => {
  const entry = getEntry('nano-banana-pro');

  assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_image');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-3-pro-image');
  assert.deepEqual(entry.engine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, [
    '1k',
    '2k',
    '4k',
  ]);
  assert.ok(entry.engine.inputSchema?.optional?.find((field) => field.id === 'enable_web_search'));
  assert.equal(entry.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls')?.maxCount, 14);
  assert.doesNotMatch(entry.defaultFalModelId, /fal-ai/i);
});
