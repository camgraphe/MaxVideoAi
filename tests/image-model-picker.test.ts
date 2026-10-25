import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { prepareImagePickerOption } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker';

const engine = listFalEngines().find(entry => entry.id === 'nano-banana-2')!.engine;
const current = { mode: 't2i' as const, numImages: 1, resolution: '2k', aspectRatio: '1:1', quality: null, enableWebSearch: false,
  customImageWidth: '', customImageHeight: '', referenceImageCount: 0, selectedReferenceCount: 0, readyReferenceSizes: [] };
test('image candidate quotes exact supported values without mutating the current settings', () => {
  const before = structuredClone(current);
  const option = prepareImagePickerOption(engine, current, 'fr');
  assert.equal(option.disabledReason, undefined);
  assert.equal(option.request.engineId, 'nano-banana-2');
  assert.equal(option.request.resolution, '2k');
  assert.equal(option.request.aspectRatio, '1:1');
  assert.deepEqual(current, before);
});
test('image candidate does not discard excess references or switch operations', () => {
  assert.ok(prepareImagePickerOption(engine, { ...current, maskUrl: 'https://example.com/mask.png' }, 'fr').disabledReason);
  assert.ok(prepareImagePickerOption({ ...engine, modes: ['t2i'] }, { ...current, mode: 'i2i' }, 'fr').disabledReason);
  assert.ok(prepareImagePickerOption(engine, { ...current, referenceImageCount: 100, selectedReferenceCount: 100 }, 'fr').disabledReason);
  assert.ok(prepareImagePickerOption(engine, { ...current, selectedReferenceCount: 1 }, 'fr').disabledReason);
});
test('unsupported image resolution is disclosed before applying its canonical fallback', () => {
  const option = prepareImagePickerOption(engine, { ...current, resolution: 'not-a-resolution' }, 'fr');
  assert.notEqual(option.request.resolution, 'not-a-resolution');
  assert.ok(option.changes.some(change => change.before === 'not-a-resolution' && change.after === option.request.resolution));
});

test('image advanced setting resets are disclosed before applying the same normalized values', () => {
  const option = prepareImagePickerOption(engine, { ...current, outputFormat: 'not-a-format', style: 'not-a-style', background: 'not-a-background',
    thinkingLevel: 'not-a-level', seed: '42.5', limitGenerations: true, watermark: true }, 'fr');
  assert.ok(option.changes.some(change => change.before === 'not-a-format'));
  assert.ok(option.changes.some(change => change.before === 'not-a-style'));
  assert.notEqual(option.settings.outputFormat, 'not-a-format');
  assert.notEqual(option.settings.style, 'not-a-style');
});

test('sparse reference slots cannot be truncated by a lower-capacity target', () => {
  const limited = structuredClone(engine);
  for (const field of [...(limited.inputSchema?.required ?? []), ...(limited.inputSchema?.optional ?? [])]) {
    if (field.id === 'image_urls') field.maxCount = 4;
  }
  const option = prepareImagePickerOption(limited, { ...current, mode: 'i2i', referenceImageCount: 2, selectedReferenceCount: 2, referenceIndices: [0, 5] }, 'fr');
  assert.ok(option.disabledReason);
});
