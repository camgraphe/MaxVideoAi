import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesGalleryData } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data';
import type { GalleryVideo } from '../frontend/server/videos';
import { buildExamplesJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-jsonld';
import { buildExamplesVersionLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-version-links';
import { buildExampleVersionSamples } from '../frontend/server/videos-examples';
import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals/derive';

test('Omni examples, structured data and watch links retain the recorded generation version after an upgrade', () => {
  const source = { id: 'historical-omni', engineId: 'gemini-omni-flash', engineLabel: 'Gemini Omni Flash 1.1',
    prompt: 'A runner crosses the stream while the camera tracks left.', promptExcerpt: 'A runner crosses the stream.',
    durationSec: 6, aspectRatio: '16:9', hasAudio: true, createdAt: '2026-09-03', visibility: 'public' } as GalleryVideo;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const card = buildExamplesGalleryData({ allVideos: [source], locale, selectedEngine: 'veo' }).clientVideos[0];
    assert.equal(card.engineLabel, 'Gemini Omni Flash 1.1');
    const json = buildExamplesJsonLd({ galleryVideos: [{ ...source, prompt: '', promptExcerpt: '' }], locale,
      canonicalUrl: 'https://maxvideoai.com/examples/veo', galleryBasePath: '/examples', localePrefix: '',
      faqBlock: { title: '', items: [] } });
    const item = json.itemListJson!.itemListElement[0];
    assert.match(item.name, /Omni Flash 1\.1/);
  }
  const samples = buildExampleVersionSamples([source]);
  const [link] = buildExamplesVersionLinks([{ slug: 'gemini-omni-flash', engineId: 'gemini-omni-flash', label: 'Gemini Omni Flash 1.2' }], samples, ['gemini-omni-flash']);
  assert.equal(link.engineLabel, 'Gemini Omni Flash 1.1');
  assert.equal(link.href, '/video/historical-omni');
  assert.equal(link.current, false, 'an old render must not appear under Current versions');
  const [current] = buildExamplesVersionLinks([{ slug: 'gemini-omni-flash', engineId: 'gemini-omni-flash', label: 'Gemini Omni Flash 1.2' }],
    [{ ...samples[0], engineLabel: 'Google Gemini Omni Flash 1.2' }], ['gemini-omni-flash']);
  assert.equal(current.current, true, 'a provider prefix does not change a recorded version');
  assert.equal(deriveWatchPageSignals({ video: source }).engineLabel, 'Gemini Omni Flash 1.1');
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

test('LTX family guidance retains an explicit answer for LTX 2.3 alongside the current generation in every locale', async () => {
  const { getExampleModelLanding } = await import('../frontend/lib/examples/modelLanding');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'ltx');
    assert.ok(landing);
    assert.ok(landing.faqItems.some(item => /LTX 2\.3/.test(item.question) && /LTX 2\.3/.test(item.answer)), `${locale}: missing historical prompt answer`);
    assert.ok(landing.faqItems.some(item => /LTX 2\.5/.test(item.question)), `${locale}: current guidance must remain`);
  }
});
