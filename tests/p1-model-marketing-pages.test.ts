import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const MODELS = ['kling-3-turbo-standard', 'kling-3-turbo-pro', 'minimax-h3-max'] as const;

test('P1 model pages have strict localized content and production templates', () => {
  for (const slug of MODELS) {
    const template = getModelPageTemplateConfig(slug);
    assert.ok(template, slug);
    assert.equal(template.intent, 'production', slug);
    for (const locale of LOCALES) {
      const source = `content/models/${locale}/${slug}.json`;
      const document = JSON.parse(readFileSync(source, 'utf8')) as Record<string, unknown>;
      assert.equal(parseModelDecisionContent(document.decision, slug, locale).modelSlug, slug);
      assert.equal(parseModelPromptingContent(document.prompting, slug, locale).modelSlug, slug);
      assert.equal(parseModelExamplesContent(document.examples, slug, locale).modelSlug, slug);
    }
  }
});

test('each new model page selects exactly two distinct reviewed launch jobs', () => {
  for (const slug of MODELS) {
    const media = PREFERRED_MEDIA[slug];
    assert.ok(media?.hero, `${slug}.hero`);
    assert.ok(media?.demo, `${slug}.demo`);
    assert.notEqual(media.hero, media.demo, slug);
  }
});

test('Kling tier copy keeps Standard at 720p and Pro at 1080p', () => {
  for (const locale of LOCALES) {
    const standard = readFileSync(`content/models/${locale}/kling-3-turbo-standard.json`, 'utf8');
    const pro = readFileSync(`content/models/${locale}/kling-3-turbo-pro.json`, 'utf8');
    assert.match(standard, /720p/i);
    assert.doesNotMatch(standard, /4K/);
    assert.match(pro, /1080p/i);
    assert.doesNotMatch(pro, /4K/);
  }
});
