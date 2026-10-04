import assert from 'node:assert/strict';
import test from 'node:test';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/sdk/validation/ajv';
import type {JsonSchemaType} from '@modelcontextprotocol/sdk/validation';
import {STUDIO_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-action-contract';
import {STUDIO_MEDIA_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-media-contract';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';
import {studioToolReferenceProperties} from '../frontend/src/server/studio/conversation-tool-reference-schema';

const imageA = 'ma_0123456789abcdef0123456789abcdef';
const imageB = 'ma_fedcba9876543210fedcba9876543210';
const video = 'ma_' + '1'.repeat(32);
const audio = 'ma_' + '2'.repeat(32);
const foreign = 'ma_' + '3'.repeat(32);
function resolved(assetId: string, mediaKind: ResolvedReference['mediaKind'] = 'image'): ResolvedReference {
  return {assetId, mediaKind, role: 'reference', storageUrl: `https://cdn.example.com/${assetId}`,
    width: 1024, height: 1024, durationSec: mediaKind === 'image' ? null : 5,
    mimeType: mediaKind === 'image' ? 'image/png' : mediaKind === 'video' ? 'video/mp4' : 'audio/wav'};
}
const references = [resolved(imageB), resolved(video, 'video'), resolved(imageA), resolved(audio, 'audio'),
  {...resolved(imageB), role: 'first_frame' as const}];
const tools = [...STUDIO_DIRECTOR_TOOLS, ...STUDIO_MEDIA_DIRECTOR_TOOLS];
const scopedTools = tools.filter(tool => ['image_prepare', 'pricing_read'].includes(tool.name));
const videoTool = STUDIO_MEDIA_DIRECTOR_TOOLS.find(tool => tool.name === 'video_prepare')!;
const allScopedTools = [...scopedTools, videoTool];
type ReferenceProperties = {references: {items: {properties: {ref: {properties: {assetId: {enum?: readonly string[]}}}}}}};
type ReferenceBranch = {properties?: {type: {enum: readonly string[]}; assetId?: {enum?: readonly string[]}}};
type VideoReferenceProperties = {
  source: {anyOf: ReferenceBranch[]};
  references: {items: {properties: {ref: {anyOf: ReferenceBranch[]}}}};
};
function videoAssetBranches(properties: Readonly<Record<string, unknown>>) {
  const schema = properties as VideoReferenceProperties;
  return [schema.source, schema.references.items.properties.ref]
    .map(node => node.anyOf.find(branch => branch.properties?.type.enum.includes('asset'))!);
}
function enumIds(properties: Readonly<Record<string, unknown>>) {
  return (properties as ReferenceProperties).references.items.properties.ref.properties.assetId.enum;
}
function parameters(name: string, ids: string[]) {
  const selected = ids.map(assetId => ({ref: {type: 'asset', assetId, kind: 'image'}, role: 'reference', slot: null}));
  return name === 'image_prepare'
    ? {reply: 'Review the quote.', prompt: 'A quiet product image.', aspectRatio: '16:9', modelId: null,
      mode: null, settings: null, outputCount: 1, references: selected}
    : {surface: 'image', modelId: 'gpt-image-2', mode: 'i2i', settings: [], outputCount: 1, references: selected};
}
function compile(properties: Readonly<Record<string, unknown>>) {
  return new AjvJsonSchemaValidator().getValidator({type: 'object', additionalProperties: false,
    properties, required: Object.keys(properties)} as JsonSchemaType);
}
function videoParameters(source: unknown = null, selected: unknown[] = []) {
  return {...parameters('image_prepare', []), modelId: 'wan-3', mode: 'i2v', source, references: selected};
}
function asset(assetId: string) {
  return {type: 'asset', assetId, kind: 'image'};
}
function frame(ref: unknown) {
  return {ref, role: 'first_frame', slot: null};
}

for (const tool of scopedTools) {
  test(`${tool.name} accepts exact reviewed image IDs and rejects altered, foreign and non-image IDs`, () => {
    const scoped = studioToolReferenceProperties(tool.name, tool.properties, references);
    assert.deepEqual(enumIds(scoped), [imageB, imageA]);
    const expected = structuredClone(tool.properties) as ReferenceProperties;
    expected.references.items.properties.ref.properties.assetId.enum = [imageB, imageA];
    assert.deepEqual(scoped, expected, 'Only the saved image identity enum is enriched.');
    const validate = compile(scoped);
    for (const ids of [[imageA], [imageB], [imageB, imageA], []])
      assert.equal(validate(parameters(tool.name, ids)).valid, true, JSON.stringify(ids));
    for (const id of [foreign, video, audio, imageA.slice(0, -1) + 'e', imageA.slice(3), 'Image 1'])
      assert.equal(validate(parameters(tool.name, [id])).valid, false, id);
  });
}

test('context enrichment never mutates or freezes the shared original tool properties', () => {
  const before = structuredClone(tools);
  function freezeState(value: unknown): boolean[] {
    if (!value || typeof value !== 'object') return [];
    return [Object.isFrozen(value), ...Object.values(value).flatMap(freezeState)];
  }
  const frozenBefore = freezeState(tools);
  for (const tool of allScopedTools) studioToolReferenceProperties(tool.name, tool.properties, references);
  assert.deepEqual(tools, before);
  assert.deepEqual(freezeState(tools), frozenBefore);
  for (const tool of scopedTools) assert.equal(enumIds(tool.properties), undefined);
  for (const branch of videoAssetBranches(videoTool.properties)) assert.equal(branch.properties?.assetId?.enum, undefined);
});

test('enriched properties and their nested enum are detached and immutable', () => {
  const tool = scopedTools.find(tool => tool.name === 'image_prepare')!;
  const original = structuredClone(tool.properties);
  const current = [resolved(imageA)];
  const scoped = studioToolReferenceProperties(tool.name, original, current);
  assert.notEqual(scoped, original);
  function assertFrozen(value: unknown) {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) assertFrozen(child);
  }
  assertFrozen(scoped);
  current[0].assetId = foreign;
  current.push(resolved(imageB));
  original.prompt.type = 'number';
  assert.equal(scoped.prompt.type, 'string');
  assert.deepEqual(enumIds(scoped), [imageA]);
  assert.equal(Reflect.set(enumIds(scoped)!, 0, foreign), false);
});

test('the next context receives only its own reviewed identities, without earlier enum leakage', () => {
  for (const tool of scopedTools) {
    const first = studioToolReferenceProperties(tool.name, tool.properties, [resolved(imageA)]);
    const next = studioToolReferenceProperties(tool.name, tool.properties, [resolved(imageB)]);
    assert.deepEqual(enumIds(first), [imageA]);
    assert.deepEqual(enumIds(next), [imageB]);
    assert.equal(compile(next)(parameters(tool.name, [imageA])).valid, false);
  }
});

test('zero images retains the existing valid schema and never emits an empty enum', () => {
  for (const tool of scopedTools) {
    for (const current of [[], [resolved(video, 'video'), resolved(audio, 'audio')]]) {
      const scoped = studioToolReferenceProperties(tool.name, tool.properties, current);
      assert.equal(scoped, tool.properties);
      assert.equal(enumIds(scoped), undefined);
      assert.equal(compile(scoped)(parameters(tool.name, [])).valid, true);
    }
  }
  for (const current of [[], [resolved(video, 'video'), resolved(audio, 'audio')]]) {
    const scoped = studioToolReferenceProperties(videoTool.name, videoTool.properties, current);
    assert.equal(scoped, videoTool.properties);
    for (const branch of videoAssetBranches(scoped)) assert.equal(branch.properties?.assetId?.enum, undefined);
    assert.equal(compile(scoped)(videoParameters()).valid, true);
  }
});

test('other tools retain the exact original properties', () => {
  for (const tool of tools.filter(tool => !['image_prepare', 'pricing_read', 'video_prepare'].includes(tool.name)))
    assert.equal(studioToolReferenceProperties(tool.name, tool.properties, references), tool.properties);
});

test('video asset source and reference branches accept only exact currently attached image IDs', () => {
  const scoped = studioToolReferenceProperties(videoTool.name, videoTool.properties, references);
  const validate = compile(scoped);
  for (const id of [imageA, imageB]) {
    assert.equal(validate(videoParameters(asset(id))).valid, true, 'Attached asset source');
    assert.equal(validate(videoParameters(null, [frame(asset(id))])).valid, true, 'Attached asset reference');
  }
  for (const id of [foreign, video, audio, imageA.slice(0, -1) + 'e', imageA.slice(3), 'Image 1']) {
    assert.equal(validate(videoParameters(asset(id))).valid, false, `Unattached source: ${id}`);
    assert.equal(validate(videoParameters(null, [frame(asset(id))])).valid, false, `Unattached reference: ${id}`);
  }
  const expected = structuredClone(videoTool.properties);
  for (const branch of videoAssetBranches(expected)) branch.properties!.assetId!.enum = [imageB, imageA];
  assert.deepEqual(scoped, expected, 'Only the two asset ID branches change.');
});

test('video ready-output branches remain intact and accept independent job and output identities', () => {
  const scoped = studioToolReferenceProperties(videoTool.name, videoTool.properties, [resolved(imageA)]);
  const original = videoTool.properties as unknown as VideoReferenceProperties;
  const schema = scoped as unknown as VideoReferenceProperties;
  for (const [actual, expected] of [[schema.source, original.source],
    [schema.references.items.properties.ref, original.references.items.properties.ref]]) {
    const jobBranch = actual.anyOf.find(branch => branch.properties?.type.enum.includes('job-output'));
    assert.deepEqual(jobBranch, expected.anyOf.find(branch => branch.properties?.type.enum.includes('job-output')));
    assert.doesNotMatch(JSON.stringify(jobBranch), /ma_0123456789abcdef0123456789abcdef/);
  }
  const validate = compile(scoped);
  for (const [jobId, outputId] of [['ready-job-a', 'ready-output-a'], ['ready-job-b', 'ready-output-b']]) {
    const output = {type: 'job-output', kind: 'image', jobId, outputId};
    assert.equal(validate(videoParameters(output)).valid, true);
    assert.equal(validate(videoParameters(null, [frame(output)])).valid, true);
  }
  assert.equal(validate(videoParameters()).valid, true, 'Null legacy source remains valid.');
});

test('video asset enums are immutable and do not retain images from an earlier context', () => {
  const first = studioToolReferenceProperties(videoTool.name, videoTool.properties, [resolved(imageA)]);
  const next = studioToolReferenceProperties(videoTool.name, videoTool.properties, [resolved(imageB)]);
  for (const branch of videoAssetBranches(first)) {
    assert.deepEqual(branch.properties?.assetId?.enum, [imageA]);
    assert.equal(Object.isFrozen(branch.properties?.assetId?.enum), true);
  }
  for (const branch of videoAssetBranches(next)) assert.deepEqual(branch.properties?.assetId?.enum, [imageB]);
  const validate = compile(next);
  assert.equal(validate(videoParameters(asset(imageA))).valid, false);
  assert.equal(validate(videoParameters(null, [frame(asset(imageA))])).valid, false);
  assert.equal(validate(videoParameters(asset(imageB))).valid, true);
  assert.equal(validate(videoParameters(null, [frame(asset(imageB))])).valid, true);
});
