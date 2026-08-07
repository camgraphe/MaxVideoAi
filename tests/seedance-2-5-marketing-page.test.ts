import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getRuntimeModelById } from '../frontend/config/model-runtime.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import {
  getModelPageTemplateConfig,
  isPrelaunchModelPageTemplateSlug,
  listPrelaunchModelPageTemplateSlugs,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const slug = 'seedance-2-5';
const locales = ['en', 'fr', 'es'] as const;

test('Seedance 2.5 uses the shared decision template with registry-owned launch surfaces open', () => {
  const model = getRuntimeModelById(slug);
  const template = getModelPageTemplateConfig(slug);

  assert.ok(model);
  assert.ok(template);
  assert.equal(template.intent, 'production');
  assert.equal(isPrelaunchModelPageTemplateSlug(slug), false);
  assert.equal(template.pricing.enabled, false);
  assert.equal(template.sections.examples, true);
  assert.equal(template.sections.prompting, true);
  assert.equal(template.sections.tips, true);
  assert.equal(template.sections.compare, false);
  assert.equal(template.sections.specs, true);
  assert.doesNotMatch(JSON.stringify(template), /\/app\?engine=seedance-2-5/i);

  assert.equal(model.publication.model.indexable, true);
  assert.equal(model.publication.app.published, true);
  assert.equal(model.publication.pricing.published, true);
  assert.equal(model.publication.examples.published, true);
  assert.equal(model.publication.compare.published, true);
  assert.equal(model.publication.sitemap.published, true);
  assert.deepEqual(listPrelaunchModelPageTemplateSlugs(), []);
});

test('Seedance 2.5 localized marketing content is strict, aligned, and free of internal rollout copy', () => {
  for (const locale of locales) {
    const source = `content/models/${locale}/${slug}.json`;
    const document = JSON.parse(readFileSync(source, 'utf8')) as {
      custom?: Record<string, unknown>;
      decision?: unknown;
      prompting?: unknown;
      examples?: unknown;
    };
    const decision = parseModelDecisionContent(document.decision, slug, locale, `${source}#decision`);
    const prompting = parseModelPromptingContent(document.prompting, slug, locale, `${source}#prompting`);
    const examples = parseModelExamplesContent(document.examples, slug, locale, `${source}#examples`);

    assert.equal(decision.modelSlug, slug);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=seedance-2-5');
    assert.equal(prompting.modelSlug, slug);
    assert.equal(examples.modelSlug, slug);
    assert.equal(examples.showWhenEmpty, false);
    assert.deepEqual(prompting.tabs.map((tab) => tab.id), ['concept', 'timeline', 'constraints']);
    assert.deepEqual(examples.filters.map((filter) => filter.id), ['all', 'cinematic', 'audio']);
    assert.deepEqual(
      examples.proofItems.map(({ id, icon }) => [id, icon]),
      [
        ['continuity', 'users'],
        ['camera', 'maximize'],
        ['physics', 'zap'],
        ['dialogue', 'audio'],
        ['production', 'shield'],
      ],
    );
    assert.equal(Object.hasOwn(document.custom ?? {}, 'prelaunch'), false);
    const rolloutLanguageByLocale = {
      en: /\b(?:public generation|closed|rollout|availability|available)\b/i,
      fr: /(?:génération publique|fermée?|déploiement|disponib)/i,
      es: /(?:generación pública|cerrad[ao]|despliegue|disponib)/i,
    } as const;
    assert.doesNotMatch(decision.pricingCopy.footnote, rolloutLanguageByLocale[locale]);
    assert.doesNotMatch(
      JSON.stringify(document),
      /\b(?:BytePlus|ModelArk|provider|canary|unconfirmed|USD|credits?)\b|\$\s*\d/i,
    );
  }
});

test('Seedance 2.5 published pricing emits a public offer schema', () => {
  const engine = getFalEngineById(slug);
  assert.ok(engine);
  assert.equal(engine.surfaces.pricing.includeInEstimator, true);

  const schemas = buildModelSchemaPayloads({
    canonical: `https://maxvideoai.com/models/${slug}`,
    description: 'Seedance 2.5 marketing page',
    engine,
    heroPosterAbsolute: null,
    heroTitle: 'Seedance 2.5',
    inLanguage: 'en-US',
    localizedCanonical: `https://maxvideoai.com/models/${slug}`,
    localizedHomeUrl: 'https://maxvideoai.com/',
    localizedModelsUrl: 'https://maxvideoai.com/models',
    pricingEngine: engine.engine,
    resolvedBreadcrumb: { home: 'Home', models: 'Models' },
  }) as Array<Record<string, unknown>>;
  const product = schemas.find((schema) => schema['@type'] === 'Product');

  assert.ok(product);
  assert.equal('offers' in product, true);
});
