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

test('Kling v4 functional access retains a normal noindex model page and closed marketing discovery', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const model = registry.models.find((entry: { id: string }) => entry.id === 'kling-v4');
  assert.ok(model, 'Kling v4 registry identity must exist');
  assert.equal(model.slug, 'kling-v4');
  assert.equal(model.family, 'kling');
  assert.notEqual(model.presentationOnly, true);
  assert.deepEqual(model.publication.model, { published: true, indexable: false });
  assert.equal(model.publication.app.published, true);
  for (const surface of ['pricing', 'compare', 'examples', 'sitemap']) {
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

test('Kling v4 localized normal-page content has no fake media, quote or public launch destination', () => {
  const ignition = JSON.parse(readFileSync('docs/launch/kling-v4/films.json', 'utf8')).films
    .find((film: { id: string }) => film.id === 'ignition');
  assert.equal(ignition.status, 'prepared_unrendered');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/kling-v4.json`, 'utf8'));
    const decision = parseModelDecisionContent(content.decision, 'kling-v4', locale);
    const prompting = parseModelPromptingContent(content.prompting, 'kling-v4', locale);
    const examples = parseModelExamplesContent(content.examples, 'kling-v4', locale);
    assert.equal(content.marketingName, 'Kling 4.0');
    assert.equal(examples.showWhenEmpty, false);
    assert.equal(examples.fallbackItems, null);
    assert.equal(examples.keyframeDemo, undefined);
    assert.equal(prompting.tabs.some(tab => tab.matchPublicExample === true), false);
    assert.equal(content.prompting.tabs.find((tab: { id: string }) => tab.id === 'scene').copy, ignition.prompt);
    assert.equal(content.prompting.demo.prompt, ignition.prompt);
    assert.match(content.prompting.tabs[0].title, /Ignition/);
    assert.doesNotMatch(JSON.stringify(content.prompting), /ceramic|céramiste|ceramista|finished bowl|bol terminé|cuenco terminado/i);
    const links = [decision.hero.primaryCta, decision.hero.secondaryCta, ...decision.hero.quickLinks,
      ...decision.decisionCards.map(card => card.cta), { href: decision.pricingCopy.ctaHref }];
    for (const link of links) assert.match(link.href, /^#(?:prompting|specs)$/);
    assert.doesNotMatch(JSON.stringify(content), /media\.maxvideoai\.com|job_external_|\.mp4|\/app\?engine=kling-v4|\/pricing#kling-v4/);
    assert.ok(prompting.tabs.length >= 3);
    assert.ok(content.faqs.length >= 6);
  }
});

test('Kling v4 prompt ideas render without manufacturing a demonstration duration or soundtrack', async () => {
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
  assert.match(markup, /original draft prompts/);
  assert.match(markup, /Ignition — unrendered film prompt/);
  assert.match(markup, /An adult romantic film scene in a small motorcycle repair shop/);
  assert.match(markup, /You could just ask/);
  assert.doesNotMatch(markup, /Draft prompt — the finished bowl|>8s<|>Audio on<|<video|\/app\?engine=kling-v4/);
});
