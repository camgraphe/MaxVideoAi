import assert from 'node:assert/strict';
import test from 'node:test';

import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { getModelPromptingUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts';

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
