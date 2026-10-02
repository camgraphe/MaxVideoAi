import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { formatCurrentExamplePrice } from '../frontend/lib/current-example-price-display';

const root = process.cwd();
const signalSource = readFileSync(join(root, 'frontend/server/watch-page-signals/content.ts'), 'utf8');
const contentSource = readFileSync(join(root, 'frontend/components/examples/ExampleReaderContent.tsx'), 'utf8');

test('public watch surfaces use current quotes and omit historical charges', () => {
  assert.doesNotMatch(signalSource, /Recorded render cost|finalPriceCents/);
  assert.match(contentSource, /price\(quote\.amountCents, quote\.currency\)/);
  assert.match(contentSource, /copy\.current/);
  assert.doesNotMatch(contentSource, /Recorded render cost|finalPriceCents|detail\.historicalCost/);
});

test('unavailable current quotes omit a numeric price even when the historical render had a charge', () => {
  assert.equal(formatCurrentExamplePrice({ kind: 'unavailable', reason: 'unsupported_scenario' }, 'en'), null);
  assert.match(contentSource, /detail\.quotes\.length \? <div/);
});

test('localized public cost labels describe the current model price', () => {
  const expected = { en: 'Current model price', fr: 'Tarif actuel du modèle', es: 'Precio actual del modelo' };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8'));
    assert.equal(messages.videoPage.details.priceTotalLabel, expected[locale]);
  }
});
