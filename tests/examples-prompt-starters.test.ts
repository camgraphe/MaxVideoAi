import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesPromptStarters } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';
import { buildExamplesGalleryData } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data';
import type { GalleryVideo } from '../frontend/server/videos';

const video = (id: string, engineIconId: string, engineLabel: string) => ({
  id, engineIconId, engineLabel, href: `/video/${id}`, prompt: 'Exact public excerpt…', promptFull: 'Full prompt stays in the reader',
  durationSec: 10, aspectRatio: '16:9', hasAudio: true, priceLabel: '$9.99',
});

test('Wan and MiniMax expose real version prompts from the registry without mixing families or inventing missing examples', () => {
  for (const [family, ids] of [
    ['wan', ['wan-3-prime', 'wan-3']],
    ['hailuo', ['minimax-h3-max', 'minimax-h3']],
    ['kling', ['kling-o3-pro', 'kling-3-pro']],
  ] as const) {
    const page = [video('unrelated', 'seedance-2-5', 'Seedance 2.5'), ...ids.map(id => video(id, id, id)), video('duplicate', ids[0], ids[0])];
    const sources = page.map(item => ({ id: item.id, promptExcerpt: item.prompt }));
    const selected = buildExamplesPromptStarters(family, page, sources);
    assert.equal(selected.length, 2, family);
    assert.deepEqual(new Set(selected.map(item => item.engineLabel)), new Set(ids));
    assert.ok(selected.every(item => item.href !== '/video/unrelated' && item.href !== '/video/duplicate'));
    assert.deepEqual(buildExamplesPromptStarters(family, page, []), []);
  }
});

test('gallery summaries retain a bounded original public prompt in every locale without replacing full reader content', () => {
  const source = { id: 'wan-source', engineId: 'wan-3', engineLabel: 'Wan 3', durationSec: 10,
    prompt: 'The complete original public prompt stays in the reader. ' + 'More scene direction. '.repeat(50),
    promptExcerpt: 'A runner crosses the stream while the camera tracks left.', hasAudio: true } as GalleryVideo;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const card = buildExamplesGalleryData({ allVideos: [source], locale, selectedEngine: 'wan' }).clientVideos[0];
    assert.equal(card.sourcePromptExcerpt, 'A runner crosses the stream while the camera tracks left.');
    assert.equal(card.id, 'wan-source');
    assert.equal(source.prompt.split(' ').length > 100, true);
    const missing = buildExamplesGalleryData({ allVideos: [{ ...source, prompt: '', promptExcerpt: '' }], locale, selectedEngine: 'wan' }).clientVideos[0];
    assert.equal(missing.sourcePromptExcerpt, null, 'missing prompts must not be fabricated from a model caption');
    const long = buildExamplesGalleryData({ allVideos: [{ ...source, promptExcerpt: '', prompt: 'public '.repeat(1000) }], locale, selectedEngine: 'wan' }).clientVideos[0];
    assert.equal(long.sourcePromptExcerpt?.split(' ').length, 18);
  }
});

test('family prompt shortcuts reuse distinct versions from the current SSR page', () => {
  const page = [video('new', 'ltx-2-5-fast', 'LTX 2.5 Fast'), video('old', 'ltx-2-3', 'LTX 2.3 Pro'), video('other', 'seedance-2-5', 'Seedance 2.5')];
  const sources = page.map(item => ({ id: item.id, promptExcerpt: item.prompt }));
  const selected = buildExamplesPromptStarters('ltx', page, sources);
  assert.deepEqual(selected.map(item => item.engineLabel), ['LTX 2.5 Fast', 'LTX 2.3 Pro']);
  assert.equal(selected[1].prompt, page[1].prompt);
  assert.equal(selected[1].href, page[1].href);
  assert.equal(selected[1].durationSec, page[1].durationSec);
  assert.equal(selected[1].aspectRatio, page[1].aspectRatio);
  assert.ok(selected.every(item => !('promptFull' in item) && !('priceLabel' in item)), 'no duplicated full prompts or unrelated new-generation prices');
  assert.deepEqual(buildExamplesPromptStarters('ltx', [], sources), []);
  assert.deepEqual(buildExamplesPromptStarters('wan', page, sources), []);
  assert.deepEqual(buildExamplesPromptStarters('seedance', page, sources).map(item => item.href), ['/video/other']);
});

test('localized gallery captions cannot replace the actual public prompt in a shortcut', () => {
  const card = { ...video('new', 'ltx-2-5-fast', 'LTX 2.5 Fast'), prompt: 'Exemple LTX 2.5 Fast · 10 s · 16:9' };
  const source = { id: card.id, prompt: 'A single continuous action shot with soft daylight and a steady camera.', promptExcerpt: '' };
  const [starter] = buildExamplesPromptStarters('ltx', [card], [source]);
  assert.equal(starter.prompt, source.prompt);
  assert.notEqual(starter.prompt, card.prompt);
  assert.deepEqual(buildExamplesPromptStarters('ltx', [card], [{ ...source, prompt: '' }]), [], 'do not invent a prompt for missing source text');
  const [long] = buildExamplesPromptStarters('ltx', [card], [{ ...source, prompt: 'public '.repeat(1000) }]);
  assert.equal(long.prompt.split(' ').length, 18, 'full source text remains outside the shortcut');
});

test('LTX family guidance retains an explicit answer for LTX 2.3 alongside the current generation in every locale', async () => {
  const { getExampleModelLanding } = await import('../frontend/lib/examples/modelLanding');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'ltx');
    assert.ok(landing);
    assert.ok(landing.faqItems.some(item => /LTX 2\.3/.test(item.question) && /LTX 2\.3/.test(item.answer)), `${locale}: missing historical prompt answer`);
    assert.ok(landing.faqItems.some(item => /LTX 2\.5/.test(item.question)), `${locale}: current guidance must remain`);
  }
});
