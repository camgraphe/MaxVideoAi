import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization';

const root = process.cwd();
const overlayPaths = {
  en: join(root, 'docs/model-launch/seedance-2-5/en.overlay.json'),
  fr: join(root, 'docs/model-launch/seedance-2-5/fr.overlay.json'),
  es: join(root, 'docs/model-launch/seedance-2-5/es.overlay.json'),
} as const;
const expected = {
  en: {
    unavailable: 'Seedance 2.5 is not yet available for generation on MaxVideoAI.',
    primaryHref: '/models/seedance-2-0',
    secondaryHref: '/examples/seedance',
  },
  fr: {
    unavailable:
      'Seedance 2.5 n’est pas encore disponible pour générer des vidéos sur MaxVideoAI.',
    primaryHref: '/fr/modeles/seedance-2-0',
    secondaryHref: '/fr/galerie/seedance',
  },
  es: {
    unavailable: 'Seedance 2.5 todavía no está disponible para generar vídeos en MaxVideoAI.',
    primaryHref: '/es/modelos/seedance-2-0',
    secondaryHref: '/es/galeria/seedance',
  },
} as const;

function asRecord(value: unknown, path: string): Record<string, unknown> {
  assert.equal(
    Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    true,
    `${path} must be an object`,
  );
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), path);
}

function assertString(value: unknown, path: string) {
  assert.equal(typeof value, 'string', `${path} must be a string`);
  assert.notEqual((value as string).trim(), '', `${path} must not be empty`);
}

function parseLaunchOverlay(path: string): EngineOverlay {
  const overlay = asRecord(JSON.parse(readFileSync(path, 'utf8')), path);
  assertExactKeys(
    overlay,
    [
      'marketingName',
      'versionLabel',
      'seo',
      'overview',
      'pricingNotes',
      'hero',
      'faqs',
      'custom',
    ],
    `${path} top-level keys`,
  );
  ['marketingName', 'versionLabel', 'overview', 'pricingNotes'].forEach((key) =>
    assertString(overlay[key], `${path}.${key}`),
  );

  const seo = asRecord(overlay.seo, `${path}.seo`);
  assertExactKeys(seo, ['title', 'description'], `${path}.seo keys`);
  assertString(seo.title, `${path}.seo.title`);
  assertString(seo.description, `${path}.seo.description`);

  const hero = asRecord(overlay.hero, `${path}.hero`);
  assertExactKeys(
    hero,
    ['title', 'intro', 'badge', 'ctaPrimary', 'secondaryLinks'],
    `${path}.hero keys`,
  );
  ['title', 'intro', 'badge'].forEach((key) =>
    assertString(hero[key], `${path}.hero.${key}`),
  );
  const primary = asRecord(hero.ctaPrimary, `${path}.hero.ctaPrimary`);
  assertExactKeys(primary, ['label', 'href'], `${path}.hero.ctaPrimary keys`);
  const secondaryLinks = hero.secondaryLinks;
  assert.equal(Array.isArray(secondaryLinks), true);
  assert.equal((secondaryLinks as unknown[]).length, 1);
  [
    primary,
    asRecord((secondaryLinks as unknown[])[0], `${path}.hero.secondaryLinks[0]`),
  ].forEach((link, index) => {
    assertExactKeys(link, ['label', 'href'], `${path}.hero link ${index}`);
    assertString(link.label, `${path}.hero link ${index}.label`);
    assertString(link.href, `${path}.hero link ${index}.href`);
  });

  assert.equal(Array.isArray(overlay.faqs), true);
  (overlay.faqs as unknown[]).forEach((entry, index) => {
    const faq = asRecord(entry, `${path}.faqs[${index}]`);
    assertExactKeys(faq, ['q', 'a'], `${path}.faqs[${index}] keys`);
    assertString(faq.q, `${path}.faqs[${index}].q`);
    assertString(faq.a, `${path}.faqs[${index}].a`);
  });

  const custom = asRecord(overlay.custom, `${path}.custom`);
  assertExactKeys(custom, ['prelaunch'], `${path}.custom keys`);
  const prelaunch = asRecord(custom.prelaunch, `${path}.custom.prelaunch`);
  assertExactKeys(
    prelaunch,
    [
      'dreaminaLabel',
      'checkedAt',
      'apiAvailability',
      'pricingAvailability',
      'productSurface',
      'sourceUrl',
      'announcedProductClaims',
    ],
    `${path}.custom.prelaunch keys`,
  );
  [
    'dreaminaLabel',
    'checkedAt',
    'apiAvailability',
    'pricingAvailability',
    'productSurface',
    'sourceUrl',
  ].forEach((key) => assertString(prelaunch[key], `${path}.custom.prelaunch.${key}`));
  assert.equal(Array.isArray(prelaunch.announcedProductClaims), true);
  (prelaunch.announcedProductClaims as unknown[]).forEach((claim, index) =>
    assertString(claim, `${path}.custom.prelaunch.announcedProductClaims[${index}]`),
  );

  return overlay as unknown as EngineOverlay;
}

test('Seedance 2.5 launch overlays are safe and structurally canonical in EN, FR, and ES', () => {
  for (const [locale, path] of Object.entries(overlayPaths)) {
    assert.equal(existsSync(path), true, `${locale} launch overlay is required`);
    const overlay = parseLaunchOverlay(path);
    const content = mergeEngineLocalizedContent({}, overlay);
    const serialized = JSON.stringify(overlay);
    const readerCopy = JSON.stringify({
      seo: overlay.seo,
      overview: overlay.overview,
      pricingNotes: overlay.pricingNotes,
      hero: overlay.hero,
      faqs: overlay.faqs,
    });
    const localeExpected = expected[locale as keyof typeof expected];
    const prelaunch = content.custom?.prelaunch as
      | {
          dreaminaLabel?: string;
          checkedAt?: string;
          apiAvailability?: string;
          pricingAvailability?: string;
          productSurface?: string;
          sourceUrl?: string;
          announcedProductClaims?: string[];
        }
      | undefined;

    assert.equal(content.marketingName, 'Seedance 2.5');
    assert.equal(content.versionLabel, '2.5');
    assert.match(content.overview ?? '', new RegExp(localeExpected.unavailable));
    assert.equal(content.hero?.ctaPrimary?.href, localeExpected.primaryHref);
    assert.equal(content.hero?.secondaryLinks?.[0]?.href, localeExpected.secondaryHref);
    assert.equal(prelaunch?.dreaminaLabel, 'coming_soon');
    assert.equal(prelaunch?.checkedAt, '2026-07-26');
    assert.equal(prelaunch?.apiAvailability, 'unconfirmed');
    assert.equal(prelaunch?.pricingAvailability, 'unconfirmed');
    assert.equal(prelaunch?.productSurface, 'Dreamina');
    assert.equal(
      prelaunch?.sourceUrl,
      'https://dreamina.capcut.com/seedance/seedance-2-5',
    );
    assert.deepEqual(prelaunch?.announcedProductClaims, [
      '4k_output',
      'standard_mode_up_to_30_seconds',
      'beta_long_video_mode_up_to_180_seconds',
      'up_to_50_multimodal_inputs',
      'reference_to_video_control',
      'precise_local_video_editing',
    ]);
    assert.equal(Object.hasOwn(overlay, 'decision'), false);
    assert.equal(Object.hasOwn(overlay, 'prompting'), false);
    assert.equal(Object.hasOwn(overlay, 'examples'), false);
    assert.equal(Object.hasOwn(overlay, 'prompts'), false);
    assert.equal(Object.hasOwn(overlay, 'faqTitle'), false);
    assert.doesNotMatch(serialized, /dreamina-seedance[-_. ]?2[-_. ]?5/i);
    assert.doesNotMatch(serialized, /\/app\?engine=seedance[-_. ]?2[-_. ]?5/i);
    assert.doesNotMatch(serialized, /\$\s*\d|€\s*\d|\b(?:USD|EUR)\s*\d/i);
    assert.doesNotMatch(readerCopy, /\b(?:July|juillet|julio)\b|\b20\d{2}\b/i);
  }
});
