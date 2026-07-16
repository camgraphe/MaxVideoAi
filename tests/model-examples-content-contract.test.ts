import assert from 'node:assert/strict';
import test from 'node:test';

import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import {
  formatEmptyExamplesLabel,
  getModelExamplesUiCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';

function validExamplesFixture() {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'Fixture examples',
      intro: 'Current Fixture outputs.',
      defaultCtaLabel: 'View all Fixture examples',
      recreateLabel: null,
    },
    filters: [
      { id: 'all', label: 'All' },
      { id: 'product', label: 'Product / Ad' },
    ],
    proofItems: [
      { id: 'renders', icon: 'sparkles', title: 'Real renders', body: 'Review current outputs.' },
      { id: 'recreate', icon: 'zap', title: 'Recreate', body: 'Reuse the runtime setup.' },
      { id: 'audio', icon: 'audio', title: 'Audio', body: 'Check the current audio state.' },
      { id: 'continuity', icon: 'users', title: 'Continuity', body: 'Keep scenes consistent.' },
      { id: 'safety', icon: 'shield', title: 'Production-aware', body: 'Use current safeguards.' },
    ],
    fallbackItems: null,
  };
}

test('Examples parser rejects missing, identity mismatch, unknown fields, blanks and invalid relationships', () => {
  assert.throws(
    () => parseModelExamplesContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing examples content.*fixture-model.*en/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), modelSlug: 'other' }, 'fixture-model', 'en'),
    /identity mismatch/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), extra: true }, 'fixture-model', 'en'),
    /Invalid examples content/,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), filters: [{ id: 'product', label: 'Product' }] }, 'fixture-model', 'en'),
    /first filter.*all/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), proofItems: validExamplesFixture().proofItems.slice(0, 4) }, 'fixture-model', 'en'),
    /proofItems/i,
  );
  assert.throws(
    () => parseModelExamplesContent({ ...validExamplesFixture(), fallbackItems: [{ id: 'fallback', title: 'Fallback', category: 'Product', aspectRatio: '1:1', alt: 'Fallback image', tags: ['edit'] }] }, 'fixture-model', 'en'),
    /undeclared filter.*edit/i,
  );
});

test('generic Examples UI copy is complete and model-neutral', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getModelExamplesUiCopy(locale);
    assert.ok(copy.viewAllLabel.trim());
    assert.ok(copy.renderLabel.trim());
    assert.ok(copy.openLabel.trim());
    assert.ok(copy.noPreviewLabel.trim());
    assert.ok(formatEmptyExamplesLabel(copy, 'Fixture Model').includes('Fixture Model'));
    assert.doesNotMatch(JSON.stringify(copy), /sora|veo|kling|luma|seedance|nano banana/i);
  }
});
