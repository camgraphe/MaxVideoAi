import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization.ts';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('localized content uses production field fallbacks and normalizes base prompts and FAQs', () => {
  const base: EngineOverlay = {
    seo: {
      title: 'Base SEO title',
      description: 'Base SEO description',
      image: '/base.jpg',
    },
    hero: {
      title: 'Base hero title',
      intro: 'Base hero intro',
      badge: 'Base badge',
    },
    promptStructure: {
      title: 'Base structure title',
      quote: 'Base quote',
      description: 'Base structure description',
      steps: ['Base step'],
    },
    prompts: [
      '  Base string prompt  ',
      { title: '  Named prompt  ', prompt: '  Base object prompt  ', notes: 'Keep notes verbatim' },
      { prompt: '   ' },
    ],
    faqs: [
      { q: '  Base question?  ', a: '  Base answer.  ' },
      { question: 'Incomplete question' },
    ],
    prompting: { source: 'base prompting' },
    decision: { source: 'base decision' },
  };
  const overlay: EngineOverlay = {
    seo: { title: 'Localized SEO title' },
    hero: { title: 'Localized hero title' },
    promptStructure: { title: 'Localized structure title' },
    prompts: [],
    faqs: [],
    prompting: { source: 'localized prompting' },
    decision: { source: 'localized decision' },
  };

  const localized = mergeEngineLocalizedContent(base, overlay);

  assert.deepEqual(localized.seo, {
    title: 'Localized SEO title',
    description: 'Base SEO description',
    image: '/base.jpg',
  });
  assert.deepEqual(localized.hero, {
    title: 'Localized hero title',
    intro: 'Base hero intro',
    badge: 'Base badge',
    ctaPrimary: undefined,
    secondaryLinks: undefined,
  });
  assert.deepEqual(localized.promptStructure, {
    title: 'Localized structure title',
    quote: 'Base quote',
    description: 'Base structure description',
    steps: ['Base step'],
  });
  assert.deepEqual(localized.prompts, [
    { title: 'Prompt 1', prompt: 'Base string prompt' },
    { title: 'Named prompt', prompt: 'Base object prompt', notes: 'Keep notes verbatim' },
  ]);
  assert.deepEqual(localized.faqs, [{ question: 'Base question?', answer: 'Base answer.' }]);
  assert.deepEqual(localized.prompting, { source: 'localized prompting' });
  assert.deepEqual(localized.decision, { source: 'localized decision' });
});

test('non-empty localized prompt and FAQ arrays are selected and normalized without base rescue', () => {
  const base: EngineOverlay = {
    prompts: ['Base prompt'],
    faqs: [{ q: 'Base question?', a: 'Base answer.' }],
  };
  const overlay: EngineOverlay = {
    prompts: [{ title: '  ', prompt: '  Local prompt  ' }, { prompt: '   ' }, '  Final prompt  '],
    faqs: [{ question: '  Local question? ', answer: ' Local answer.  ' }, { q: 'Incomplete' }],
  };

  const localized = mergeEngineLocalizedContent(base, overlay);

  assert.deepEqual(localized.prompts, [
    { title: 'Prompt 1', prompt: 'Local prompt', notes: undefined },
    { title: 'Prompt 3', prompt: 'Final prompt' },
  ]);
  assert.deepEqual(localized.faqs, [{ question: 'Local question?', answer: 'Local answer.' }]);

  assert.deepEqual(
    mergeEngineLocalizedContent(base, { prompts: [{ prompt: '   ' }], faqs: [{ q: 'Incomplete' }] }).prompts,
    [],
  );
});

test('production loader, converter, and parity test share the same localized-content merger', () => {
  const sourcePaths = [
    'frontend/lib/models/i18n.ts',
    'scripts/migrate-model-prompting-content.ts',
    'tests/model-prompting-legacy-projection.test.ts',
  ];

  for (const sourcePath of sourcePaths) {
    const source = readFileSync(join(PROJECT_ROOT, sourcePath), 'utf8');
    assert.match(source, /mergeEngineLocalizedContent\(base, overlay\)/, sourcePath);
  }

  for (const sourcePath of sourcePaths.slice(1)) {
    const source = readFileSync(join(PROJECT_ROOT, sourcePath), 'utf8');
    assert.doesNotMatch(source, /function readLocalizedContent/, sourcePath);
  }
});
