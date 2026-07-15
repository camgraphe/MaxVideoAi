import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REGISTRY = JSON.parse(
  readFileSync(path.join(process.cwd(), 'frontend', 'config', 'model-registry.json'), 'utf8'),
) as { models: Array<{ slug: string; category: string }> };
const LOCALES = ['en', 'fr', 'es'] as const;
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const NEW_DECISION_SLUGS = ['nano-banana-lite', 'seedream-5-0-pro'] as const;

function readDocument(locale: (typeof LOCALES)[number], slug: string) {
  return JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as {
    seo?: { title?: string; description?: string };
    decision?: { modelSlug?: string; meta?: { title?: string; description?: string } };
  };
}

test('all nine image models own localized decision content', () => {
  const imageSlugs = REGISTRY.models
    .filter((model) => model.category === 'image')
    .map((model) => model.slug)
    .sort();
  assert.equal(imageSlugs.length, 9);

  for (const slug of imageSlugs) {
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      assert.ok(document.decision, `${slug}/${locale} decision content`);
      assert.equal(document.decision.modelSlug, slug);
    }
  }
});

test('new image decision metadata exactly preserves current localized SEO', () => {
  for (const slug of NEW_DECISION_SLUGS) {
    for (const locale of LOCALES) {
      const document = readDocument(locale, slug);
      assert.deepEqual(document.decision?.meta, document.seo, `${slug}/${locale} metadata`);
    }
  }
});
