import assert from 'node:assert/strict';
import test from 'node:test';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding.ts';
import { getExamplesEditorialSections, getExamplesModelPageLabels } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts';

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
