import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPublicKeyframeDemo } from '../frontend/lib/public-keyframe-demo';
import { buildVideoSettingsSnapshotFromSharedVideo } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-shared-video-snapshot';
import { buildVideoSettingsFormState, resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildFlux3MaxFalRequest } from '../frontend/src/lib/flux-3-max';
import { loadModelKeyframeDemo } from '../frontend/server/model-keyframe-demo';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from '../frontend/server/videos-normalization';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildModelKeyframeDemoViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-keyframe-demo';
import { ModelKeyframeDemoSection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelKeyframeDemoSection';

const images = ['https://cdn.maxvideoai.com/references/z.png', 'https://cdn.maxvideoai.com/references/a.png'];
const selection = { modelSlug: 'flux-3-max', jobId: 'job_max_keyframes', referenceImages: images };
const video: GalleryVideo = {
  id: selection.jobId, userId: 'private-owner', engineId: 'flux-3-max', engineLabel: 'FLUX 3 Max', durationSec: 20,
  prompt: 'A courier catches the last train.', promptExcerpt: 'A courier catches the last train.',
  videoUrl: 'https://cdn.maxvideoai.com/renders/max.mp4', thumbUrl: 'https://cdn.maxvideoai.com/renders/max.jpg',
  createdAt: '2026-10-20T12:00:00Z', visibility: 'public', indexable: true, hasAudio: false, canUpscale: false,
  settingsSnapshot: {
    schemaVersion: 1, surface: 'video', engineId: 'flux-3-max', inputMode: 'ref2v', prompt: 'A courier catches the last train.',
    core: { durationSec: 20, resolution: '1080p', aspectRatio: '2:1', audio: false },
    advanced: { seed: 42, extraInputValues: { keyframe_indexes: '480,0', reasoning_level: 'low' } },
    refs: { referenceImages: images }, meta: { memberTier: 'Pro', privateNote: 'never project' },
  },
};

test('unselected or incomplete keyframe demos stay absent without loading a job', async () => {
  let reads = 0;
  assert.equal(await loadModelKeyframeDemo('flux-3-max', { selections: [], readVideo: async () => { reads++; return video; } }), null);
  assert.equal(reads, 0);
  for (const patch of [
    { engineId: 'flux-3' }, { visibility: 'private' as const }, { indexable: false }, { videoUrl: undefined },
    { thumbUrl: undefined }, { settingsSnapshot: null }, { prompt: 'Different prompt' },
  ]) assert.equal(projectPublicKeyframeDemo({ ...video, ...patch }, selection), null);
  assert.equal(projectPublicKeyframeDemo(video, { ...selection, referenceImages: [...images].reverse() }), null);
});

test('reviewed Max keyframe demo retains exact source identity, full prompt and authored order', () => {
  const demo = projectPublicKeyframeDemo(video, selection);
  assert.ok(demo);
  assert.equal(demo.recipe.jobId, video.id);
  assert.equal(demo.recipe.prompt, video.prompt);
  assert.deepEqual(demo.recipe.keyframes, [ { imageUrl: images[0], frameIndex: 480 }, { imageUrl: images[1], frameIndex: 0 } ]);
  assert.equal(demo.recipe.audio, false);
  assert.equal(demo.recipe.seed, 42);
  assert.equal(demo.recipe.reasoningLevel, 'low');
  assert.doesNotMatch(JSON.stringify(demo), /private-owner|memberTier|privateNote/);
});

test('gallery and keyframe replay retain requested duration independently of the inclusive final video frame', () => {
  const row: VideoRow = {
    job_id: selection.jobId, user_id: null, engine_id: 'flux-3-max', engine_label: 'FLUX 3 Max',
    duration_sec: 16, prompt: video.prompt, thumb_url: video.thumbUrl!, video_url: video.videoUrl!,
    preview_video_url: null, keyframe_urls: null, aspect_ratio: '16:9', output_width: 1280, output_height: 704,
    requested_resolution: '720p', has_audio: true, can_upscale: false, created_at: video.createdAt,
    visibility: 'public', indexable: true, featured: false, featured_order: null, final_price_cents: null, currency: null,
    settings_snapshot: {
      schemaVersion: 1, surface: 'video', engineId: 'flux-3-max', inputMode: 'ref2v', prompt: video.prompt,
      origin: 'external_fal_import', core: { durationSec: 16, resolution: '720p', aspectRatio: '16:9', audio: true },
      advanced: { seed: null, extraInputValues: { keyframe_indexes: '0,384', reasoning_level: 'high' } },
      refs: { referenceImages: images },
    },
  };
  // The import owner stores the measured 16 + 1/24 seconds separately in job_outputs media facts.
  const gallery = mapGalleryVideoRow(row);
  const demo = projectPublicKeyframeDemo(gallery, selection);
  assert.ok(demo);
  assert.equal(gallery.durationSec, 16);
  assert.equal(gallery.finalPriceCents, undefined);
  assert.equal(demo.recipe.durationSec, 16);
  assert.equal(demo.recipe.keyframes[1].frameIndex, 384);
  const replay = buildVideoSettingsSnapshotFromSharedVideo({ ...gallery, keyframeRecipe: demo.recipe });
  assert.equal(replay?.core.durationSec, 16);
  for (const incorrectRequestedDuration of [16 + 1 / 24, 17]) {
    assert.equal(projectPublicKeyframeDemo(mapGalleryVideoRow({ ...row, duration_sec: incorrectRequestedDuration }), selection), null);
  }
});

test('keyframe demo rejects expired links, missing images and invalid time positions', () => {
  for (const patch of [
    { referenceImages: [images[0]] },
    { referenceImages: [`${images[0]}?X-Amz-Signature=secret`, images[1]] },
  ]) {
    const snapshot = video.settingsSnapshot as Record<string, unknown>;
    assert.equal(projectPublicKeyframeDemo({ ...video, settingsSnapshot: { ...snapshot, refs: patch } }, { ...selection, referenceImages: patch.referenceImages }), null);
  }
  for (const keyframe_indexes of ['0,481', '0,0', '0,0.5']) {
    assert.equal(projectPublicKeyframeDemo({ ...video, settingsSnapshot: { ...(video.settingsSnapshot as object),
      advanced: { seed: 42, extraInputValues: { keyframe_indexes, reasoning_level: 'low' } } } }, selection), null);
  }
});

test('public example handoff restores all images and exact positions through the real workspace parser', () => {
  const demo = projectPublicKeyframeDemo(video, selection)!;
  const snapshot = buildVideoSettingsSnapshotFromSharedVideo({ ...video, keyframeRecipe: demo.recipe });
  const engine = getFalEngineById('flux-3-max')!.engine;
  const restored = resolveVideoSettingsSnapshot(snapshot, { engines: [engine], engineMap: new Map([[engine.id, engine]]),
    createLocalId: prefix => prefix, createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [] }) });
  assert.ok(restored);
  assert.equal(restored.mode, 'ref2v');
  assert.equal(restored.prompt, video.prompt);
  assert.deepEqual(restored.inputAssets?.reference_image_urls?.map(asset => asset?.url), images);
  assert.equal(restored.formValues.extraInputValues.keyframe_indexes, '480,0');
  const request = buildFlux3MaxFalRequest({ engineId: engine.id, mode: restored.mode, prompt: restored.prompt,
    durationSec: restored.formValues.durationSec, aspectRatio: restored.formValues.aspectRatio,
    resolution: restored.formValues.resolution, audio: restored.formValues.audio, seed: restored.formValues.seed ?? undefined,
    extraInputValues: restored.formValues.extraInputValues,
    referenceImages: restored.inputAssets!.reference_image_urls.map(asset => asset!.url!) });
  assert.deepEqual(request.requestBody.keyframes, [{ image_url: images[0], frame_index: 480 }, { image_url: images[1], frame_index: 0 }]);
  assert.equal(request.requestBody.generate_audio, false);
  assert.equal(request.requestBody.reasoning_level, 'low');
});

test('keyframe replay preserves seed zero and rejects seeds the workspace cannot edit', () => {
  const withSeed = (seed: number): GalleryVideo => ({ ...video, settingsSnapshot: {
    ...(video.settingsSnapshot as object), advanced: { seed, extraInputValues: { keyframe_indexes: '480,0', reasoning_level: 'low' } },
  } });
  const engine = getFalEngineById('flux-3-max')!.engine;
  for (const seed of [0, 2147483647]) {
    const source = withSeed(seed);
    const demo = projectPublicKeyframeDemo(source, selection)!;
    assert.equal(demo.recipe.seed, seed);
    const snapshot = buildVideoSettingsSnapshotFromSharedVideo({ ...source, keyframeRecipe: demo.recipe });
    const restored = resolveVideoSettingsSnapshot(snapshot, { engines: [engine], engineMap: new Map([[engine.id, engine]]),
      createLocalId: prefix => prefix, createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
      createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [] }) });
    assert.equal(restored?.formValues.seed, seed);
    const request = buildFlux3MaxFalRequest({ engineId: engine.id, mode: 'ref2v', prompt: restored!.prompt,
      durationSec: restored!.formValues.durationSec, seed: restored!.formValues.seed ?? undefined,
      extraInputValues: restored!.formValues.extraInputValues,
      referenceImages: restored!.inputAssets!.reference_image_urls.map(asset => asset!.url!) });
    assert.equal(request.requestBody.seed, seed);
  }
  for (const seed of [-1, 2147483648]) assert.equal(projectPublicKeyframeDemo(withSeed(seed), selection), null);
});

test('localized teaching block shows original references, time positions, manual film and true prompt', () => {
  Object.assign(globalThis, { React });
  for (const locale of ['en', 'fr', 'es'] as const) {
    const document = JSON.parse(readFileSync(`content/models/${locale}/flux-3-max.json`, 'utf8'));
    const content = parseModelExamplesContent(document.examples, 'flux-3-max', locale);
    const copy = content.keyframeDemo!;
    assert.equal(buildModelKeyframeDemoViewModel(null, copy, locale, true), null);
    const viewModel = buildModelKeyframeDemoViewModel(projectPublicKeyframeDemo(video, selection), copy, locale, true)!;
    assert.deepEqual(viewModel.images.map(image => image.frameIndex), [480, 0]);
    assert.deepEqual(viewModel.timeline.map(image => image.frameIndex), [0, 480]);
    assert.equal(viewModel.images[0].seconds, 20);
    const markup = renderToStaticMarkup(createElement(ModelKeyframeDemoSection, { viewModel }));
    assert.ok(markup.includes(copy.title));
    assert.ok(markup.includes(video.prompt));
    assert.match(markup, /preload="none"/);
    assert.doesNotMatch(markup, /autoPlay|autoplay/);
    assert.match(markup, /frame-480/);
    assert.match(markup, /from=job_max_keyframes/);
    assert.ok(markup.includes(copy.limitation));
    const unavailable = buildModelKeyframeDemoViewModel(projectPublicKeyframeDemo(video, selection), copy, locale, false)!;
    assert.equal(unavailable.recreateHref, null);
  }
});

test('selected reference captions stay localized, ordered and outside the replay recipe', () => {
  const referenceCaptions = [
    { en: 'Closed door in the snow', fr: 'Porte fermée dans la neige', es: 'Puerta cerrada en la nieve' },
    { en: 'The door opens onto spring', fr: 'La porte s’ouvre sur le printemps', es: 'La puerta se abre a la primavera' },
  ];
  const demo = projectPublicKeyframeDemo(video, { ...selection, referenceCaptions });
  assert.ok(demo);
  assert.deepEqual(demo.referenceCaptions, referenceCaptions);
  assert.doesNotMatch(JSON.stringify(demo.recipe), /Closed door|Porte fermée/);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/flux-3-max.json`, 'utf8'));
    const copy = parseModelExamplesContent(content.examples, 'flux-3-max', locale).keyframeDemo;
    const viewModel = buildModelKeyframeDemoViewModel(demo, copy, locale, true)!;
    assert.equal(viewModel.images[0].caption, referenceCaptions[0][locale]);
    assert.equal(viewModel.timeline[0].caption, referenceCaptions[1][locale], 'Timeline sorting must keep captions bound to their image.');
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const html = renderToStaticMarkup(createElement(ModelKeyframeDemoSection, { viewModel }));
    assert.ok(html.includes(referenceCaptions[0][locale]));
    assert.ok(html.includes(`alt="${referenceCaptions[0][locale]}"`));
  }
  assert.equal(projectPublicKeyframeDemo(video, { ...selection, referenceCaptions: referenceCaptions.slice(0, 1) }), null);
  assert.equal(projectPublicKeyframeDemo(video, { ...selection, referenceCaptions: [referenceCaptions[0], { ...referenceCaptions[1], fr: ' ' }] }), null);
});


test('the authored Max teaching selection loads only film 10 with all three ordered captions', async () => {
  const manifest = JSON.parse(readFileSync('frontend/config/model-keyframe-demos.json', 'utf8'));
  const selected = manifest.demos.find((item: { modelSlug: string }) => item.modelSlug === 'flux-3-max');
  assert.equal(selected.jobId, 'job_external_fal_894f66d3e579164505f1d132faa830ca39d9cd9a');
  assert.equal(selected.referenceImages.length, 3);
  assert.deepEqual(selected.referenceCaptions.map((caption: { en: string }) => caption.en), [
    'Closed door in the snow', 'The door opens onto spring', 'The keeper enters the garden',
  ]);
  const snapshot = video.settingsSnapshot as { core: Record<string, unknown> };
  const source = { ...video, id: selected.jobId, durationSec: 16, settingsSnapshot: {
    ...video.settingsSnapshot as object,
    core: { ...snapshot.core, durationSec: 16 },
    advanced: { seed: 0, extraInputValues: { keyframe_indexes: '0,192,384', reasoning_level: 'high' } },
    refs: { referenceImages: selected.referenceImages },
  } };
  const requested: string[] = [];
  const result = await loadModelKeyframeDemo('flux-3-max', { readVideo: async id => { requested.push(id); return source; } });
  assert.deepEqual(requested, [selected.jobId]);
  assert.deepEqual(result?.recipe.keyframes.map(frame => frame.frameIndex), [0, 192, 384]);
  assert.deepEqual(result?.recipe.keyframes.map(frame => frame.imageUrl), selected.referenceImages);
  assert.deepEqual(result?.referenceCaptions, selected.referenceCaptions);
  assert.equal(result?.recipe.seed, 0);
  assert.ok(result);
  const engine = getFalEngineById('flux-3-max')!.engine;
  const replaySnapshot = buildVideoSettingsSnapshotFromSharedVideo({ ...source, keyframeRecipe: result.recipe });
  const restored = resolveVideoSettingsSnapshot(replaySnapshot, { engines: [engine], engineMap: new Map([[engine.id, engine]]),
    createLocalId: prefix => prefix, createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [] }) });
  assert.ok(restored?.inputAssets);
  const form = buildVideoSettingsFormState(restored, null);
  const before = structuredClone(restored.inputAssets);
  const preflight = buildWorkspacePreflightRequest({ form, selectedEngine: engine, submissionMode: restored.mode,
    effectiveDurationSec: 16, supportsAudioToggle: true, voiceControlEnabled: false,
    inputAssets: restored.inputAssets, memberTier: 'Member' });
  assert.equal(parsePreflightRequestPayload(JSON.parse(JSON.stringify(preflight))).ok, true);
  assert.deepEqual(preflight.inputs, []);
  assert.deepEqual(restored.inputAssets, before, 'Pricing must not remove restored images from generation.');
  const priced = await resolveMediaAwarePreflight({ request: preflight }, {
    getConfiguredEngineFn: async () => engine,
    processAttachmentsFn: async () => { throw new Error('Max quotation must not resolve reference media.'); },
    computeConfiguredPreflightFn: async request => {
      const quote = await computeCanonicalBillingSnapshot({ engine, mode: request.mode, durationSec: request.durationSec,
        resolution: request.resolution, aspectRatio: request.aspectRatio, addons: { audio: request.audio } }, {
        loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1, versionedCells: [], databaseCells: [{
          id: 'reviewed-max-16s', selector: { engineId: 'flux-3-max', mode: 'ref2v', durationSec: '16', resolution: '1080p' },
          currency: 'USD', price: { kind: 'fixed', customerCents: 604 }, source: 'database', version: 1, effectiveFrom: '2026-10-20T00:00:00Z',
        }] }),
        pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) },
      });
      return { ok: true, total: quote.totalCents, currency: quote.currency, pricing: quote };
    },
  });
  assert.equal(priced.ok, true, JSON.stringify(priced));
  assert.equal(priced.total, 604);
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: restored.mode, uiLocale: 'en',
    allowsUnifiedVeoFirstLast: false, isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false });
  const prepared = prepareGenerationInputs({ selectedEngineId: engine.id, selectedEngineLabel: engine.label,
    activeMode: restored.mode, submissionMode: restored.mode, form, inputSchema: engine.inputSchema,
    inputSchemaSummary: summary, extraInputFields: [...summary.secondaryFields, ...summary.promotedFields],
    inputAssets: restored.inputAssets, primaryAssetFieldIds: new Set(), referenceAssetFieldIds: new Set(['reference_image_urls']),
    genericImageFieldIds: new Set(['reference_image_urls']), frameAssetFieldIds: new Set(), referenceAudioFieldIds: new Set(),
    supportsKlingV3Controls: false, klingElements: [], multiPromptActive: false, multiPromptScenes: [] });
  assert.ok(prepared.ok);
  const generation = buildFlux3MaxFalRequest({ engineId: engine.id, mode: restored.mode, prompt: restored.prompt,
    durationSec: form.durationSec, durationOption: form.durationOption, resolution: form.resolution, aspectRatio: form.aspectRatio,
    audio: form.audio, seed: form.seed ?? undefined, inputs: prepared.inputsPayload,
    referenceImages: prepared.referenceImageUrls, extraInputValues: prepared.extraInputValues });
  assert.deepEqual(generation.requestBody.keyframes, selected.referenceImages.map((image_url: string, index: number) =>
    ({ image_url, frame_index: [0, 192, 384][index] })));
});
