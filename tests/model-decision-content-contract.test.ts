import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const I18N_NORMALIZATION_SOURCE = readFileSync(
  path.join(process.cwd(), 'frontend', 'lib', 'models', 'i18n-normalization.ts'),
  'utf8',
);
const MODEL_ROUTE_ROOT = path.join(
  process.cwd(),
  'frontend',
  'app',
  '(localized)',
  '[locale]',
  '(marketing)',
  'models',
  '[slug]',
);

function typeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test('production model route has no obsolete copy owner or direct localized JSON import', () => {
  const source = typeScriptFiles(MODEL_ROUTE_ROOT)
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /model-page-template-copy|COPY_BY_MODEL_SLUG|ADDITIONAL_TEMPLATE_COPY/);
  assert.doesNotMatch(source, /from\s+['"][^'"]*content\/models\/[^'"]+\.json['"]/);
});

function files(locale: AppLocale) {
  return readdirSync(path.join(CONTENT_ROOT, locale)).filter((name) => name.endsWith('.json')).sort();
}

function rawDecision(locale: AppLocale, slug: string): unknown {
  const document = JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as { decision?: unknown };
  return document.decision;
}

function signature(value: unknown): unknown {
  if (Array.isArray(value)) return { kind: 'array', length: value.length, items: value.map(signature) };
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, signature(nested)]));
  }
  return typeof value;
}

test('all 40 model documents expose strict decision content in every locale', () => {
  const expectedFiles = listModelPageTemplateSlugs().map((slug) => `${slug}.json`).sort();
  assert.equal(expectedFiles.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expectedFiles, `${locale} model inventory`);
    for (const fileName of expectedFiles) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelDecisionContent(rawDecision(locale, slug), slug, locale, `${locale}/${fileName}#decision`);
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

test('each model keeps identical EN FR ES decision structure', () => {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    const english = signature(rawDecision('en', slug));
    assert.deepEqual(signature(rawDecision('fr', slug)), english, `${slug}/fr structure`);
    assert.deepEqual(signature(rawDecision('es', slug)), english, `${slug}/es structure`);
  }
});

test('localized model decision selection never falls back to English', () => {
  assert.match(I18N_NORMALIZATION_SOURCE, /decision:\s*overlay\.decision/);
  assert.doesNotMatch(
    I18N_NORMALIZATION_SOURCE,
    /decision:\s*overlay\.decision\s*\?\?\s*base\.decision/,
  );
});

test('old decision maps are not direct JSON consumers and tracing already includes model content', () => {
  const nextConfig = readFileSync(path.join(process.cwd(), 'frontend', 'next.config.js'), 'utf8');
  assert.match(nextConfig, /\.\.\/content\/models\/\*\*\/\*/);
  assert.equal(existsSync(path.join(process.cwd(), 'content', 'model-decisions')), false);
});

function validFixture() {
  return {
    modelSlug: 'fixture-model',
    hero: {
      eyebrow: 'Fixture eyebrow',
      title: 'Fixture title',
      subtitle: 'Fixture subtitle',
      subtitleHighlights: ['Fixture'],
      paragraph: 'Fixture paragraph',
      primaryCta: { label: 'Open fixture', href: '/app/image?engine=fixture-model' },
      secondaryCta: { label: 'Prompt examples', href: '#prompting' },
      quickLinks: [{ label: 'Specs', href: '#specs' }],
    },
    media: {
      caption: 'Fixture caption',
      description: 'Fixture description',
      renderLabel: 'View fixture',
      badges: ['Fixture badge'],
      altContext: 'Fixture alt context',
    },
    features: [{ title: 'Fixture feature', body: 'Fixture feature body', tone: 'quality' }],
    decisionCards: [{
      title: 'Fixture card',
      body: 'Fixture card body',
      cta: { label: 'Prompt examples', href: '#prompting' },
    }],
    referenceWorkflows: [{ title: 'Fixture workflow', body: 'Fixture workflow body' }],
    pricingCopy: {
      title: 'Fixture pricing',
      subtitle: 'Fixture pricing subtitle',
      footnote: 'Fixture pricing footnote',
      ctaLabel: 'View pricing',
      ctaHref: '#specs',
    },
    meta: { title: 'Fixture metadata', description: 'Fixture metadata description' },
  };
}

test('strict parser rejects missing, mismatched, unknown, and blank decision content', () => {
  assert.throws(
    () => parseModelDecisionContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing decision content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), modelSlug: 'other-model' }, 'fixture-model', 'en', 'identity.json'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), extra: true }, 'fixture-model', 'en', 'unknown.json'),
    /Invalid decision content.*unknown\.json/s,
  );
  assert.throws(
    () => parseModelDecisionContent({ ...validFixture(), hero: { ...validFixture().hero, title: '   ' } }, 'fixture-model', 'en', 'empty.json'),
    /Expected a non-empty string/,
  );
});

test('strict parser accepts only shared or current-locale href families', () => {
  const accepted: Record<AppLocale, readonly string[]> = {
    en: ['/models/x', '/examples/x', '/ai-video-engines/x?order=x', '/pricing#x'],
    fr: ['/fr/modeles/x', '/fr/galerie/x', '/fr/comparatif/x-vs-y?order=x', '/fr/tarifs#x'],
    es: ['/es/modelos/x', '/es/galeria/x', '/es/comparativa/x-vs-y?order=x', '/es/precios#x'],
  };
  const rejected: Record<AppLocale, readonly string[]> = {
    en: ['/fr/modeles/x', '/es/modelos/x'],
    fr: ['/models/x', '/es/modelos/x'],
    es: ['/models/x', '/fr/modeles/x'],
  };

  for (const locale of LOCALES) {
    for (const href of ['/app/image?engine=fixture-model', '#prompting', '#specs', ...accepted[locale]]) {
      const fixture = validFixture();
      fixture.hero.primaryCta.href = href;
      assert.doesNotThrow(() => parseModelDecisionContent(fixture, 'fixture-model', locale, `${locale}-accepted.json`));
    }
    for (const href of rejected[locale]) {
      const fixture = validFixture();
      fixture.hero.primaryCta.href = href;
      assert.throws(
        () => parseModelDecisionContent(fixture, 'fixture-model', locale, `${locale}-rejected.json`),
        new RegExp(`Invalid ${locale} href`),
      );
    }
  }
});
