import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesVersionLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-version-links';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding';
import { buildExamplesModelLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data';
import { getExampleFamilyCurrentModelSlugs } from '../frontend/lib/model-families';

test('a new published model adds discovery without removing older prompt links', () => {
  const models = [
    { slug: 'wan-3-prime', engineId: 'wan-3-prime', label: 'Wan 3 Prime' },
    { slug: 'wan-2-6', engineId: 'wan-2-6', label: 'Wan 2.6' },
    { slug: 'wan-2-5', engineId: 'wan-2-5', label: 'Wan 2.5' },
  ];
  const samples = [
    { engineId: 'wan-3-prime', videoId: 'current' },
    { engineId: 'wan-2-6', videoId: 'older-beyond-page-one' },
    { engineId: 'wan-2-5', videoId: 'archive-beyond-page-one' },
    { engineId: 'kling-2-6-pro', videoId: 'unrelated' },
  ];
  const baseline = buildExamplesVersionLinks(models, samples, ['wan-3-prime']);
  assert.deepEqual(baseline.map(link => link.href), ['/video/current', '/video/older-beyond-page-one', '/video/archive-beyond-page-one']);
  assert.deepEqual(baseline.map(link => link.current), [true, false, false]);

  // Future identity is a test-only registry projection, never authored product data.
  const future = { slug: 'wan-future-fixture', engineId: 'wan-future-fixture', label: 'Wan future fixture' };
  const publishedWithoutVideo = buildExamplesVersionLinks([future, ...models], samples, [future.slug]);
  assert.deepEqual(publishedWithoutVideo.map(link => link.href), baseline.map(link => link.href), 'publication alone must not invent a video or prompt');
  const withVideo = buildExamplesVersionLinks([future, ...models], [{ engineId: future.engineId, videoId: 'new-public-video' }, ...samples], [future.slug]);
  assert.deepEqual(withVideo.map(link => link.href), ['/video/new-public-video', ...baseline.map(link => link.href)]);
  assert.equal(withVideo[0].current, true);
  assert.ok(withVideo.slice(1).every(link => !link.current), 'current status follows examples publication, not the historic video label');
});

test('version links retain exact identities, collapse aliases and never duplicate prompt payloads', () => {
  const links = buildExamplesVersionLinks([
    { slug: 'ltx-2-3-pro', engineId: 'ltx-2-3', label: 'LTX 2.3 Pro' },
    { slug: 'ltx-2-3-fast', engineId: 'ltx-2-3-fast', label: 'LTX 2.3 Fast' },
  ], [
    { engineId: 'ltx-2-3', videoId: 'original/pro' },
    { engineId: 'ltx-2-3-pro', videoId: 'duplicate' },
    { engineId: 'ltx-2-3-fast', videoId: 'fast' },
  ], []);
  assert.deepEqual(links.map(link => [link.engineLabel, link.href, link.current]), [
    ['LTX 2.3 Pro', '/video/original%2Fpro', false],
    ['LTX 2.3 Fast', '/video/fast', false],
  ]);
  assert.ok(links.every(link => !('prompt' in link) && !('promptFull' in link) && !('priceLabel' in link)));
});

test('target family headings describe the whole family and keep the opening concise in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const family of ['wan', 'kling', 'ltx', 'hailuo', 'seedance']) {
      const landing = getExampleModelLanding(locale, family)!;
      assert.ok(landing);
      assert.match(landing.heroTitle, /prompt/i);
      assert.doesNotMatch(landing.heroTitle, /\d/, `${locale}/${family}: family H1 must survive the next version`);
      assert.doesNotMatch(landing.metaTitle, /\d/, `${locale}/${family}: family title must remain stable`);
      assert.match(landing.heroSubtitle, /histor|anteriores|earlier/i);
      assert.ok(landing.heroSubtitle.length < 180, `${locale}/${family}: no catalogue dump above the videos`);
    }
  }
});

test('an all-historical family cannot acquire a fake current group', () => {
  const links = buildExamplesModelLinks({ locale: 'en', selectedEngine: 'sora', usesCurrentAndSupportedBlocks: true });
  assert.equal(links.primaryModelLinks.length, 0);
  assert.equal(links.supportedOlderModelLinks.length, links.modelLinks.length);
});

test('family copy does not repeat an automatic model list beside the version links', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(getExampleModelLanding(locale, 'wan')!.summary, undefined);
    assert.ok(getExampleModelLanding(locale, 'wan')!.intro.split(/\s+/).length < 40);
    assert.match(getExampleModelLanding(locale, 'seedance')!.summary!, /1\.5/, 'authored historical generation-closure guidance stays visible');
  }
});

test('real historical identities remain discoverable without promoting them as current', () => {
  for (const [family, historicalSlug] of [
    ['wan', 'wan-2-5'], ['kling', 'kling-2-6-pro'], ['ltx', 'ltx-2-3-pro'],
    ['hailuo', 'minimax-hailuo-02-text'], ['seedance', 'seedance-1-5-pro'],
  ]) {
    const { modelLinks } = buildExamplesModelLinks({ locale: 'en', selectedEngine: family, usesCurrentAndSupportedBlocks: true });
    const model = modelLinks.find(item => item.slug === historicalSlug)!;
    assert.ok(model, `${family}: preserve the published historical identity`);
    const links = buildExamplesVersionLinks(modelLinks, [{ engineId: model.engineId, videoId: historicalSlug }], getExampleFamilyCurrentModelSlugs(family));
    assert.equal(links.length, 1);
    assert.equal(links[0].engineLabel, model.label);
    assert.equal(links[0].current, false, `${family}: examples publication owns the historical group`);
  }
});
