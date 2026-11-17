import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import previews from '../frontend/config/model-cinematic-workspace-previews.json';
import { getFalEngineBySlug } from '../frontend/src/config/falEngines';
import { buildCinematicCapabilities } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-capabilities';
import { ModelCinematicCapabilities } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicCapabilities.client';
import proofs from '../frontend/config/model-cinematic-public-proofs.json';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import { ModelCinematicSpecialty } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicSpecialty';
import { ModelCinematicWorkflowProofs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicWorkflowProofs';
import { publicCardWithKeyframeRecipeToVideo } from '../frontend/server/local-public-examples-data';
import { buildCinematicSpecExports } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-specs';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const locales = ['en', 'fr', 'es'] as const;
const slugs = ['seedance-2-5', 'flux-3-max'];
const read = (slug: string, locale: string) => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));

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
    assert.equal(doc.querySelectorAll('video').length, 1);
    assert.equal(doc.querySelector('video')?.getAttribute('preload'), 'none');
    assert.equal(doc.querySelector('dialog .cinema-prompt-text')?.textContent, content.workflows!.items[0].prompt);
    assert.ok(doc.querySelector('dialog a[data-analytics-cta-name="reuse_example"]')?.getAttribute('href')?.includes('from='));
  }
});

test('specialties show actual localized Create controls, preserve factual HTML and open the matching mode', () => {
  for (const slug of slugs) for (const locale of locales) {
    const copy = read(slug, locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(copy.cinematic, slug), parseModelExamplesContent(copy.examples, slug, locale), [], locale)!;
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicSpecialty, {presentation}))).window.document;
    const img = doc.querySelector('img')!;
    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('alt'), copy.cinematic.specialty.workspacePreview.alt);
    assert.ok(doc.querySelector('picture source[media="(max-width: 599px)"]'));
    assert.ok(doc.body.textContent?.includes(copy.cinematic.specialty.note));
    const href = new URL(doc.querySelector('a.cinema-button')!.getAttribute('href')!, 'https://maxvideoai.com');
    assert.equal(href.searchParams.get('engine'), slug);
    assert.equal(href.searchParams.get('lang'), locale);
    assert.equal(href.searchParams.get('mode'), slug === 'flux-3-max' ? 'ref2v' : 't2v');
    assert.ok(!href.searchParams.has('assistant'));
    assert.equal(doc.querySelectorAll('video').length, 0, 'No fabricated keyframe result without a validated public recipe');
  }
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
