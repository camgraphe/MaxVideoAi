import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getCinematicVideoMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-media';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { cinematicWorkflowBoard } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-workflow-proofs';
import { ModelCinematicWorkflowProofs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicWorkflowProofs';

const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('unregistered cinematic models cannot inherit the pilot media', () => {
  const raw = readFileSync('content/models/en/seedance-2-5-flash.json', 'utf8');
  const next = JSON.parse(raw.replaceAll('seedance-2-5-flash', 'future-video'));
  const content = parseModelCinematicContent(next.cinematic, 'future-video');
  const examples = parseModelExamplesContent(next.examples, 'future-video', 'en');
  assert.equal(getCinematicVideoMedia('future-video'), undefined);
  assert.equal(cinematicWorkflowBoard('future-video', 'extend'), undefined);
  assert.throws(() => buildCinematicPresentation(content, examples, [], 'en'), /No reviewed media/);
  assert.throws(() => buildCinematicPresentation(content, examples, [], 'en', getCinematicVideoMedia('seedance-2-5-flash')), /No reviewed media/);
});

test('a registered next model reuses the renderer with its own media, attribution and destinations', () => {
  const next = JSON.parse(readFileSync('content/models/en/seedance-2-5-flash.json', 'utf8').replaceAll('seedance-2-5-flash', 'future-video'));
  const content = parseModelCinematicContent(next.cinematic, 'future-video');
  const examples = parseModelExamplesContent(next.examples, 'future-video', 'en');
  const media = JSON.parse(JSON.stringify(getCinematicVideoMedia('seedance-2-5-flash')).replaceAll('seedance-2-5-flash', 'future-video'));
  media.modelLabel = 'Future video';
  const presentation = buildCinematicPresentation(content, examples, [], 'en', media)!;
  assert.ok(presentation.assets.find(asset => asset.id === 'the-blue-hour')?.metadataLabel.startsWith('Future video ·'));
  const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale:'en',messages:{},timeZone:'UTC' },
    React.createElement(ModelCinematicWorkflowProofs, { presentation,workspaceHref:'/app?engine=future-video' })));
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('video').length, 5);
  assert.ok([...doc.querySelectorAll('video')].every(video => video.getAttribute('src')!.includes('/future-video/')));
  assert.ok([...doc.querySelectorAll('a[href*="/app?"]')].every(a => new URL(a.getAttribute('href')!, 'https://maxvideoai.com').searchParams.get('engine') === 'future-video'));
  media.frames[0].display.url = media.frames[0].display.url.replace('/future-video/', '/seedance-2-5-flash/');
  assert.throws(() => buildCinematicPresentation(content, examples, [], 'en', media), /belongs to another model/);
});

test('cinematic renderers consume model media instead of importing pilot configurations', () => {
  for (const file of ['ModelCinematicCreateProof.tsx', 'ModelCinematicWorkflowFocus.tsx', 'ModelCinematicWorkflowProofs.tsx', 'ModelCinematicPrompting.tsx']) {
    const source = readFileSync(`frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/${file}`, 'utf8');
    assert.doesNotMatch(source, /@\/config\/model-cinematic-(?:create-media|final-media|workflow-boards)/);
    assert.doesNotMatch(source, /['"](?:seedance-2-5-flash|the-blue-hour)['"]/);
  }
});

test('the video template can offer Create alone without inventing Modify or Extend support', () => {
  const next = JSON.parse(readFileSync('content/models/en/seedance-2-5-flash.json', 'utf8'));
  next.cinematic.workflows.items = next.cinematic.workflows.items.filter((item: { id: string }) => item.id === 'create');
  next.examples.cinematic.panels = next.examples.cinematic.panels.filter((panel: { id: string }) => !['modify', 'extend'].includes(panel.id));
  const content = parseModelCinematicContent(next.cinematic, 'seedance-2-5-flash');
  const examples = parseModelExamplesContent(next.examples, 'seedance-2-5-flash', 'en');
  const presentation = buildCinematicPresentation(content, examples, [], 'en')!;
  const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: 'en', messages: {}, timeZone: 'UTC' },
    React.createElement(ModelCinematicWorkflowProofs, { presentation, workspaceHref: '/app?engine=seedance-2-5-flash' })));
  const doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelector('#proof-create'));
  assert.equal(doc.querySelector('#proof-modify, #proof-extend, a[href*="workflow=modify"], a[href*="workflow=extend"]'), null);
  next.cinematic.workflows.items.push(next.cinematic.workflows.items[0]);
  assert.throws(() => parseModelCinematicContent(next.cinematic, 'seedance-2-5-flash'), /Each workflow appears once/);
  const missingProof = structuredClone(examples);
  missingProof.cinematic!.panels = missingProof.cinematic!.panels.filter(panel => panel.id !== 'create');
  assert.throws(() => buildCinematicPresentation(content, missingProof, [], 'en'), /own visible proof/);
});
