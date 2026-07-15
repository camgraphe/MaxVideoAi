import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import { getModelPromptingUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const I18N_SOURCE = readFileSync(path.join(process.cwd(), 'frontend', 'lib', 'models', 'i18n.ts'), 'utf8');

function files(locale: AppLocale) {
  return readdirSync(path.join(CONTENT_ROOT, locale)).filter((name) => name.endsWith('.json')).sort();
}

function rawPrompting(locale: AppLocale, slug: string): unknown {
  const document = JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as {
    prompting?: unknown;
  };
  return document.prompting;
}

function signature(value: unknown): unknown {
  if (Array.isArray(value)) return { kind: 'array', length: value.length, items: value.map(signature) };
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, signature(nested)]),
    );
  }
  return typeof value;
}

function valueAtPath(value: unknown, objectPath: string): unknown {
  return objectPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

test('all 40 model documents expose strict prompting content in every locale', () => {
  const expectedFiles = listModelPageTemplateSlugs().map((slug) => `${slug}.json`).sort();
  assert.equal(expectedFiles.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expectedFiles, `${locale} model inventory`);
    for (const fileName of expectedFiles) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelPromptingContent(
        rawPrompting(locale, slug),
        slug,
        locale,
        `${locale}/${fileName}#prompting`,
      );
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

test('each model keeps identical EN FR ES prompting structure', () => {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    const english = signature(rawPrompting('en', slug));
    assert.deepEqual(signature(rawPrompting('fr', slug)), english, `${slug}/fr structure`);
    assert.deepEqual(signature(rawPrompting('es', slug)), english, `${slug}/es structure`);
  }
});

test('localized prompting selection never falls back to English', () => {
  assert.match(I18N_SOURCE, /prompting:\s*overlay\.prompting/);
  assert.doesNotMatch(I18N_SOURCE, /prompting:\s*overlay\.prompting\s*\?\?\s*base\.prompting/);
});

test('migrated prompting content contains exactly the 18 approved corrections', () => {
  const expected = [
    ['dreamina-seedance-2-0-mini', 'fr', 'section.guide.href', '/fr/modeles/dreamina-seedance-2-0-mini'],
    ['dreamina-seedance-2-0-mini', 'es', 'section.guide.href', '/es/modelos/dreamina-seedance-2-0-mini'],
    ['seedance-2-0-fast', 'fr', 'section.guide.href', '/fr/modeles/seedance-2-0'],
    ['seedance-2-0-fast', 'es', 'section.guide.href', '/es/modelos/seedance-2-0'],
    [
      'luma-uni-1',
      'fr',
      'imageExamples.intro',
      'Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.',
    ],
    ['luma-uni-1', 'fr', 'imageExamples.items.0.badge', 'Visuel 2K'],
    [
      'luma-uni-1',
      'fr',
      'imageExamples.items.0.prompt',
      'Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    ],
    [
      'luma-uni-1-max',
      'fr',
      'imageExamples.intro',
      'Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.',
    ],
    ['luma-uni-1-max', 'fr', 'imageExamples.items.0.badge', 'Visuel 2K'],
    [
      'luma-uni-1-max',
      'fr',
      'imageExamples.items.0.prompt',
      'Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
    ],
    [
      'luma-uni-1',
      'es',
      'imageExamples.intro',
      'Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.',
    ],
    ['luma-uni-1', 'es', 'imageExamples.items.0.title', 'Imagen de campaña'],
    ['luma-uni-1', 'es', 'imageExamples.items.0.badge', 'Imagen 2K'],
    [
      'luma-uni-1',
      'es',
      'imageExamples.items.0.prompt',
      'Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    ],
    [
      'luma-uni-1-max',
      'es',
      'imageExamples.intro',
      'Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.',
    ],
    ['luma-uni-1-max', 'es', 'imageExamples.items.0.title', 'Imagen de campaña'],
    ['luma-uni-1-max', 'es', 'imageExamples.items.0.badge', 'Imagen 2K'],
    [
      'luma-uni-1-max',
      'es',
      'imageExamples.items.0.prompt',
      'Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
    ],
  ] as const satisfies readonly (readonly [string, AppLocale, string, string])[];
  assert.equal(expected.length, 18);

  for (const [slug, locale, objectPath, expectedValue] of expected) {
    const parsed = parseModelPromptingContent(rawPrompting(locale, slug), slug, locale);
    assert.equal(valueAtPath(parsed, objectPath), expectedValue, `${slug}/${locale}/${objectPath}`);
  }
});

function validPromptingFixture() {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'How to prompt Fixture',
      intro: 'Fixture introduction',
      tip: 'Fixture tip',
      guide: { label: 'Fixture guide', href: '/models/fixture-model' },
      referencesTitle: 'How Fixture uses references',
    },
    tabs: [{ id: 'quick', label: 'Quick', title: 'Quick prompt', description: null, copy: 'Subject, action, camera' }],
    tabNotes: [{ tabId: 'quick', body: 'Keep the subject explicit.' }],
    globalPrinciples: ['Lead with the subject.'],
    engineWhy: ['Fixture follows explicit camera direction.'],
    demo: {
      title: 'Fixture demo',
      promptLabel: 'Text prompt',
      prompt: 'A chef works at a night market.',
      notes: [],
      summary: {
        subject: 'Night-market chef',
        action: 'Prepares noodles',
        camera: 'Slow push-in',
        style: 'Cinematic documentary',
        output: 'Market ambience',
      },
      presentationOverrides: {
        modeLabel: 'Text-to-video',
        outputLabel: 'Audio',
        duration: null,
        aspectRatio: null,
        audioChipMode: 'media' as const,
        audioChipLabel: null,
        altContext: 'Fixture night-market render',
      },
    },
    imageExamples: null,
  };
}

test('prompting parser rejects missing, identity mismatch, unknown fields, blanks, and dangling tab notes', () => {
  assert.throws(
    () => parseModelPromptingContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing prompting content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), modelSlug: 'other-model' }, 'fixture-model', 'en'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), extra: true }, 'fixture-model', 'en'),
    /Invalid prompting content/,
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), section: { ...validPromptingFixture().section, title: '   ' } }, 'fixture-model', 'en'),
    /Expected a non-empty string/,
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), tabNotes: [{ tabId: 'missing', body: 'Dangling' }] }, 'fixture-model', 'en'),
    /unknown tab/i,
  );
});

test('prompting guide hrefs accept HTTPS and only the current internal locale family', () => {
  const accepted = {
    en: '/models/fixture-model',
    fr: '/fr/modeles/fixture-model',
    es: '/es/modelos/fixture-model',
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const local = validPromptingFixture();
    local.section.guide = { label: 'Local guide', href: accepted[locale] };
    assert.doesNotThrow(() => parseModelPromptingContent(local, 'fixture-model', locale));
    const external = validPromptingFixture();
    external.section.guide = { label: 'Official guide', href: 'https://developers.openai.com/example' };
    assert.doesNotThrow(() => parseModelPromptingContent(external, 'fixture-model', locale));
  }
  const crossed = validPromptingFixture();
  crossed.section.guide = { label: 'Wrong locale', href: '/models/fixture-model' };
  assert.throws(() => parseModelPromptingContent(crossed, 'fixture-model', 'fr'), /Invalid fr guide href/);
});

test('generic UI copy is complete and contains no model identity', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getModelPromptingUiCopy(locale);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim().length > 0));
    assert.doesNotMatch(JSON.stringify(copy), /seedance|kling|veo|sora|nano banana/i);
  }
});
