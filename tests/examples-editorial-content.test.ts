import assert from 'node:assert/strict';
import test from 'node:test';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding.ts';
import { buildExamplesNextStepLinks, getExamplesEditorialSections, getExamplesModelPageLabels } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts';

test('family guidance retains complete authored paragraphs instead of ellipses', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'seedance');
    assert.ok(landing);
    const sections = getExamplesEditorialSections(landing.sections, null);

    for (const [index, section] of landing.sections.entries()) {
      assert.equal(sections[index].body, section.body, `${locale}: ${section.title} must be present in full`);
    }
    assert.ok(sections[0].body.length > 86, `${locale}: long guidance cannot be cut at the old limit`);
  }
});

test('Seedance model navigation invites a choice in each locale', () => {
  const expected = {
    en: 'Choose your Seedance model',
    fr: 'Choisissez votre modèle Seedance',
    es: 'Elige tu modelo Seedance',
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const labels = getExamplesModelPageLabels({
      isKlingLanding: false,
      isLtxLanding: false,
      isSeedanceLanding: true,
      locale,
    });
    assert.equal(labels.currentModelPagesLabel, expected[locale]);
  }
});

test('hub next steps identify only model links for their engine logos', () => {
  const links = buildExamplesNextStepLinks({
    appLocale: 'en', locale: 'en', familySlug: '', isKlingLanding: false,
    isLtxLanding: false, isSeedanceLanding: false, isVeoLanding: false,
    pricingPath: '/pricing',
  });
  assert.deepEqual(links.filter(link => link.modelSlug).map(link => [link.href, link.modelSlug]), [
    ['/models/seedance-2-5', 'seedance-2-5'],
    ['/models/minimax-h3', 'minimax-h3'],
    ['/models/wan-3', 'wan-3'],
  ]);
});

test('Wan opening describes the enduring family while version-specific guidance stays available', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'wan');
    assert.ok(landing);
    assert.match(landing.metaTitle, /Wan.*[Pp]rompts/);
    assert.match(landing.heroTitle, /Wan.*prompts/);
    assert.match(landing.heroSubtitle, /histor|earlier|anteriores/i);
    assert.match(landing.intro, /earlier|historiques|anteriores?/i);
    assert.match(landing.guideTitle ?? '', /Wan/);
    assert.equal(landing.sections.length, 3);
    assert.ok(landing.sections.every((section) => /Wan/i.test(section.title)));
  }
});

test('other active example families expose their current version in the visible H1', () => {
  const versions = new Map([
    ['happy-horse', '1.1'], ['luma', '3.2'],
    ['grok', '1.5'], ['flux', 'FLUX 3'], ['pika', '2.2'],
  ]);
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const [slug, version] of versions) {
      const landing = getExampleModelLanding(locale, slug);
      assert.ok(landing);
      assert.ok(landing.heroTitle.includes(version), `${locale}/${slug}: H1 must identify ${version}`);
    }
  }
});
