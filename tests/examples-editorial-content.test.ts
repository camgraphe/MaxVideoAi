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

test('Wan gallery copy identifies both current models without erasing older results', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const landing = getExampleModelLanding(locale, 'wan');
    assert.ok(landing);
    for (const name of ['Wan 3', 'Wan 3 Prime']) {
      assert.ok(landing.metaTitle.includes(name), `${locale}: metadata must name ${name}`);
      assert.ok(landing.heroTitle.includes(name), `${locale}: H1 must name ${name}`);
      assert.ok(landing.heroSubtitle.includes(name), `${locale}: visible introduction must name ${name}`);
    }
    assert.match(landing.intro, /older|anciens?|anteriores?/i);
    assert.match(landing.guideTitle ?? '', /Wan 3/);
    assert.equal(landing.sections.length, 3);
    assert.ok(landing.sections.every((section) => /Wan/i.test(section.title)));
  }
});

test('other active example families expose their current version in the visible H1', () => {
  const versions = new Map([
    ['hailuo', 'H3'], ['happy-horse', '1.1'], ['luma', '3.2'],
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
