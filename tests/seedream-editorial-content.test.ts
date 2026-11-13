import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';

const LOCALES = ['en', 'fr', 'es'] as const;
const ORIGINAL_PROMPT_HASHES = {
  'seedream-5-0-pro': [
    ['pro-stay-curious', '83b4b7179dd2c9f323ac3b8115088008fc205b28f33716e502f8b5e5a0714a57'],
  ],
  'seedream-5-5': [
    ['55-make-your-move', 'cae0cc5de9763895c10f9f6bbaa9c123d1f2f2f4efdb267d64188cbd236698a4'],
    ['55-last-train', 'dfbd485ac016312c923198e007762b367ab5896dd3c06a19e1c6f108c6ee0238'],
  ],
  'seedream-5-0-flash': [
    ['flash-keep-going', 'ed988c13f3877f980bcf4de8d454a9d7ca78daf50d00c8aa8cfc3f8cf08c2a44'],
    ['flash-next-stop', '5b3751a63fa14fe4cc974fac12d43debcb3e82c99340e0a1571106c9a3b080ae'],
  ],
} as const;

function readContent(locale: typeof LOCALES[number], slug: string) {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'content/models', locale, `${slug}.json`), 'utf8'));
}

test('Seedream human-scene briefs retain the original English prompts and truthful input labels', () => {
  const badges = { en: 'Text → Image', fr: 'Texte → Image', es: 'Texto → Imagen' };
  const originalEnglish = { en: /Original English prompt/, fr: /Prompts? origina(?:l|ux) en anglais/, es: /Prompts? original(?:es)? en inglés/ };

  for (const [slug, expected] of Object.entries(ORIGINAL_PROMPT_HASHES)) {
    for (const locale of LOCALES) {
      const content = readContent(locale, slug);
      const prompting = parseModelPromptingContent(content.prompting, slug, locale);
      assert.ok(prompting.imageExamples, `${slug}/${locale} image briefs`);
      assert.match(prompting.imageExamples.intro, originalEnglish[locale]);
      assert.deepEqual(
        prompting.imageExamples.items.map(({ id, prompt }) => [id, createHash('sha256').update(prompt).digest('hex')]),
        expected,
        `${slug}/${locale} preserves the actual generation briefs without translating them`,
      );
      for (const item of prompting.imageExamples.items) {
        assert.equal(item.kind, 'image', `${slug}/${locale}/${item.id} is text-to-image`);
        assert.equal(item.badge, badges[locale]);
      }
    }
  }
});

test('Seedream Pro stays image-only and Lite recommends the actual 2K Pro output', () => {
  for (const locale of LOCALES) {
    const pro = readContent(locale, 'seedream-5-0-pro');
    const examples = parseModelExamplesContent(pro.examples, 'seedream-5-0-pro', locale);
    assert.ok(examples.filters.every(({ id }) => id !== 'audio'));
    assert.doesNotMatch(JSON.stringify(examples.proofItems), /multi-shot|across sequences|continuité multi|continuidad multi/i);
    assert.doesNotMatch(JSON.stringify(pro), /\b[34]K\b/);
    assert.match(JSON.stringify(pro.decision.features), /2K/);
    assert.match(JSON.stringify(pro.decision.features), /JPEG.*PNG/);
    assert.ok(pro.custom?.strengths?.length, `${locale} explicitly owns visible Pro advice`);
    assert.ok(pro.custom?.boundaries?.length, `${locale} explicitly owns visible Pro limits`);
    assert.ok(pro.custom?.safetyRules?.length, `${locale} explicitly owns visible Pro safety copy`);
    if (locale !== 'en') {
      const english = readContent('en', 'seedream-5-0-pro').custom;
      for (const key of ['strengths', 'boundaries', 'safetyRules', 'specSections']) {
        assert.notDeepEqual(pro.custom[key], english[key], `${locale}/${key} cannot fall back to English`);
      }
    }

    const lite = readContent(locale, 'seedream');
    for (const item of lite.custom?.relatedItems ?? []) {
      if (item.modelSlug === 'seedream-5-0-pro') {
        assert.match(item.description, /2K/);
        assert.doesNotMatch(item.description, /\b[34]K\b/);
      }
    }
  }
});

test('Seedream decision sections use distinct useful bodies instead of repeating the introduction', () => {
  for (const slug of ['seedream', ...Object.keys(ORIGINAL_PROMPT_HASHES)]) {
    for (const locale of LOCALES) {
      const content = readContent(locale, slug);
      const decision = parseModelDecisionContent(content.decision, slug, locale);
      const bodies = [
        content.overview,
        decision.hero.paragraph,
        ...decision.features.map(({ body }) => body),
        ...decision.referenceWorkflows.map(({ body }) => body),
      ];
      assert.equal(new Set(bodies).size, bodies.length, `${slug}/${locale} each section develops a different point`);
    }
  }
});
