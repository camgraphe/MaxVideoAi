import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesGalleryData } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data';
import type { GalleryVideo } from '../frontend/server/videos';

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

test('LTX family guidance retains an explicit answer for LTX 2.3 alongside the current generation in every locale', async () => {
  const { getExampleModelLanding } = await import('../frontend/lib/examples/modelLanding');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'ltx');
    assert.ok(landing);
    assert.ok(landing.faqItems.some(item => /LTX 2\.3/.test(item.question) && /LTX 2\.3/.test(item.answer)), `${locale}: missing historical prompt answer`);
    assert.ok(landing.faqItems.some(item => /LTX 2\.5/.test(item.question)), `${locale}: current guidance must remain`);
  }
});
