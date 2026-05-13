import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { DEFAULT_ENGINE_GUIDE } from '../frontend/src/lib/engine-guides';

const root = process.cwd();
const locales = ['en', 'fr', 'es'] as const;

function readModel(locale: (typeof locales)[number]): unknown {
  const filePath = path.join(root, 'content/models', locale, 'veo-3-1-fast.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compactText(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

test('Veo 3.1 Fast localized model pages mention reference-to-video support', () => {
  for (const locale of locales) {
    const copy = compactText(readModel(locale));

    assert.match(copy, /reference|référence|referencia/i, `${locale} model page should mention reference images`);
    assert.match(copy, /1-4|1 à 4|1 a 4/i, `${locale} model page should mention the reference image range`);
    assert.match(copy, /8\s?s/i, `${locale} model page should mention the 8s reference workflow`);
  }
});

test('Veo 3.1 Fast engine guide mentions the unified reference mode', () => {
  const guide = DEFAULT_ENGINE_GUIDE['veo-3-1-fast'];
  const copy = compactText(guide);

  assert.match(copy, /reference/i);
  assert.ok(guide.badges.includes('Reference mode'));
});
