import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { RAW_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model';

test('Kling v4 permits gallery preparation while the model page and other discovery remain closed', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const model = registry.models.find((entry: { id: string }) => entry.id === 'kling-v4');
  assert.ok(model, 'Kling v4 registry identity must exist');
  assert.equal(model.slug, 'kling-v4');
  assert.equal(model.family, 'kling');
  assert.notEqual(model.presentationOnly, true);
  assert.deepEqual(model.publication.model, { published: true, indexable: false });
  assert.equal(model.publication.app.published, true);
  assert.equal(model.publication.examples.published, true);
  assert.equal(model.publication.examples.current, false);
  assert.equal(model.publication.examples.includeInFamilyCopy, false);
  for (const surface of ['pricing', 'compare', 'sitemap']) {
    assert.equal(model.publication[surface].published, false, surface);
  }
  assert.equal(model.replacement, null);
  assert.equal(model.successorId, null);
  const template = getModelPageTemplateConfig('kling-v4');
  assert.ok(template);
  assert.equal(template.intent, 'production');
  assert.equal(template.pricing.enabled, false);
  assert.equal(template.sections.compare, false);
});

test('Kling v4 factual raw schema separates generation, frame and editing controls', () => {
  const entry = RAW_FAL_ENGINE_REGISTRY.find(entry => entry.id === 'kling-v4');
  assert.ok(entry, 'Kling v4 raw contract must exist');
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v']);
  assert.equal(entry.engine.maxDurationSec, 30);
  assert.deepEqual(entry.engine.resolutions, ['720p', '1080p']);
  assert.deepEqual(entry.engine.fps, []);
  assert.equal(entry.engine.keyframes, false);
  assert.equal(entry.media, undefined);
  assert.equal(entry.demoUrl, undefined);
  const fields = [...entry.engine.inputSchema!.required!, ...entry.engine.inputSchema!.optional!];
  assert.deepEqual(fields.find(field => field.id === 'end_image_url')?.modes, ['i2v']);
  assert.deepEqual(fields.find(field => field.id === 'image_url')?.modes, ['i2v', 'ref2v']);
  assert.equal(fields.find(field => field.id === 'image_urls')?.maxCount, 10);
  assert.equal(fields.find(field => field.id === 'video_urls')?.maxCount, 5);
  assert.equal(fields.some(field => ['generate_audio', 'seed', 'cfg_scale', 'negative_prompt', 'keyframe_indexes'].includes(field.id)), false);
  for (const mode of entry.modes) assert.equal(mode.ui.audioToggle, false);
  assert.deepEqual(entry.engine.modeCaps?.i2v?.aspectRatio, []);
  assert.deepEqual(entry.engine.modeCaps?.v2v?.aspectRatio, []);
});

test('Kling v4 localized normal-page content uses the selected filmed prompts without fake media URLs', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/kling-v4.json`, 'utf8'));
    const decision = parseModelDecisionContent(content.decision, 'kling-v4', locale);
    const prompting = parseModelPromptingContent(content.prompting, 'kling-v4', locale);
    const examples = parseModelExamplesContent(content.examples, 'kling-v4', locale);
    assert.equal(content.marketingName, 'Kling 4.0');
    assert.equal(examples.showWhenEmpty, false);
    assert.equal(examples.fallbackItems, null);
    assert.equal(examples.keyframeDemo, undefined);
    const concert = prompting.tabs.find(tab => tab.id === 'scene');
    const nextOne = prompting.tabs.find(tab => tab.id === 'reference');
    assert.equal(concert?.matchPublicExample, true);
    assert.equal(nextOne?.matchPublicExample, true);
    assert.match(concert?.copy ?? '', /black-and-white live concert sequence/);
    assert.match(nextOne?.copy ?? '', /romantic live-action scene in five shots/);
    assert.equal(prompting.demo?.prompt, nextOne?.copy);
    assert.match(prompting.demo?.title ?? '', /The Next One/i);
    assert.doesNotMatch(JSON.stringify(prompting), /unrendered|non généré|sin generar|not been rendered|pas été généré|no se ha generado/i);
    assert.doesNotMatch(JSON.stringify(content.prompting), /ceramic|céramiste|ceramista|finished bowl|bol terminé|cuenco terminado/i);
    const links = [decision.hero.primaryCta, decision.hero.secondaryCta, ...decision.hero.quickLinks,
      ...decision.decisionCards.map(card => card.cta), { href: decision.pricingCopy.ctaHref }];
    for (const link of links) assert.match(link.href, /^#(?:prompting|specs)$/);
    assert.doesNotMatch(JSON.stringify(content), /media\.maxvideoai\.com|job_external_|\.mp4|\/app\?engine=kling-v4|\/pricing#kling-v4/);
    assert.ok(prompting.tabs.length >= 3);
    assert.ok(content.faqs.length >= 6);
  }
});

test('Kling V4 public copy reflects live quoted access in every locale without inventing a fixed price', () => {
  const obsolete = /quotes remain disabled|generation and customer quotes remain disabled|devis clients restent désactivés|génération et les devis clients restent désactivés|presupuestos siguen desactivados|generación y los presupuestos siguen desactivados|generation and customer quotes are not enabled|génération Kling 4\.0 et les devis clients ne sont pas activés|generación Kling 4\.0 y los presupuestos para clientes están desactivados/i;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/kling-v4.json`, 'utf8'));
    assert.doesNotMatch(JSON.stringify(content), obsolete, locale);
    assert.match(content.pricingNotes[0], /App.*Studio.*MCP|MCP.*Studio.*App/i, locale);
    assert.match(content.pricingNotes[1], /quote|devis|presupuesto/i, locale);
    assert.match(content.decision.hero.paragraph, /App.*Studio.*MCP|MCP.*Studio.*App/i, locale);
    assert.doesNotMatch(JSON.stringify(content), /\$\d+\.\d{2}/, 'No invented fixed customer price');
  }
});

test('Kling v4 rendered prompt recipes display without invented media URLs or playback', async () => {
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const React = requireFrontend('react');
  Object.assign(globalThis, { React });
  const { renderToStaticMarkup } = requireFrontend('react-dom/server');
  const { ModelDecisionPromptingSection } = await import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection');
  const content = JSON.parse(readFileSync('content/models/en/kling-v4.json', 'utf8'));
  const viewModel = buildModelPromptingViewModel({
    content: parseModelPromptingContent(content.prompting, 'kling-v4', 'en'), locale: 'en',
    engineId: 'kling-v4', modelSlug: 'kling-v4', appGenerationEnabled: false, imageAnchorId: 'prompting',
    isVideoEngine: true, isImageEngine: false, supportsNativeAudio: true,
    demoPromptSource: 'editorial', defaultDemoPromptSource: 'editorial', demoMedia: null,
    defaultDemoPresentation: { audioBadgeLabel: 'Audio on', altContext: 'Kling 4.0' }, referenceWorkflows: [],
  });
  const markup = renderToStaticMarkup(React.createElement(ModelDecisionPromptingSection, { viewModel }));
  assert.match(markup, /filmed Kling 4\.0 scenes/);
  assert.match(markup, /Black-and-White Concert/);
  assert.match(markup, /black-and-white live concert sequence/);
  assert.doesNotMatch(markup, /Ignition/);
  assert.doesNotMatch(markup, /Draft prompt — the finished bowl|>8s<|>Audio on<|<video|\/app\?engine=kling-v4/);
});

test('Kling v4 selected tram film supplies the model demo and its matching example link', () => {
  const content = JSON.parse(readFileSync('content/models/en/kling-v4.json', 'utf8'));
  const prompting = parseModelPromptingContent(content.prompting, 'kling-v4', 'en');
  const filmedPrompt = prompting.demo!.prompt;
  const viewModel = buildModelPromptingViewModel({
    content: prompting, locale: 'en', engineId: 'kling-v4', modelSlug: 'kling-v4',
    appGenerationEnabled: true, imageAnchorId: 'prompting', isVideoEngine: true,
    isImageEngine: false, supportsNativeAudio: true, demoPromptSource: 'media',
    defaultDemoPromptSource: 'media',
    demoMedia: { id: 'selected-tram', prompt: filmedPrompt, videoUrl: 'https://media.maxvideoai.com/selected.mp4',
      posterUrl: 'https://media.maxvideoai.com/selected.webp', durationSec: 28.04,
      generationMode: 'ref2v', hasAudio: true, href: '/video/selected-tram', label: 'The Next One', aspectRatio: '16:9' },
    galleryVideos: [{ id: 'selected-tram', promptFull: filmedPrompt,
      videoUrl: 'https://media.maxvideoai.com/selected.mp4', href: '/video/selected-tram',
      recreateHref: '/app?engine=kling-v4&from=selected-tram' }],
    defaultDemoPresentation: { audioBadgeLabel: 'Audio on', altContext: 'Kling 4.0' },
    referenceWorkflows: [],
  });
  assert.equal(viewModel.demo?.title, 'The Next One');
  assert.equal(viewModel.demo?.prompt, filmedPrompt);
  assert.equal(viewModel.demo?.modeLabel, 'Reference-to-video');
  assert.equal(viewModel.tabs.items.find(tab => tab.id === 'reference')?.exampleLinks?.exampleHref, '/video/selected-tram');
  assert.equal(viewModel.tabs.items.find(tab => tab.id === 'reference')?.exampleLinks?.usePromptHref,
    '/app?engine=kling-v4&from=selected-tram');
});
