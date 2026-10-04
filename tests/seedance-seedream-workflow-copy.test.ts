import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;
const seedanceSlugs = ['seedance-2-0', 'seedance-2-0-fast'] as const;

const forbiddenClaims =
  /\b(guaranteed compatibility|no moderation|review-free|always accepted|bypasses restrictions|guarantees? (?:that )?seedance (?:will )?accept|bypasses? (?:seedance )?(?:review|moderation))\b/i;

function readModel(locale: (typeof locales)[number], slug: string): unknown {
  const filePath = path.join(root, 'content/models', locale, `${slug}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compactText(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

test('Seedream localized model pages position Seedream as a MaxVideoAI image reference companion', () => {
  for (const locale of locales) {
    const seedream = readModel(locale, 'seedream');
    const copy = compactText(seedream);

    assert.match(copy, /seedream/i, `${locale} Seedream copy should name Seedream`);
    assert.doesNotMatch(copy, /byteplus|modelark/i, `${locale} Seedream public copy should not send users to provider support`);
    assert.match(copy, /image/i, `${locale} Seedream copy should position the page as image generation/editing`);
    assert.match(copy, /seedance-2-0/i, `${locale} Seedream copy should link Seedance 2.0`);
    assert.match(copy, /seedance-2-0-fast/i, `${locale} Seedream copy should link Seedance 2.0 Fast`);
    assert.doesNotMatch(copy, forbiddenClaims, `${locale} Seedream copy should avoid unsafe workflow claims`);
  }
});

test('Seedance localized pages mention and link Seedream as an optional reference-image workflow', () => {
  for (const locale of locales) {
    for (const slug of seedanceSlugs) {
      const model = readModel(locale, slug);
      const copy = compactText(model);

      assert.match(copy, /seedream/i, `${locale}/${slug} should mention Seedream`);
      assert.match(copy, /"modelslug":"seedream"|\/models\/seedream/i, `${locale}/${slug} should link to Seedream`);
      assert.match(copy, /reference|référence|referencia/i, `${locale}/${slug} should frame Seedream as a reference-image workflow`);
      assert.doesNotMatch(copy, forbiddenClaims, `${locale}/${slug} should avoid unsafe workflow claims`);
    }
  }
});

test('Seedream localized model pages include MaxVideoAI workflow limits without provider-facing parameters', () => {
  for (const locale of locales) {
    const seedream = readModel(locale, 'seedream');
    const copy = compactText(seedream);

    assert.doesNotMatch(copy, /docs\.byteplus\.com|sequential_image_generation/i, `${locale} Seedream public copy should avoid provider docs and raw parameters`);
    assert.match(copy, /2-10/, `${locale} Seedream copy should mention the multi-reference input range`);
    assert.match(copy, /15/, `${locale} Seedream copy should mention the total reference plus output limit`);
    assert.match(copy, /successfully generated|générées avec succès|generadas correctamente/i, `${locale} Seedream copy should explain successful-image billing`);
  }
});

test('Seedream 5.0 Pro exposes only supported 2K output in capabilities, offers and localized copy', () => {
  const engine = getFalEngineById('seedream-5-0-pro')?.engine;
  const template = getModelPageTemplateConfig('seedream-5-0-pro');
  assert.ok(engine);
  assert.ok(template);
  assert.deepEqual(engine.resolutions, ['2K']);
  assert.deepEqual(template.pricing.presets.map((preset) => preset.imageResolution), ['2K']);
  for (const locale of locales) {
    const copy = compactText(readModel(locale, 'seedream-5-0-pro'));
    assert.match(copy, /2k/, `${locale} must state the available tier`);
    assert.doesNotMatch(copy, /4k/, `${locale} must not advertise unsupported 4K output`);
  }
});

test('Fast and Mini stay distinct from the unpublished Seedance 2.5 Draft workflow', () => {
  for (const locale of locales) {
    const fast = compactText(readModel(locale, 'seedance-2-0-fast'));
    const mini = compactText(readModel(locale, 'dreamina-seedance-2-0-mini'));
    const seedance25 = compactText(readModel(locale, 'seedance-2-5'));
    assert.match(fast, /draft/i, `${locale} Fast copy must clarify the named Draft mode`);
    assert.match(fast, /seedance 2\.5/i, `${locale} Fast copy should identify the distinct 2.5 workflow`);
    assert.match(mini, /compar.*(?:quote|devis|presupuesto)/i, `${locale} Mini must scope price comparisons to matching live quotes`);
    assert.doesNotMatch(seedance25, /draft.*(?:available|disponible|accessible).*maxvideoai/i);
  }
});

test('Mini value language avoids a global lowest-price claim against nominal 5s 720p quotes', () => {
  const fixture = JSON.parse(fs.readFileSync('tests/fixtures/pricing-public-projections.v1.json', 'utf8')) as {
    rows: Array<{ id: string; customerTotalCents?: number }>;
  };
  const quote = (id: string) => fixture.rows.find((row) => row.id === `pricing-hub-video:${id}:5s-720p`)?.customerTotalCents;
  assert.equal(quote('seedance-2-0-mini'), 95);
  assert.equal(quote('seedance-2-0-fast'), 151);
  assert.equal(quote('pika-text-to-video'), 26);
  assert.equal(quote('kling-2-5-turbo'), 46);
  assert.ok(quote('seedance-2-0-mini')! < quote('seedance-2-0-fast')!);
  assert.ok(quote('pika-text-to-video')! < quote('seedance-2-0-mini')!);
});
