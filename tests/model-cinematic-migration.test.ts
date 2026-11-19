import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { projectModelPageRelease } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-flux-release';
import fluxVisuals from '../frontend/config/model-flux-workflow-visuals.json';
import previews from '../frontend/config/model-cinematic-workspace-previews.json';
import { getFalEngineBySlug } from '../frontend/src/config/falEngines';
import { buildCinematicAlternatives } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-discovery';
import { buildCinematicCapabilities } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-capabilities';
import { ModelCinematicCapabilities } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicCapabilities.client';
import proofs from '../frontend/config/model-cinematic-public-proofs.json';
import illustrations from '../frontend/config/model-capability-illustrations.json';
import draftIllustration from '../frontend/config/model-draft-workflow-illustration.json';
import { getVideoEditorialPreset } from '../frontend/lib/video/editorial-presets';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import { ModelCinematicSpecialty } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicSpecialty';
import { ModelCinematicWorkflowProofs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicWorkflowProofs';
import { publicCardWithKeyframeRecipeToVideo } from '../frontend/server/local-public-examples-data';
import { buildCinematicSpecExports, buildCinematicSpecRows } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-specs';
import { buildModelPageSpecProjection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-projection';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const locales = ['en', 'fr', 'es'] as const;
const slugs = ['seedance-2-5', 'flux-3-max'];
const read = (slug: string, locale: string) => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));

test('capability illustrations retain the full localized copy and reuse only the intended model and mode', () => {
  for (const locale of locales) {
    const content = read('seedance-2-5', locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, 'seedance-2-5'), parseModelExamplesContent(content.examples, 'seedance-2-5', locale), [], locale)!;
    const copy = buildCinematicCapabilities(presentation.content.capabilities, 'seedance-2-5', locale)!;
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicCapabilities, {copy, ui: presentation.ui}))).window.document;
    assert.equal(doc.querySelectorAll('[data-media-kind="illustration"]').length, 3);
    assert.equal(doc.querySelectorAll('video, script[type="application/ld+json"]').length, 0, 'A working illustration is never a native model video proof');
    for (const item of copy.items) {
      const panel = doc.getElementById(`capability-${item.id}`)!;
      const proof = item.proof!;
      assert.ok(panel.textContent?.includes(item.body));
      for (const use of item.uses) assert.ok(panel.textContent?.includes(use));
      assert.ok(panel.textContent?.includes(item.note));
      assert.ok(panel.textContent?.includes(proof.note), 'Provenance remains available in the prompt drawer');
      for (const href of [proof.creation.href, proof.creation.refineHref]) {
        const url = new URL(href, 'https://maxvideoai.com');
        assert.equal(url.searchParams.get('lang'), locale);
        const preset = getVideoEditorialPreset(url.searchParams.get('engine')!, url.searchParams.get('videoPrompt')!)!;
        assert.equal(preset.mode, url.searchParams.get('mode'));
        assert.equal(preset.prompt, proof.prompt);
        assert.deepEqual(preset.snapshot.refs, {}, 'Reuse requires the visitor’s own references');
        assert.ok(!url.searchParams.has('generate'));
      }
      assert.equal(new URL(proof.creation.refineHref, 'https://maxvideoai.com').searchParams.get('assistant'), 'milo');
      assert.equal(getVideoEditorialPreset('seedance-2-5-flash', `capability-${item.id}`), null);
    }
    const range = doc.querySelector('#capability-modify input[type=range]')!;
    assert.equal(range.getAttribute('value'), '50');
    assert.equal(range.getAttribute('min'), '0'); assert.equal(range.getAttribute('max'), '100');
    const wrongModel = structuredClone(presentation.content.capabilities!);
    assert.throws(() => buildCinematicCapabilities(wrongModel, 'flux-3-max', locale), /Missing model-owned capability illustration/);
  }
  for (const image of Object.values(illustrations.images)) {
    assert.equal(createHash('sha256').update(readFileSync('frontend/public' + image.url)).digest('hex'), image.sha256);
  }
});

test('compact workflow coverage explains every creation mode without inventing Max editing support', () => {
  for (const slug of slugs) for (const locale of locales) {
    const content = parseModelCinematicContent(read(slug, locale).cinematic, slug)!;
    const copy = buildCinematicCapabilities(content.capabilities, slug, locale)!;
    const modes = copy.items.flatMap(item => item.actions.map(action => action.mode));
    assert.deepEqual(new Set(modes), new Set(getFalEngineBySlug(slug)!.engine.modes), 'Every current mode has an explanation and a direct entry');
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicCapabilities, {copy}))).window.document;
    assert.equal(doc.querySelectorAll('[role=tab]').length, slug === 'seedance-2-5' ? 3 : 4);
    assert.equal(doc.querySelectorAll('[role=tabpanel]:not([hidden])').length, 1);
    for (const item of copy.items) {
      const panel = doc.getElementById(`capability-${item.id}`)!;
      assert.ok(panel.textContent?.includes(item.body), 'All explanations are present in server HTML');
      assert.equal(panel.querySelectorAll('.cinema-capability-uses li').length, 3);
      for (const action of item.actions) {
        const url = new URL(action.href, 'https://maxvideoai.com');
        assert.equal(url.pathname, '/app'); assert.equal(url.searchParams.get('lang'), locale);
        assert.equal(url.searchParams.get('engine'), slug); assert.equal(url.searchParams.get('mode'), action.mode);
        assert.ok(!url.searchParams.has('generate'));
      }
    }
    if (slug === 'flux-3-max') {
      assert.deepEqual(copy.handoff!.actions.map(a => [a.model, a.mode]), [['flux-3', 'extend'], ['seedance-2-5', 'v2v']]);
      const invalid = structuredClone(content.capabilities!); invalid.items[0].actions[0].mode = 'v2v';
      assert.throws(() => buildCinematicCapabilities(invalid, slug, locale), /Unsupported cinematic workflow/);
      const unnamed = structuredClone(content.capabilities!); unnamed.handoff!.actions[0].label = 'Continue here';
      assert.throws(() => buildCinematicCapabilities(unnamed, slug, locale), /must name the destination/);
    }
  }
});

test('migrated models retain exact identity, localized destinations and model-owned public recipes', () => {
  for (const slug of slugs) for (const locale of locales) {
    const copy = read(slug, locale);
    const content = parseModelCinematicContent(copy.cinematic, slug)!;
    const examples = parseModelExamplesContent(copy.examples, slug, locale);
    const presentation = buildCinematicPresentation(content, examples, [], locale)!;
    const decision = parseModelDecisionContent(copy.decision, slug, locale);
    assert.deepEqual(content.workflows!.items.map(item => item.id), ['create'], 'No unproved Modify/Extend film is borrowed from Flash');
    assert.equal(presentation.media?.modify, undefined);
    assert.equal(presentation.assets.length, 4);
    for (const asset of presentation.assets) {
      const proof = proofs.find(item => item.id === asset.id)!;
      assert.equal(proof.modelSlug, slug);
      assert.equal(asset.video?.src, proof.clip.src);
      assert.equal(asset.prompt, proof.prompt);
      const reuse = new URL(asset.videoCreation!.href, 'https://maxvideoai.com');
      const refine = new URL(asset.videoCreation!.refineHref, 'https://maxvideoai.com');
      assert.equal(reuse.searchParams.get('engine'), slug);
      assert.equal(reuse.searchParams.get('from'), proof.jobId);
      assert.equal(reuse.searchParams.get('lang'), locale);
      assert.equal(refine.searchParams.get('from'), proof.jobId);
      assert.equal(refine.searchParams.get('assistant'), 'milo');
      assert.equal(refine.searchParams.get('refine'), 'example');
      assert.ok(!reuse.searchParams.has('prompt'));
    }
    assert.equal(copy.prompting.tabs.length, slug === 'flux-3-max' ? 4 : 3);
    assert.ok(decision.hero.quickLinks.some(link => link.href.includes(slug === 'flux-3-max' ? 'flux-3-vs-flux-3-max' : 'seedance-2-0-vs-seedance-2-5')));
    assert.ok(decision.hero.quickLinks.some(link => link.href.includes(slug === 'flux-3-max' ? '/benchmarks#review-flux-3-max' : 'seedance-2-5-vs-seedance-2-5-flash')));
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicWorkflowProofs, {presentation, workspaceHref:`/app?engine=${slug}`})))).window.document;
    assert.equal(doc.querySelectorAll('.cinema-create-visual video').length, 1);
    assert.equal(doc.querySelector('.cinema-create-visual video')?.getAttribute('src'), presentation.media!.create.src);
    assert.ok([...doc.querySelectorAll('video')].every(video => video.getAttribute('preload') === 'none'));
    if (slug === 'flux-3-max') {
      assert.equal(doc.querySelectorAll('.cinema-mode-visual').length, 4);
      for (const mode of ['image', 'endpoints'] as const) {
        const panel = doc.querySelector(`#capability-${mode}`)!;
        assert.equal(panel.querySelectorAll('.cinema-mode-inputs img').length, mode === 'image' ? 1 : 2);
        assert.equal(panel.querySelector('.cinema-mode-output video')?.getAttribute('src'), fluxVisuals[mode].video);
        assert.equal(panel.querySelector('[data-analytics-cta-name="reuse_example"]')?.getAttribute('href')?.includes('videoPrompt=' + fluxVisuals[mode].recipe.id), true);
      }
      assert.equal(doc.querySelectorAll('#capability-text video').length, 1);
      assert.equal(doc.querySelectorAll('#capability-keyframes a[href="#model-workflow"]').length, 1);
      const board = doc.querySelector('#capability-keyframes')!;
      assert.deepEqual([...board.querySelectorAll('.cinema-board-strip button')].map(button => button.textContent), ['0 s', '3 s', '6 s', '11 s', '16 s']);
      assert.equal(board.querySelectorAll('button[aria-pressed="true"]').length, 1);
      assert.equal(board.querySelectorAll('video').length, 0);
      const tariffPath = { en: '/pricing', fr: '/fr/tarifs', es: '/es/precios' }[locale];
      assert.equal(decision.pricingCopy.ctaHref, tariffPath + '#flux-3-max-pricing');
    }
    assert.equal(doc.querySelector('dialog .cinema-prompt-text')?.textContent, content.workflows!.items[0].prompt);
    assert.ok(doc.querySelector('dialog a[data-analytics-cta-name="reuse_example"]')?.getAttribute('href')?.includes('from='));
  }
});

test('specialties distinguish the Draft illustration from actual localized controls and preserve factual handoffs', () => {
  for (const slug of slugs) for (const locale of locales) {
    const copy = read(slug, locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(copy.cinematic, slug), parseModelExamplesContent(copy.examples, slug, locale), [], locale)!;
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicSpecialty, {presentation}))).window.document;
    const img = doc.querySelector('img')!;
    assert.equal(img.getAttribute('loading'), 'lazy');
    if (slug === 'seedance-2-5') {
      assert.equal(img.getAttribute('alt'), '', 'The angle button supplies its accessible label');
      assert.equal(doc.querySelectorAll('[data-media-kind="workflow-illustration"]').length, 1);
      assert.equal(doc.querySelectorAll('img').length, 4);
      assert.equal(new Set(Array.from(doc.querySelectorAll('img')).map(image => image.getAttribute('src'))).size, 3, 'Only the selected angle is repeated in the final');
      assert.ok(doc.body.textContent?.includes(copy.cinematic.specialty.draftPreview.illustration));
      assert.equal(doc.querySelectorAll('[aria-pressed="true"]').length, 2);
      assert.equal(doc.querySelector('.cinema-draft-resolutions [aria-pressed="true"]')?.textContent, '1080p');
      assert.equal(doc.querySelector('.cinema-draft-final [data-selected-angle]')?.getAttribute('data-selected-angle'), draftIllustration.selectedAngleId);
      assert.ok(doc.querySelector('details')?.textContent?.includes(copy.cinematic.specialty.note));
      assert.equal(doc.querySelectorAll('.cinema-workspace-preview').length, 0);
      assert.equal(presentation.draftVisual?.generator, 'ImageGen');
    } else {
      assert.equal(img.getAttribute('alt'), copy.cinematic.specialty.workspacePreview.alt);
      assert.ok(doc.querySelector('picture source[media="(max-width: 599px)"]'));
      assert.equal(presentation.draftVisual, undefined);
    }
    assert.ok(doc.body.textContent?.includes(copy.cinematic.specialty.note));
    const href = new URL(doc.querySelector('a.cinema-button')!.getAttribute('href')!, 'https://maxvideoai.com');
    assert.equal(href.searchParams.get('engine'), slug);
    assert.equal(href.searchParams.get('lang'), locale);
    assert.equal(href.searchParams.get('mode'), slug === 'flux-3-max' ? 'ref2v' : 't2v');
    assert.ok(!href.searchParams.has('assistant'));
    assert.equal(doc.querySelectorAll('video').length, 0, 'No fabricated keyframe result without a validated public recipe');
  }
  for (const image of draftIllustration.angles) assert.equal(createHash('sha256').update(readFileSync('frontend/public' + image.url)).digest('hex'), image.sha256);
  for (const entry of previews.entries) for (const image of [entry, entry.mobile]) {
    assert.equal(createHash('sha256').update(readFileSync('frontend/public' + image.url)).digest('hex'), image.sha256);
    assert.ok(image.width > 0 && image.height > 0);
  }
});

test('public keyframe snapshots fail closed on wrong identity, prompt, duration or missing references', () => {
  const card = { id: 'public-keyframes', engineIconId: 'flux-3-max', engineLabel: 'FLUX 3 Max', prompt: 'A door opens.', durationSec: 16, hasAudio: false };
  const recipe = { jobId: card.id, engineId: card.engineIconId, prompt: card.prompt, durationSec: 16, resolution: '720p', aspectRatio: '16:9', audio: false, reasoningLevel: 'high', seed: null,
    keyframes: [{ imageUrl: 'https://cdn.maxvideoai.com/reference.png', frameIndex: 384 }] };
  const video = publicCardWithKeyframeRecipeToVideo(card, recipe);
  assert.ok(video?.settingsSnapshot);
  for (const changed of [{...recipe,jobId:'other'}, {...recipe,prompt:'Different'}, {...recipe,durationSec:17}, {...recipe,keyframes:[]}, {...recipe,keyframes:[{...recipe.keyframes[0],frameIndex:385}]}]) {
    assert.equal(publicCardWithKeyframeRecipeToVideo(card, changed), null);
  }
  assert.equal(publicCardWithKeyframeRecipeToVideo({...card,engineIconId:'flux-3'}, recipe), null);
  assert.equal(publicCardWithKeyframeRecipeToVideo(undefined, recipe), null);
});

test('citable exports carry the model, canonical source and explicit review date in all formats', () => {
  for (const locale of locales) {
    const result = buildCinematicSpecExports({title:'FLUX 3 Max',locale,source:'https://maxvideoai.com/models/flux-3-max#specs',reviewedAt:'2026-11-16',rows:[{id:'keyframes',label:'Keyframes',value:'1–10'}]});
    for (const value of Object.values(result)) {
      assert.ok(value.includes('FLUX 3 Max'));
      assert.ok(value.includes('https://maxvideoai.com/models/flux-3-max#specs'));
      assert.ok(value.includes('2026-11-16'));
      assert.ok(value.includes('1–10'));
    }
  }
});

test('the 4K editorial candidate carries its codec into exports without relabelling existing proof films', () => {
  const authored = JSON.parse(readFileSync('data/benchmarks/engine-key-specs.v1.json', 'utf8')).specs.find((item: {modelSlug: string}) => item.modelSlug === 'seedance-2-5');
  // Runtime 4K activation belongs to the coordinated integration PR. Exercise its
  // target capability here without changing generation or price configuration.
  const engine = structuredClone(getFalEngineBySlug('seedance-2-5')!);
  engine.engine.resolutions = [...new Set([...engine.engine.resolutions, '4k'])];
  for (const locale of locales) {
    const copy = read('seedance-2-5', locale);
    const content = parseModelCinematicContent(copy.cinematic, 'seedance-2-5')!;
    const presentation = buildCinematicPresentation(content, parseModelExamplesContent(copy.examples, 'seedance-2-5', locale), [], locale)!;
    assert.match(copy.seo.title, /4K/);
    assert.match(content.intro, /4K/);
    assert.match(content.specialty!.steps[2].label, /1080p.*4K/);
    assert.match(content.capabilities!.items.find(item => item.id === 'modify')!.note, /480p\/720p.*1080p.*4K/);
    const projected = buildModelPageSpecProjection({ engine, locale, isImageEngine: false, showPriceInSpecs: false, keySpecs: authored.keySpecs });
    const rows = buildCinematicSpecRows(projected.keySpecRows, engine.engine, locale, false);
    assert.match(rows.find(row => row.id === 'maxResolution')!.value, /4K/);
    const codec = rows.find(row => row.id === 'outputFormats')!.value;
    assert.match(codec, /1080p.*4K.*HEVC 10-bit/);
    const exported = buildCinematicSpecExports({ title: 'Seedance 2.5', rows, locale, source: 'https://maxvideoai.com/models/seedance-2-5#specs' });
    for (const value of Object.values(exported)) assert.ok(value.includes(codec));
    const proof = presentation.assets.find(asset => asset.id === 'sd25-prompt')!;
    assert.equal(proof.video?.width, 1280);
    assert.equal(proof.video?.height, 720);
    assert.doesNotMatch(proof.metadataLabel, /4K/);
    assert.equal(copy.prompting.demo.prompt, proof.prompt);
    assert.ok(proof.videoCreation!.href.includes('from=job_ff94f180-0a2f-4f2b-acb2-bda8352fa9d9'));
  }
});

test('video closing sections link to model-specific alternatives, published comparisons and the localized tariff row', () => {
  for (const slug of [...slugs, 'seedance-2-5-flash']) for (const locale of locales) {
    const page = read(slug, locale);
    const choices = parseModelCinematicContent(page.cinematic, slug)!.alternatives!.models;
    const links = buildCinematicAlternatives(slug, locale, [...choices, { slug, reason: 'self' }, { slug: 'missing-model', reason: 'missing' }]);
    const compareBase = { en: '/ai-video-engines/', fr: '/fr/comparatif/', es: '/es/comparativa/' }[locale];
    if (slug === 'flux-3-max') {
      assert.deepEqual(links.map(link => link.slug), ['flux-3', 'seedance-2-5', 'minimax-h3-max']);
      assert.equal(links[0].compareHref, compareBase + 'flux-3-vs-flux-3-max?order=flux-3-max');
    } else if (slug === 'seedance-2-5-flash') {
      assert.deepEqual(links.map(link => link.slug), ['seedance-2-5', 'kling-v4-flash', 'minimax-h3']);
      assert.deepEqual(links.map(link => link.compareHref), [
        compareBase + 'seedance-2-5-vs-seedance-2-5-flash?order=seedance-2-5-flash',
        compareBase + 'kling-v4-flash-vs-seedance-2-5-flash?order=seedance-2-5-flash',
        compareBase + 'minimax-h3-vs-seedance-2-5-flash?order=seedance-2-5-flash',
      ]);
    } else {
      assert.deepEqual(links.map(link => link.slug), ['seedance-2-5-flash', 'wan-3', 'minimax-h3-max']);
      assert.deepEqual(links.map(link => link.compareHref), [
        compareBase + 'seedance-2-5-vs-seedance-2-5-flash',
        compareBase + 'seedance-2-5-vs-wan-3',
        compareBase + 'minimax-h3-max-vs-seedance-2-5?order=seedance-2-5',
      ]);
    }
    const tariff = { en: '/pricing', fr: '/fr/tarifs', es: '/es/precios' }[locale];
    assert.equal(page.decision.pricingCopy.ctaHref, tariff + '#' + slug + '-pricing');
    assert.equal(new Set(links.map(link => link.poster)).size, links.length);
    for (const link of links) assert.ok(readFileSync('frontend/public' + link.poster).length > 0);
  }
});

test('the model-page release keeps opening and closing frame workflows while the timed storyboard is held', () => {
  for (const locale of locales) {
    const source = read('flux-3-max', locale);
    const raw = mergeEngineLocalizedContent(source, source);
    const projected = projectModelPageRelease(raw, 'flux-3-max', locale);
    const cinematic = parseModelCinematicContent(projected.cinematic, 'flux-3-max')!;
    assert.deepEqual(cinematic.capabilities?.items.map(item => item.id), ['text', 'image', 'endpoints']);
    assert.equal(cinematic.specialty, undefined);
    assert.equal(parseModelExamplesContent(projected.examples, 'flux-3-max', locale).keyframeDemo, undefined);
    for (const value of [projected.seo.description, projected.overview, ...projected.faqs.map(faq => faq.question + faq.answer)])
      assert.doesNotMatch(value ?? '', /keyframes?|images? clés?|imágenes clave|fotogramas? clave/i);
    assert.equal(projectModelPageRelease(raw, 'seedance-2-5', locale), raw);
  }
});
