import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const signalSource = readFileSync(join(root, 'frontend/server/watch-page-signals/content.ts'), 'utf8');
const contentSource = readFileSync(
  join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx'),
  'utf8'
);

test('watch surfaces identify historical job cost as recorded render cost', () => {
  assert.match(signalSource, /label: 'Recorded render cost'/);
  assert.match(contentSource, /label: 'Recorded render cost'/);
  assert.doesNotMatch(signalSource, /label: 'Render cost'/);
  assert.doesNotMatch(contentSource, /label: 'Estimated price'/);
});

test('localized recorded-cost labels do not imply a live or estimated quote', () => {
  const expected = {
    en: 'Recorded render cost',
    fr: 'Coût enregistré du rendu',
    es: 'Coste registrado del render',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
      videoPage: { details: { priceTotalLabel: string } };
    };
    assert.equal(messages.videoPage.details.priceTotalLabel, expected[locale]);
  }
});
