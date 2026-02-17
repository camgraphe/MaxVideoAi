import assert from 'node:assert/strict';
import test from 'node:test';

import { dedupeAltsInList, deriveShortPromptLabel, getImageAlt } from '../frontend/lib/image-alt';

test('getImageAlt returns non-empty localized alt', () => {
  const en = getImageAlt({
    kind: 'renderThumb',
    engine: 'Sora 2',
    label: 'City skyline at golden hour',
    locale: 'en',
  });
  const fr = getImageAlt({
    kind: 'engineLogo',
    engine: 'Kling 3',
    locale: 'fr',
  });
  const es = getImageAlt({
    kind: 'uiShot',
    label: 'Composer and gallery',
    locale: 'es',
  });

  assert.ok(en.length > 0);
  assert.ok(fr.toLowerCase().includes('logo'));
  assert.ok(es.toLowerCase().includes('interfaz'));
});

test('getImageAlt strips undefined and clamps to 140 chars', () => {
  const veryLong = 'undefined '.repeat(8) + 'A cinematic shot '.repeat(20);
  const alt = getImageAlt({
    kind: 'renderThumb',
    engine: 'Veo 3.1',
    label: veryLong,
    locale: 'en',
  });

  assert.equal(alt.toLowerCase().includes('undefined'), false);
  assert.ok(alt.length <= 140);
});

test('deriveShortPromptLabel removes noisy params', () => {
  const label = deriveShortPromptLabel('Wide 16:9 cinematic ad shot, seed=42, fps=24, ar=16:9, product launch on table.');
  assert.equal(label.toLowerCase().includes('seed'), false);
  assert.equal(label.toLowerCase().includes('fps'), false);
  assert.ok(label.length <= 60);
});

test('dedupeAltsInList appends stable suffixes for duplicates', () => {
  const out = dedupeAltsInList([
    { id: 'a', alt: 'Sora 2 AI video example: rainy city', locale: 'en', index: 0 },
    { id: 'b', alt: 'Sora 2 AI video example: rainy city', locale: 'en', tag: 'drone', index: 1 },
    { id: 'c', alt: 'Sora 2 AI video example: rainy city', locale: 'en', index: 2 },
  ]);

  assert.equal(out.get('a'), 'Sora 2 AI video example: rainy city');
  assert.equal(out.get('b'), 'Sora 2 AI video example: rainy city (drone)');
  assert.equal(out.get('c'), 'Sora 2 AI video example: rainy city (Example 3)');
});
