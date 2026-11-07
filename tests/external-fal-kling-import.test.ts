import assert from 'node:assert/strict';
import test from 'node:test';
import { externalFalImportPlan, parseExternalFalImport } from '../frontend/server/external-fal-import/contract';
import { klingV4ImportSettings, parseKlingV4ExternalFalImport } from '../frontend/server/external-fal-import/kling-v4';
import { resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { getWorkspaceKlingV4ActiveAssets } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-kling-v4-media';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';

export function klingImportFixture() {
  return { schemaVersion: 1, ownerUserId: '11111111-1111-4111-8111-111111111111', engineId: 'kling-v4', mode: 't2v',
    endpoint: 'kling/v4/text-to-video', providerRequestId: '01a15b12-7619-7060-8be6-f69e46ed0cf1',
    providerInput: { prompt: 'An original complete film.', duration: 5, resolution: '1080p', aspect_ratio: '16:9' },
    videoAssetId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoSha256: 'a'.repeat(64), evidenceSha256: 'b'.repeat(64), references: [],
    media: { poster: { url: 'https://media.maxvideoai.com/poster.webp', sha256: 'c'.repeat(64) },
      preview: { url: 'https://media.maxvideoai.com/preview.mp4', sha256: 'd'.repeat(64) } } };
}
const reference = (slotId: string, kind = 'image', index = 1) => ({ slotId, kind, providerUrl: `https://fal.media/${index}.${kind === 'image' ? 'png' : 'mp4'}`,
  assetId: 'ma_' + String(index).repeat(32), sha256: String(index).repeat(64) });

test('Kling import explicitly binds engine, mode, immutable request and all media roles without FLUX controls', () => {
  const input = klingImportFixture();
  const parsed = parseExternalFalImport(input);
  assert.equal(parsed.engineId, 'kling-v4');
  assert.deepEqual(parsed.providerInput, input.providerInput);
  const plan = externalFalImportPlan(input);
  assert.equal(plan.financialWrites, 0); assert.equal(plan.visibility, 'private'); assert.equal(plan.indexable, false);
  assert.notEqual(plan.manifestSha256, externalFalImportPlan({ ...input, providerInput: { ...input.providerInput, prompt: 'Changed' } }).manifestSha256);
  for (const changed of [
    { engineId: 'flux-3-max' }, { endpoint: 'kling/v3/text-to-video' }, { media: undefined },
    { providerInput: { ...input.providerInput, duration: 5.5 } },
    { providerInput: { ...input.providerInput, reasoning_level: 'high' } },
    { providerInput: { ...input.providerInput, generate_audio: true } },
    { providerInput: { ...input.providerInput, fps: 24 } },
    { media: { ...input.media, preview: input.media.poster } },
    { media: { ...input.media, poster: { ...input.media.poster, url: 'https://example.com/poster.webp' } } },
  ]) assert.throws(() => parseExternalFalImport({ ...input, ...changed }));
});

test('Kling four-mode references preserve exact field identity, original order and kind', () => {
  const base = klingImportFixture();
  const { aspect_ratio: _aspect, ...common } = base.providerInput;
  const start = reference('start_image_url'); const end = reference('end_image_url', 'image', 2);
  assert.equal(parseExternalFalImport({ ...base, mode: 'i2v', endpoint: 'kling/v4/image-to-video',
    providerInput: { ...common, start_image_url: start.providerUrl, end_image_url: end.providerUrl }, references: [start, end] }).mode, 'i2v');
  const video = reference('video_urls.0', 'video', 3); const element = reference('elements.0.video_url', 'video', 4);
  const refs = [start, video, element];
  const refInput = { ...base, mode: 'ref2v', endpoint: 'kling/v4/reference-to-video', references: refs,
    providerInput: { ...base.providerInput, start_image_url: start.providerUrl, video_urls: [video.providerUrl], elements: [{ video_url: element.providerUrl }] } };
  assert.equal(parseExternalFalImport(refInput).references.length, 3);
  assert.throws(() => parseExternalFalImport({ ...refInput, references: [...refs].reverse() }), /REFERENCE/);
  assert.throws(() => parseExternalFalImport({ ...refInput, references: [start, { ...video, kind: 'image' }, element] }), /REFERENCE/);
  assert.throws(() => parseExternalFalImport({ ...refInput, providerInput: { ...refInput.providerInput, elements: [{ video_url: element.providerUrl, voice_id: 'unowned' }] } }), /VOICE/);
  const source = reference('video_url', 'video');
  assert.equal(parseExternalFalImport({ ...base, mode: 'v2v', endpoint: 'kling/v4/video-to-video/edit',
    providerInput: { prompt: 'Edit the owned film.', video_url: source.providerUrl }, references: [source] }).mode, 'v2v');
});

test('Kling shot plans remain exact and require a matching whole-second total', () => {
  const base = klingImportFixture(); const { prompt: _prompt, ...settings } = base.providerInput;
  const input = { ...base, providerInput: { ...settings, multi_prompt: [{ prompt: 'First shot', duration: 2 }, { prompt: 'Last shot', duration: 3 }] } };
  assert.deepEqual(parseExternalFalImport(input).providerInput, input.providerInput);
  assert.throws(() => parseExternalFalImport({ ...input, providerInput: { ...input.providerInput, duration: 6 } }));
});

test('offline inventory lists exact roles and pending admin placements without claiming adoption or current curation', async () => {
  const { externalFalImportInventory } = await import('../frontend/server/external-fal-import/inventory');
  const inventory = externalFalImportInventory(klingImportFixture());
  assert.equal(inventory.verified, false);
  assert.equal(inventory.externalWrites, 0);
  assert.equal(inventory.currentCuration, null);
  assert.deepEqual(inventory.media.map(role => role.role), ['original', 'poster', 'short-preview']);
  assert.deepEqual(inventory.placements.map(placement => placement.destination), ['examples-kling-v4', 'family-kling', 'selected-video-seo']);
  assert.ok(inventory.placements.every(placement => placement.status === 'pending-review'));
});

test('An imported opening frame survives workspace recreation in both image and reference generation', () => {
  for (const mode of ['i2v', 'ref2v'] as const) {
    const start = reference('start_image_url');
    const input = parseKlingV4ExternalFalImport({ ...klingImportFixture(), mode,
      endpoint: mode === 'i2v' ? 'kling/v4/image-to-video' : 'kling/v4/reference-to-video',
      providerInput: { prompt: 'An owned opening frame.', duration: 5, start_image_url: start.providerUrl }, references: [start] });
    const settings = klingV4ImportSettings(input, [{ public_id: start.assetId, url: 'https://media.maxvideoai.com/original.png', mime_type: 'image/png', size_bytes: 1024 }]);
    const restored = resolveVideoSettingsSnapshot({ schemaVersion: 1, surface: 'video', engineId: 'kling-v4', inputMode: mode, ...settings },
      { engines: [KLING_V4_ENGINE], engineMap: new Map([['kling-v4', KLING_V4_ENGINE]]), createLocalId: p => p,
        createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
        createFallbackKlingElement: () => ({ id: 'subject', frontal: null, references: [null, null, null], video: null }) });
    const active = getWorkspaceKlingV4ActiveAssets(mode, restored.inputAssets ?? {});
    assert.equal(active.image_url?.[0]?.assetId, start.assetId);
    assert.equal(active.image_url?.[0]?.url, 'https://media.maxvideoai.com/original.png');
    assert.equal(input.references[0].slotId, 'start_image_url');
  }
});

test('External generation defaults are validated and replayed without altering the accepted journal input', () => {
  const raw = { prompt: 'A complete film.' };
  const parsed = parseKlingV4ExternalFalImport({ ...klingImportFixture(), providerInput: raw });
  assert.deepEqual(parsed.providerInput, raw);
  const settings = klingV4ImportSettings(parsed, []);
  assert.equal(settings.core.durationSec, 5);
  assert.equal(settings.core.durationOption, '5');
  assert.equal(settings.core.resolution, '1080p');
  assert.equal(settings.core.aspectRatio, '16:9');
  assert.throws(() => parseKlingV4ExternalFalImport({ ...klingImportFixture(), providerInput: { multi_prompt: [{ prompt: 'Shot', duration: 6 }] } }), /durations/);
});

test('Documented nullable optionals and default shot durations preserve journal bytes and effective replay', () => {
  const raw = { prompt: null, multi_prompt: [{ prompt: 'A film.' }], duration: 5 };
  const parsed = parseKlingV4ExternalFalImport({ ...klingImportFixture(), providerInput: raw });
  assert.deepEqual(parsed.providerInput, raw);
  assert.deepEqual(klingV4ImportSettings(parsed, []).advanced.multiPrompt, [{ prompt: 'A film.', duration: 5 }]);
  const promptOnly = parseKlingV4ExternalFalImport({ ...klingImportFixture(), providerInput: { prompt: 'A film.', multi_prompt: null } });
  assert.equal(klingV4ImportSettings(promptOnly, []).advanced.multiPrompt, null);
  for (const invalid of [{ prompt: 'Film', resolution: null }, { prompt: 'Film', duration: null },
    { prompt: 'Film', start_image_url: null }, { multi_prompt: [{ prompt: 'Film', duration: null }] },
    { prompt: 'Film', multi_prompt: [{ prompt: 'Also a film.' }] }]) {
    assert.throws(() => parseKlingV4ExternalFalImport({ ...klingImportFixture(), providerInput: invalid }));
  }
});

test('Flash creation import keeps its exact controls and 720p defaults without inheriting V4 controls', async () => {
  const { externalFalImportInventory } = await import('../frontend/server/external-fal-import/inventory');
  const base = { ...klingImportFixture(), engineId: 'kling-v4-flash', endpoint: 'kling/v4/flash/text-to-video',
    providerInput: { prompt: 'A character speaks. Hard cut to a second character answering.' } };
  const parsed = parseExternalFalImport(base);
  assert.equal(parsed.engineId, 'kling-v4-flash');
  assert.deepEqual(parsed.providerInput, base.providerInput);
  const inventory = externalFalImportInventory(base);
  assert.equal(inventory.placements[0].destination, 'examples-kling-v4-flash');
  assert.equal(inventory.placements[0].path, '/models/kling-v4-flash');
  assert.equal(inventory.financialWrites, 0);
  if (parsed.engineId === 'flux-3-max') throw new Error('Unexpected FLUX contract');
  const settings = klingV4ImportSettings(parsed, []);
  assert.equal(settings.core.resolution, '720p');
  assert.equal(settings.core.durationSec, 5);
  assert.equal(settings.advanced.multiPrompt, null);
  for (const change of [
    { engineId: 'kling-v4' }, { mode: 'v2v' }, { endpoint: 'kling/v4/text-to-video' },
    ...[{ resolution: '1080p' }, { duration: 21 }, { duration: 2 }, { generate_audio: true },
      { multi_prompt: [{ prompt: 'Shot', duration: 5 }] }, { end_image_url: 'https://fal.media/end.png' }]
      .map(extra => ({ providerInput: { ...base.providerInput, ...extra } })),
  ]) assert.throws(() => parseExternalFalImport({ ...base, ...change }));

  const start = reference('start_image_url');
  const i2v = parseExternalFalImport({ ...base, mode: 'i2v', endpoint: 'kling/v4/flash/image-to-video',
    providerInput: { start_image_url: start.providerUrl }, references: [start] });
  assert.equal(i2v.mode, 'i2v');
  assert.throws(() => parseExternalFalImport({ ...i2v, providerInput: { ...i2v.providerInput, aspect_ratio: '1:1' } }));
  const video = reference('video_urls.0', 'video', 2);
  const refs = [start, video];
  const ref2v = { ...base, mode: 'ref2v', endpoint: 'kling/v4/flash/reference-to-video',
    providerInput: { prompt: 'Continue the scene.', start_image_url: start.providerUrl, video_urls: [video.providerUrl] }, references: refs };
  assert.equal(parseExternalFalImport(ref2v).references.length, 2);
  assert.throws(() => parseExternalFalImport({ ...ref2v, references: [...refs].reverse() }), /REFERENCE/);
});

test('Flash Modify imports preserve source and extra-reference slots separately for owned replay', () => {
  const source = reference('video_url', 'video', 1);
  const image = reference('image_urls.0', 'image', 2);
  const video = reference('video_urls.0', 'video', 3);
  const repeatedVideo = { ...video, slotId: 'video_urls.1' };
  const subject = reference('elements.0.video_url', 'video', 4);
  const references = [source, image, video, repeatedVideo, subject];
  const providerInput = { prompt: 'Edit the source using these references.', video_url: source.providerUrl,
    image_urls: [image.providerUrl], video_urls: [video.providerUrl, video.providerUrl],
    elements: [{ video_url: subject.providerUrl }] };
  const input = { ...klingImportFixture(), engineId: 'kling-v4-flash', mode: 'v2v',
    endpoint: 'kling/v4/flash/video-to-video', providerInput, references };
  const parsed = parseExternalFalImport(input);
  if (parsed.engineId !== 'kling-v4-flash') throw new Error('Unexpected import engine');
  const assets = [source, image, video, subject].map((ref, index) => ({ public_id: ref.assetId,
    url: `https://media.maxvideoai.com/owned-${index}.${ref.kind === 'image' ? 'png' : 'mp4'}`,
    mime_type: ref.kind === 'image' ? 'image/png' : 'video/mp4', size_bytes: 1024 }));
  const settings = klingV4ImportSettings(parsed, assets);

  assert.deepEqual(parsed.providerInput, providerInput);
  assert.equal(settings.core.durationSec, null);
  assert.equal(settings.core.durationOption, null);
  assert.equal(settings.core.resolution, '720p');
  assert.equal(settings.core.aspectRatio, null);
  assert.deepEqual(settings.refs.videoUrls, [assets[2].url, assets[2].url]);
  assert.deepEqual(settings.refs.inputs.map(({ slotId, assetId, url }) => ({ slotId, assetId, url })), [
    { slotId: 'video_url', assetId: source.assetId, url: assets[0].url },
    { slotId: 'image_urls', assetId: image.assetId, url: assets[1].url },
    { slotId: 'video_urls', assetId: video.assetId, url: assets[2].url },
    { slotId: 'video_urls', assetId: video.assetId, url: assets[2].url },
  ]);
  assert.deepEqual(settings.refs.elements, [{ videoUrl: assets[3].url, videoAssetId: subject.assetId }]);
  assert.equal(externalFalImportPlan(input).financialWrites, 0);
  assert.throws(() => parseExternalFalImport({ ...input, references: [...references].reverse() }), /REFERENCE_MAPPING/);
});

test('Flash Modify nullable optionals retain immutable provider input and source-duration replay', () => {
  const source = reference('video_url', 'video', 1);
  const subject = reference('elements.0.video_url', 'video', 2);
  const base = { ...klingImportFixture(), engineId: 'kling-v4-flash', mode: 'v2v', endpoint: 'kling/v4/flash/video-to-video' };
  const assets = [source, subject].map((ref, index) => ({ public_id: ref.assetId,
    url: `https://media.maxvideoai.com/owned-${index}.mp4`, mime_type: 'video/mp4', size_bytes: 1024 }));
  for (const elements of [null, [{ video_url: subject.providerUrl, frontal_image_url: null, reference_image_urls: null }]]) {
    const providerInput = { prompt: 'Edit this source.', video_url: source.providerUrl,
      duration: null, image_urls: null, video_urls: null, elements };
    const input = { ...base, providerInput, references: elements ? [source, subject] : [source] };
    const originalJson = JSON.stringify(input);
    const parsed = parseExternalFalImport(input);
    if (parsed.engineId !== 'kling-v4-flash') throw new Error('Unexpected import engine');
    const settings = klingV4ImportSettings(parsed, assets);
    assert.deepEqual(parsed.providerInput, providerInput);
    assert.equal(JSON.stringify(input), originalJson);
    assert.equal(settings.core.durationSec, null);
    assert.equal(settings.core.durationOption, null);
    assert.equal(settings.refs.videoUrls, null, 'The source must not be mirrored as an additional reference');
    assert.deepEqual(settings.refs.inputs.map((item) => item.slotId), ['video_url']);
    assert.equal(settings.refs.referenceImages, null);
    assert.deepEqual(settings.refs.elements, elements ? [{ videoUrl: assets[1].url, videoAssetId: subject.assetId }] : null);
    assert.notEqual(externalFalImportPlan(input).manifestSha256,
      externalFalImportPlan({ ...input, providerInput: { ...providerInput, duration: 5 } }).manifestSha256);
  }
  for (const providerInput of [
    { prompt: 'Edit this source.' },
    { prompt: 'Edit this source.', video_url: null },
    { prompt: null, video_url: source.providerUrl },
    { prompt: 'Edit this source.', video_url: source.providerUrl, duration: 4.5 },
    { prompt: 'Edit this source.', video_url: source.providerUrl, resolution: null },
    { prompt: 'Edit this source.', video_url: source.providerUrl, aspect_ratio: null },
    { prompt: 'Edit this source.', video_url: source.providerUrl, start_image_url: null },
  ]) assert.throws(() => parseExternalFalImport({ ...base, providerInput, references: [source] }));
  const opening = reference('start_image_url', 'image');
  for (const { mode, path, providerInput, references } of [
    { mode: 't2v', path: 'text-to-video', providerInput: { prompt: 'A film.' }, references: [] },
    { mode: 'i2v', path: 'image-to-video', providerInput: { start_image_url: opening.providerUrl }, references: [opening] },
    { mode: 'ref2v', path: 'reference-to-video', providerInput: { prompt: 'A film.', start_image_url: opening.providerUrl }, references: [opening] },
  ]) {
    const input = { ...base, mode, endpoint: `kling/v4/flash/${path}`, providerInput, references };
    assert.equal(parseExternalFalImport(input).mode, mode);
    assert.throws(() => parseExternalFalImport({ ...input, providerInput: { ...providerInput, duration: null } }));
  }
});

test('Flash Modify image subjects tolerate a documented null video field without changing their stored views', () => {
  const source = reference('video_url', 'video', 1);
  const frontal = reference('elements.0.frontal_image_url', 'image', 2);
  const view = reference('elements.0.reference_image_urls.0', 'image', 3);
  const references = [source, frontal, view];
  const providerInput = { prompt: 'Edit this source.', video_url: source.providerUrl,
    elements: [{ frontal_image_url: frontal.providerUrl, reference_image_urls: [view.providerUrl], video_url: null }] };
  const parsed = parseExternalFalImport({ ...klingImportFixture(), engineId: 'kling-v4-flash', mode: 'v2v',
    endpoint: 'kling/v4/flash/video-to-video', providerInput, references });
  if (parsed.engineId !== 'kling-v4-flash') throw new Error('Unexpected import engine');
  const assets = references.map((ref, index) => ({ public_id: ref.assetId,
    url: `https://media.maxvideoai.com/view-${index}.${ref.kind === 'video' ? 'mp4' : 'png'}`,
    mime_type: ref.kind === 'video' ? 'video/mp4' : 'image/png', size_bytes: 1024 }));
  assert.deepEqual(parsed.providerInput, providerInput);
  assert.deepEqual(klingV4ImportSettings(parsed, assets).refs.elements, [{
    frontalImageUrl: assets[1].url, frontalAssetId: frontal.assetId,
    referenceImageUrls: [assets[2].url], referenceAssetIds: [view.assetId],
  }]);
});
