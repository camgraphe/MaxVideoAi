import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionDataFromContent } from './helpers/model-decision-content.ts';

const REGISTRY = JSON.parse(
  readFileSync(path.join(process.cwd(), 'frontend', 'config', 'model-registry.json'), 'utf8'),
) as { models: Array<{ slug: string; category: string }> };
const LOCALES = ['en', 'fr', 'es'] as const;
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const NEW_DECISION_SLUGS = ['nano-banana-lite', 'seedream-5-0-pro'] as const;
const IMAGE_SLUGS = REGISTRY.models
  .filter((model) => model.category === 'image')
  .map((model) => model.slug)
  .sort();

function readDocument(locale: (typeof LOCALES)[number], slug: string) {
  return JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as {
    seo?: { title?: string; description?: string };
    decision?: { modelSlug?: string; meta?: { title?: string; description?: string } };
  };
}

test('all nine image models own localized decision content', () => {
  assert.equal(IMAGE_SLUGS.length, 9);

  for (const slug of IMAGE_SLUGS) {
    const engine = listFalEngines().find((candidate) => candidate.modelSlug === slug);
    assert.ok(engine, `${slug} engine`);

    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      assert.ok(document.decision, `${slug}/${locale} decision content`);
      assert.equal(document.decision.modelSlug, slug);
      assert.ok(buildModelDecisionDataFromContent({ engine, locale }), `${slug}/${locale} decision data`);
    }
  }
});

test('new image decision metadata exactly preserves current localized SEO', () => {
  for (const slug of NEW_DECISION_SLUGS) {
    const engine = listFalEngines().find((candidate) => candidate.modelSlug === slug);
    const template = getModelPageTemplateConfig(slug);
    assert.ok(engine, `${slug} engine`);
    assert.ok(template, `${slug} template`);

    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      const decision = buildModelDecisionDataFromContent({ engine, locale });
      assert.ok(decision, `${slug}/${locale} decision data`);
      assert.deepEqual(document.decision?.meta, document.seo, `${slug}/${locale} metadata`);
      assert.deepEqual(decision.meta, document.seo, `${slug}/${locale} builder metadata`);
      assert.deepEqual(
        decision.pricing.scenarios.map((scenario) => scenario.id),
        template.pricing.presets.map((preset) => preset.id),
        `${slug}/${locale} pricing scenario ids`
      );
    }
  }
});
