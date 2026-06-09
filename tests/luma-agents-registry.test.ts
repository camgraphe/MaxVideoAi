import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines.ts';
import { LUMA_AGENTS_PROVIDER } from '../frontend/src/lib/luma-agents.ts';
import type { EngineInputField } from '../frontend/types/engines.ts';

const engines = listFalEngines();

function byId(id: string): FalEngineEntry {
  const entry = engines.find((engine) => engine.id === id);
  assert.ok(entry, `${id} should be registered`);
  return entry;
}

function field(entry: FalEngineEntry, fieldId: string): EngineInputField {
  const allFields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
  const match = allFields.find((candidate) => candidate.id === fieldId);
  assert.ok(match, `${entry.id} should expose ${fieldId}`);
  return match;
}

function optionalField(entry: FalEngineEntry, fieldId: string): EngineInputField | undefined {
  const allFields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
  return allFields.find((candidate) => candidate.id === fieldId);
}

test('Luma Agents entries are registered by id and model slug', () => {
  [
    ['luma-uni-1', 'luma-uni-1'],
    ['luma-uni-1-max', 'luma-uni-1-max'],
    ['luma-ray-3-2', 'luma-ray-3-2'],
  ].forEach(([id, slug]) => {
    const entry = byId(id);
    assert.equal(entry.modelSlug, slug);
  });
});

test('Luma Agents registry uses direct provider metadata with fal fallback model ids', () => {
  const expectedFalIdsByEngine = {
    'luma-uni-1': ['luma/agent/uni-1/v1/text-to-image', 'luma/agent/uni-1/v1/edit'],
    'luma-uni-1-max': ['luma/agent/uni-1/v1/max', 'luma/agent/uni-1/v1/max/edit'],
    'luma-ray-3-2': ['luma/agent/ray/v3.2/text-to-video', 'luma/agent/ray/v3.2/image-to-video'],
  } as const;

  Object.entries(expectedFalIdsByEngine).forEach(([id, falIds]) => {
    const entry = byId(id);
    assert.equal(entry.engine.providerMeta?.provider, LUMA_AGENTS_PROVIDER);
    assert.equal(entry.defaultFalModelId, falIds[0]);
    assert.deepEqual(
      entry.modes.map((mode) => mode.falModelId),
      [...falIds]
    );
  });
});

test('Luma Uni image entries expose fallback-safe text and edit contracts', () => {
  ['luma-uni-1', 'luma-uni-1-max'].forEach((id) => {
    const entry = byId(id);
    assert.equal(entry.category, 'image');
    assert.deepEqual(entry.engine.modes, ['t2i', 'i2i']);
    assert.equal(entry.surfaces.compare.includeInHub, false);
    assert.deepEqual(entry.surfaces.compare.publishedPairs, []);

    const imageUrls = field(entry, 'image_urls');
    assert.deepEqual(imageUrls.requiredInModes, ['i2i']);
    assert.equal(imageUrls.minCount, 1);
    assert.equal(imageUrls.maxCount, 9);
    assert.match(imageUrls.description ?? '', /source/i);
    assert.match(imageUrls.description ?? '', /reference/i);

    assert.deepEqual(entry.modes.map((mode) => mode.ui.resolutionLocked), [true, true]);
    assert.deepEqual(entry.modes.map((mode) => mode.ui.resolution), [['2K'], ['2K']]);
  });
});

test('Luma Uni exposes style, output, web search, and aspect ratio in the correct modes', () => {
  ['luma-uni-1', 'luma-uni-1-max'].forEach((id) => {
    const entry = byId(id);
    assert.deepEqual(field(entry, 'aspect_ratio').modes, ['t2i']);
    assert.deepEqual(field(entry, 'aspect_ratio').values, ['3:1', '2:1', '16:9', '3:2', '1:1', '2:3', '9:16', '1:2', '1:3']);
    assert.deepEqual(field(entry, 'style').values, ['auto', 'manga']);
    assert.deepEqual(field(entry, 'output_format').values, ['png', 'jpeg']);
    assert.deepEqual(field(entry, 'enable_web_search').modes, ['t2i']);
  });
});

test('Luma Ray 3.2 exposes only public fal fallback-safe video controls', () => {
  const entry = byId('luma-ray-3-2');
  assert.equal(entry.category, 'video');
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v']);
  assert.equal(entry.engine.extend, false);
  assert.equal(entry.engine.keyframes, false);
  assert.equal(entry.engine.motionControls, false);
  assert.equal(entry.engine.upscale4k, false);
  assert.equal(entry.engine.audio, false);
  assert.equal(entry.engine.maxDurationSec, 10);
  assert.equal(entry.surfaces.compare.includeInHub, true);
  assert.deepEqual(entry.surfaces.compare.publishedPairs, []);

  assert.deepEqual(field(entry, 'duration').values, ['5s', '10s']);
  assert.deepEqual(field(entry, 'resolution').values, ['540p', '720p', '1080p']);
  assert.deepEqual(field(entry, 'aspect_ratio').values, [
    '3:1',
    '2:1',
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '1:1',
    '3:4',
    '2:3',
    '9:16',
    '1:2',
    '1:3',
  ]);
  assert.deepEqual(field(entry, 'loop').modes, ['t2v', 'i2v']);
  assert.deepEqual(field(entry, 'reference_image_urls').modes, ['t2v', 'i2v']);
  assert.deepEqual(field(entry, 'image_url').requiredInModes, ['i2v']);

  assert.equal(optionalField(entry, 'end_image_url'), undefined);
  assert.equal(optionalField(entry, 'hdr'), undefined);
  assert.equal(optionalField(entry, 'exr'), undefined);
});
