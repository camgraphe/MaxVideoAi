import assert from 'node:assert/strict';
import test from 'node:test';
import { digestEditorialDraft, parseEditorialDraft } from '../frontend/lib/editorial/schema.ts';
import { makeEditorialDraft as validDraft } from './fixtures/editorial-draft.ts';

test('accepts six controlled blocks and yields a stable digest', () => {
  const parsed = parseEditorialDraft(validDraft());
  assert.equal(parsed.locales.en.blocks.length, 6);
  assert.match(digestEditorialDraft(parsed), /^[a-f0-9]{64}$/);
  const reordered = { ...validDraft(), locales: { es: validDraft().locales.es, en: validDraft().locales.en, fr: validDraft().locales.fr } };
  assert.equal(digestEditorialDraft(parsed), digestEditorialDraft(parseEditorialDraft(reordered)));
});

test('rejects unknown blocks and unsafe links', () => {
  const unknown = validDraft();
  (unknown.locales.en.blocks as any[]).push({ id: 'run', type: 'script', code: 'alert(1)' });
  assert.throws(() => parseEditorialDraft(unknown));

  const unsafe = validDraft();
  (unsafe.locales.fr.blocks[5] as any).cta.href = 'javascript:alert(1)';
  assert.throws(() => parseEditorialDraft(unsafe));
});

test('rejects absent localized alt or caption and unlicensed assets', () => {
  const noAlt = validDraft();
  (noAlt.locales.es.blocks[1] as any).alt = '';
  assert.throws(() => parseEditorialDraft(noAlt));

  const noRights = validDraft();
  (noRights.assets[0] as any).rights = 'unknown';
  assert.throws(() => parseEditorialDraft(noRights));
});

test('requires referenced sources and consistent block IDs across locales', () => {
  const missingSource = validDraft();
  (missingSource.locales.en.blocks[0] as any).paragraphs[0].sourceIds = ['missing'];
  assert.throws(() => parseEditorialDraft(missingSource));

  const mismatched = validDraft();
  mismatched.locales.fr.blocks[0].id = 'different';
  assert.throws(() => parseEditorialDraft(mismatched));
});

test('requires a dated trend scan and explicit MaxVideoAI topic fit', () => {
  const draft: any = validDraft();
  draft.research = {
    scannedAt: '2026-09-18T12:00:00Z',
    queries: ['AI video storyboard shot list'],
    signals: [{ platform: 'reddit', url: 'https://www.reddit.com/r/aifilmmaking/comments/example/', observedAt: '2026-09-18', author: 'creator', title: 'How do I plan shots?', summary: 'Asks for a practical storyboard to shot list workflow.', relevance: 4 }],
    existingArticleSlugs: ['change-camera-angle-with-ai'],
    recommendation: 'new',
    productFit: { path: '/tools', rationale: 'The workflow leads naturally to MaxVideoAI production tools.' },
  };
  assert.ok(parseEditorialDraft(draft).research.signals.length === 1);
  const missing = structuredClone(draft);
  delete missing.research;
  assert.throws(() => parseEditorialDraft(missing));
});

test('trend shortlist selects exactly the article topic', () => {
  const draft: any = validDraft();
  draft.research.candidates = [
    { topicKey: draft.topicKey, title: 'Shot list workflow', lane: 'creator-workflows', score: 5, decision: 'selected', evidenceUrls: ['https://example.org/shot-list'], existingArticleSlugs: [], productPath: '/tools', rationale: 'A practical workflow with product fit.' },
    { topicKey: 'camera-angle-update', title: 'Camera angle update', lane: 'editing', score: 3, decision: 'update', evidenceUrls: ['https://example.org/shot-list'], existingArticleSlugs: ['change-camera-angle-with-ai'], productPath: '/tools', rationale: 'Existing article covers most of the topic.' },
  ];
  assert.equal(parseEditorialDraft(draft).research.candidates?.length, 2);
  draft.research.candidates[0].decision = 'hold';
  assert.throws(() => parseEditorialDraft(draft));
});

test('allows controlled bold text and links without HTML', () => {
  const rich: any = validDraft();
  rich.locales.en.blocks[0].paragraphs[0] = {
    spans: [
      { text: 'Plan the ' },
      { text: 'shot', bold: true },
      { text: ' in MaxVideoAI', href: '/tools' },
    ],
    sourceIds: ['s1'],
  };
  const parsed = parseEditorialDraft(rich);
  assert.equal(parsed.locales.en.blocks[0].type, 'text');
  assert.equal((parsed.locales.en.blocks[0] as any).paragraphs[0].spans.map((span: { text: string }) => span.text).join(''), 'Plan the shot in MaxVideoAI');
  rich.locales.en.blocks[0].paragraphs[0].spans[2].href = 'javascript:alert(1)';
  assert.throws(() => parseEditorialDraft(rich));
});


test('storyboards preserve localized panels and reject ambiguous or unsafe input', () => {
  const draft: any = validDraft();
  for (const locale of ['en', 'fr', 'es']) {
    draft.locales[locale].blocks[1] = { id: 'visual', type: 'media', assetId: draft.assets[0].id, heading: 'Three shots', presentation: 'storyboard', caption: 'Generated concepts', panels: [1,2,3].map(n => ({title: `Shot ${n}`, alt: `View ${n}`, caption: `Concept ${n}`})) };
    delete draft.locales[locale].blocks[5].cta;
  }
  assert.equal((parseEditorialDraft(draft).locales.es.blocks[1] as any).panels.length, 3);
  draft.locales.fr.blocks[1].panels.pop();
  assert.throws(() => parseEditorialDraft(draft));
});

test('preserves source citations on prompts and accepts the reviewed keyword set', () => {
  const draft = validDraft();
  for (const locale of ['en','fr','es'] as const) {
    (draft.locales[locale].blocks.find(b => b.type === 'prompt') as any).sourceIds = [draft.sources[0].id];
    draft.locales[locale].keywords = Array.from({length:10}, (_, i) => `workflow ${i}`);
  }
  assert.equal(parseEditorialDraft(draft).locales.en.keywords.length,10);
  (draft.locales.en.blocks.find(b => b.type === 'prompt') as any).sourceIds = ['unknown'];
  assert.throws(() => parseEditorialDraft(draft), /Unknown source/);
});
