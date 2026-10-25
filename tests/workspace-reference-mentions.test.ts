import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import { buildReferenceMentions, changedReferenceMentions, insertReferenceMention, selectedReferenceLabel } from '../frontend/components/composer/workspace-reference-mentions';
import { buildReferenceAssetFromLibraryAsset, buildComposerAttachments } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { ComposerAttachment, AssetFieldConfig } from '../frontend/components/composer/composer-types';
const engine = (id: string) => listFalEngines().find(item => item.id === id)!.engine;
const asset = (id: string): ComposerAttachment => ({ id, assetId: id, url: `https://owned.test/${id}.png`, previewUrl: `https://owned.test/${id}.png?access=private`, kind: 'image', name: `${id}.png`, size: 1, type: 'image/png', status: 'ready' });
const fields = (id: string, fieldId: string): AssetFieldConfig[] => {
  const model = engine(id);
  return [{ field: [...model.inputSchema!.required, ...model.inputSchema!.optional].find(field => field.id === fieldId)!, required: false, role: 'reference' }];
};

test('provider mentions compact sparse slots, deduplicate URLs and keep Grok zero-based', () => {
  const kling = fields('kling-o3-pro', 'image_urls');
  const references = buildReferenceMentions(engine('kling-o3-pro'), kling, { image_urls: [null, asset('a'), asset('a'), null, asset('b')] });
  assert.deepEqual(references.map(({ slotIndex, token }) => [slotIndex, token]), [[1, '@Image1'], [2, '@Image1'], [4, '@Image2']]);
  const grok = buildReferenceMentions(engine('grok-imagine-video-1-5'), fields('grok-imagine-video-1-5', 'reference_image_urls'), { reference_image_urls: [null, asset('a'), asset('b')] });
  assert.deepEqual(grok.map(item => item.token), ['<IMAGE_0>', '<IMAGE_1>']);
  const source = fields('kling-o3-pro', 'video_url');
  assert.equal(buildReferenceMentions(engine('kling-o3-pro'), source, { video_url: [{ ...asset('v'), kind: 'video' }] })[0].token, '@Video1');
});

test('ordered portraits, start frames and arbitrary labels never become invented prompt syntax', () => {
  const h3 = resolveVideoOperationEngine(engine('minimax-h3-max'), 'v2v', 'h3-recast');
  const portraits = h3.inputSchema!.required.find(field => field.id === 'reference_image_urls')!;
  assert.deepEqual(buildReferenceMentions(h3, [{ field: portraits, required: true }], { reference_image_urls: [asset('a')] }), []);
  assert.equal(selectedReferenceLabel(h3, portraits, 'image', 2, 'fr'), 'Portrait 2');
  assert.equal(selectedReferenceLabel(h3, h3.inputSchema!.required[0], 'video', 1, 'fr', true), 'Vidéo source');
  assert.deepEqual(buildReferenceMentions(engine('kling-o3-pro'), fields('kling-o3-pro', 'image_url'), { image_url: [asset('a')] }), []);
  assert.deepEqual(buildReferenceMentions(engine('kling-o3-pro'), [{ field: { id: 'custom', type: 'image', label: 'Portrait', slotLabelPattern: 'character{n}' }, required: false }], { custom: [asset('a')] }), []);
});

test('deletion, reordering and replacement require review without confusing Image1 and Image10', () => {
  const model = engine('kling-o3-pro'), field = fields(model.id, 'image_urls');
  const before = buildReferenceMentions(model, field, { image_urls: [asset('a'), asset('b')] });
  const removed = buildReferenceMentions(model, field, { image_urls: [null, asset('b')] });
  assert.deepEqual(changedReferenceMentions('Use @Image1, then @Image2.', before, removed), ['@Image1', '@Image2']);
  assert.deepEqual(changedReferenceMentions('Use @Image10 and an email@Image1suffix.', before, removed), []);
  assert.deepEqual(changedReferenceMentions('Use @Image1.', before, buildReferenceMentions(model, field, { image_urls: [asset('b'), asset('a')] })), ['@Image1']);
  assert.deepEqual(changedReferenceMentions('Use @Image1.', before, buildReferenceMentions(model, field, { image_urls: [{ ...asset('a'), previewUrl: 'https://owned.test/new-signed-preview' }, asset('b')] })), []);
});

test('mention insertion preserves the surrounding prompt and returns the new caret', () => {
  assert.deepEqual(insertReferenceMention('Keep this visible.', '@Image2', 5, 9), { text: 'Keep @Image2 visible.', caret: 12 });
  assert.deepEqual(insertReferenceMention('Scene.', '<IMAGE_0>', 0, 0), { text: '<IMAGE_0> Scene.', caret: 10 });
  assert.deepEqual(insertReferenceMention('', '@Video1'), { text: '@Video1 ', caret: 8 });
});

test('Kling aliases and native references retain the same association as submitted provider tokens', () => {
  const model = engine('kling-o3-pro');
  const field = [...fields(model.id, 'image_urls'), ...fields(model.id, 'video_url')];
  const before = buildReferenceMentions(model, field, { image_urls: [asset('a')], video_url: [{ ...asset('v'), kind: 'video' }] });
  const replaced = buildReferenceMentions(model, field, { image_urls: [asset('b')], video_url: [{ ...asset('new-video'), kind: 'video' }] });
  for (const spelling of ['@Image1', '@image1', '@Image_1', '@image_1', '<<<image_1>>>'])
    assert.deepEqual(changedReferenceMentions(`Use ${spelling}.`, before, replaced), ['@Image1'], spelling);
  for (const spelling of ['@Video1', '@video1', '@Video_1', '@video_1', '<<<video_1>>>'])
    assert.deepEqual(changedReferenceMentions(`Use ${spelling}.`, before, replaced), ['@Video1'], spelling);
  assert.deepEqual(changedReferenceMentions('Use @image10, @Image_10, <<<image_10>>>, @video10 and email@image1suffix.', before, replaced), []);
  const wan = engine('wan-2-6'), wanFields = fields(wan.id, 'video_urls');
  const wanBefore = buildReferenceMentions(wan, wanFields, { video_urls: [{ ...asset('v'), kind: 'video' }] });
  assert.deepEqual(changedReferenceMentions('Use @video_1 and <<<video_1>>>.', wanBefore, []), [], 'Kling-only normalization never invents aliases for another provider');
  assert.deepEqual(changedReferenceMentions('Use @Video1.', wanBefore, []), ['@Video1']);
});

test('selected library posters stay display-only through the composer projection', () => {
  const field = { id: 'video_url', type: 'video' as const, label: 'Source video' };
  const source = { id: 'source', url: 'https://owned.test/original.mp4', kind: 'video' as const, previewUrl: 'https://owned.test/short-preview.mp4', thumbUrl: 'https://owned.test/poster.jpg', thumbnailAccessUrl: 'https://owned.test/poster.jpg?grant=private', accessUrl: 'https://owned.test/original.mp4?grant=private' };
  const selected = buildReferenceAssetFromLibraryAsset(field, source);
  const attachment = buildComposerAttachments({ video_url: [selected] }).video_url[0]!;
  assert.equal(attachment.url, source.url);
  assert.equal(attachment.previewUrl, source.previewUrl);
  assert.equal(attachment.thumbnailUrl, source.thumbnailAccessUrl);
});
