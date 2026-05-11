import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

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

test('Seedream localized model pages position Seedream as a BytePlus image reference companion', () => {
  for (const locale of locales) {
    const seedream = readModel(locale, 'seedream');
    const copy = compactText(seedream);

    assert.match(copy, /seedream/i, `${locale} Seedream copy should name Seedream`);
    assert.match(copy, /byteplus|modelark/i, `${locale} Seedream copy should mention BytePlus or ModelArk`);
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
