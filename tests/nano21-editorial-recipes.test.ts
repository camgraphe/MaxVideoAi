import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listBuildOnlyPrivateFalEngines } from '../scripts/lib/private-engine-catalog-projection';
import { nano21EditorialFixture } from './helpers/nano21-editorial-fixture';
import { buildNano21EditorialSnapshot, getPublicNano21EditorialRecipe, listPublicNano21EditorialRecipes,
  resolveNano21EditorialRecipe } from '../frontend/lib/nano21-editorial-recipes';
import { projectNano21EditorialPageMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';
import { prepareImagePickerOption } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker';
import { parsePersistedImageComposerState } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-persistence';

test('only one accepted exact Nano21 t2i recipe can resolve; drafts, conflicting shapes and private fields fail closed', () => {
  const recipe = nano21EditorialFixture();
  const resolve = (record: unknown) => resolveNano21EditorialRecipe(recipe.id, [record], true);
  assert.equal(resolve(recipe).prompt, recipe.prompt);
  for (const record of [
    { ...recipe, status: 'draft' }, { ...recipe, engineId: 'nano-banana-2' }, { ...recipe, mode: 'i2i' },
    { ...recipe, settings: { ...recipe.settings, maxOutputTokens: 8192 } },
    ...[undefined, null, '32768'].map(maxOutputTokens => ({ ...recipe, settings: { ...recipe.settings, maxOutputTokens } })),
    { ...recipe, settings: { ...recipe.settings, systemInstruction: 'hidden' } },
    { ...recipe, references: ['https://example.com/ref.png'] }, { ...recipe, ownerId: 'private-user' },
    { ...recipe, jobId: 'fake-job' }, { ...recipe, providerResponse: { secret: 'private' } },
    { ...recipe, provenance: { ...recipe.provenance, responseSha256: '' } },
    { ...recipe, media: { ...recipe.media, display: { ...recipe.media.display, sourceSha256: '0'.repeat(64) } } },
    { ...recipe, media: { ...recipe.media, display: { ...recipe.media.display, url: 'https://media.maxvideoai.com/a.png?token=private' } } },
  ]) assert.throws(() => resolve(record), /accepted supported/);
  assert.throws(() => resolveNano21EditorialRecipe(recipe.id, [recipe], false), /unavailable/);
  assert.throws(() => resolveNano21EditorialRecipe(recipe.id, [], true), /unavailable/);
  assert.throws(() => resolveNano21EditorialRecipe(recipe.id, [recipe, recipe], true), /unavailable/);
  assert.throws(() => resolveNano21EditorialRecipe('{"prompt":"arbitrary"}', [recipe], true), /Invalid/);
  assert.deepEqual(listPublicNano21EditorialRecipes(), []);
  assert.throws(() => getPublicNano21EditorialRecipe(recipe.id), /unavailable/);
  const entry = listBuildOnlyPrivateFalEngines().find(row => row.id === recipe.engineId)!;
  assert.equal(entry.media, undefined, 'no placeholder or historical Nano2 media');
});

for (const explicitCap of [4096, 32768] as const) test(`an authored ${explicitCap} production recipe projects its exact settings and ID handoff without a job, price or video`, () => {
  const recipe = nano21EditorialFixture(explicitCap);
  assert.equal(resolveNano21EditorialRecipe(recipe.id, [recipe], true).settings.maxOutputTokens, explicitCap);
  const { hero, example } = projectNano21EditorialPageMedia(recipe);
  assert.deepEqual([hero.posterUrl, hero.prompt, hero.videoUrl, hero.href],
    [recipe.media.display.url, recipe.prompt, null, '/app/image?recipe=nano21-synthetic-fixture']);
  assert.deepEqual([example.promptFull, example.recreateHref, example.priceLabel, example.videoUrl],
    [recipe.prompt, '/app/image?recipe=nano21-synthetic-fixture', null, null]);
  const snapshot = buildNano21EditorialSnapshot(recipe);
  assert.deepEqual(snapshot, { schemaVersion: 1, surface: 'image', engineId: 'nano-banana-2-1', inputMode: 't2i', prompt: recipe.prompt,
    core: { numImages: 1, resolution: '1k', aspectRatio: '16:9', thinkingLevel: 'medium', maxOutputTokens: explicitCap, enableWebSearch: false },
    refs: { imageUrls: [], characterReferences: [] } });
  assert.doesNotMatch(JSON.stringify({ hero, example, snapshot }), /ownerId|providerResponse|billing|jobId|responseSha256/);
});

test('target-normalized picker estimates and stored composer preserve 4096 only for Nano21', () => {
  const engine = listBuildOnlyPrivateFalEngines().find(row => row.id === 'nano-banana-2-1')!.engine;
  const current = { mode: 't2i' as const, numImages: 1, resolution: '1k', aspectRatio: '16:9', quality: null, thinkingLevel: 'medium', maxOutputTokens: 4096,
    enableWebSearch: false, customImageWidth: '', customImageHeight: '', referenceImageCount: 0, selectedReferenceCount: 0, readyReferenceSizes: [] };
  const request = prepareImagePickerOption(engine, current, 'en').request;
  assert.equal(request.maxOutputTokens, 4096);
  assert.notEqual(JSON.stringify(request), JSON.stringify(prepareImagePickerOption(engine, { ...current, maxOutputTokens: 32768 }, 'en').request));
  const oldNano = getFalEngineById('nano-banana-2')!;
  const old = prepareImagePickerOption(oldNano.engine, current, 'en');
  assert.equal(old.settings.maxOutputTokens, null);
  assert.equal(Object.hasOwn(old.request, 'maxOutputTokens'), false);
  const state = { version: 5, engineId: engine.id, mode: 't2i', referenceSlots: [], maxOutputTokens: 4096 };
  assert.equal(parsePersistedImageComposerState(JSON.stringify(state))?.maxOutputTokens, 4096);
  assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...state, maxOutputTokens: -1 })), null);
  assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...state, maxOutputTokens: undefined }))?.maxOutputTokens, 32768);
  assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...state, engineId: 'nano-banana-2' }))?.maxOutputTokens, null);
});
