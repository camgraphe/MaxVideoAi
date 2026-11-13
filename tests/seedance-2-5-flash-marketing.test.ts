import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getRuntimeModelById, listPublishedRuntimeModels } from '../frontend/config/model-runtime.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const slug = 'seedance-2-5-flash';

test('preparing the Flash template does not publish a model, price, comparison or generation entry point', () => {
  const model = getRuntimeModelById(slug)!;
  const template = getModelPageTemplateConfig(slug)!;
  assert.ok(model);
  assert.ok(template);
  assert.equal(listPublishedRuntimeModels().some((entry) => entry.id === slug), false);
  for (const [surface, policy] of Object.entries(model.publication)) {
    assert.equal(policy.published, false, `${surface} remains unpublished`);
  }
  assert.equal(model.publication.model.indexable, false);
  assert.equal(model.publication.examples.includeInFamilyCopy, false);
  assert.equal(template.pricing.enabled, false);
  assert.deepEqual(template.pricing.presets, []);
  assert.equal(template.sections.examples, false);
  assert.equal(template.sections.compare, false);
});

test('each Flash locale builds reviewable copy without fabricated results or quoted retail amounts', () => {
  const engine = getFalEngineById(slug)!;
  const promptCopies = new Set<string>();
  for (const [locale, modelsHref] of [['en', '/models'], ['fr', '/fr/modeles'], ['es', '/es/modelos']] as const) {
    const content = JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8')) as {
      decision: unknown; prompting: unknown; examples: unknown;
    };
    const decision = buildModelDecisionData({ engine, locale, decisionContent: content.decision });
    const prompting = parseModelPromptingContent(content.prompting, slug, locale);
    const examples = parseModelExamplesContent(content.examples, slug, locale);
    assert.ok(decision);
    assert.equal(decision.hero.primaryCta.href, modelsHref);
    assert.equal(decision.hero.secondaryCta.href, `${modelsHref}/seedance-2-5`);
    assert.deepEqual(decision.pricing.scenarios, []);
    assert.doesNotMatch(JSON.stringify(decision), /\/app(?:\/|\?|$)|\$\s*\d|\d+(?:\.\d+)?\s*(?:USD|EUR)/);
    const view = buildModelPromptingViewModel({
      content: prompting, locale, engineId: slug, modelSlug: slug, appGenerationEnabled: false,
      imageAnchorId: 'prompting', isVideoEngine: true, isImageEngine: false, supportsNativeAudio: false,
      demoPromptSource: 'editorial', defaultDemoPromptSource: 'editorial', demoMedia: null,
      defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [],
    });
    assert.equal(view.tabs.usePromptHref, null);
    assert.equal(view.tabs.exampleHref, null);
    assert.equal(view.defaultPresentation.demo, null);
    assert.ok(view.demo);
    assert.equal(view.demo.videoSrc, null);
    assert.equal(view.demo.posterSrc, null);
    assert.equal(view.demo.fullHref, null);
    assert.doesNotMatch(view.demo.durationLabel, /\d/);
    assert.doesNotMatch(view.demo.aspectLabel, /\d/);
    assert.equal(prompting.imageExamples, null);
    assert.equal(examples.fallbackItems, null);
    assert.equal(examples.showWhenEmpty, false);
    assert.ok(prompting.tabs.length > 0);
    promptCopies.add(prompting.tabs.map((tab) => tab.copy).join('\n'));
  }
  assert.equal(promptCopies.size, 3, 'scene plans belong to their requested locale');
});
