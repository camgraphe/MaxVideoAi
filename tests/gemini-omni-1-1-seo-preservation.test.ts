import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveRuntimePublicSlug } from '../frontend/config/model-runtime.ts';

const EXISTING_CANONICALS = [
  '/models/gemini-omni-flash',
  '/ai-video-engines/gemini-omni-flash-vs-veo-3-1',
  '/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast',
  '/ai-video-engines/gemini-omni-flash-vs-sora-2',
  '/ai-video-engines/gemini-omni-flash-vs-seedance-2-0',
] as const;

test('Gemini Omni Flash 1.1 preserves the existing canonical owner and aliases', () => {
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash')?.slug, 'gemini-omni-flash');
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash-1-1')?.slug, 'gemini-omni-flash');
  assert.equal(resolveRuntimePublicSlug('gemini-omni-flash-preview')?.slug, 'gemini-omni-flash');
  assert.equal(EXISTING_CANONICALS.some((path) => path.includes('/models/gemini-omni-flash-1-1')), false);
});

test('localized Gemini model copy upgrades in place without the former 720p-only contract', () => {
  for (const locale of ['en', 'fr', 'es']) {
    const raw = readFileSync(`content/models/${locale}/gemini-omni-flash.json`, 'utf8');
    assert.match(raw, /Gemini Omni Flash 1\.1/);
    assert.match(raw, /4K/);
    assert.doesNotMatch(raw, /gemini-omni-flash-preview|720p-only|720p only/i);
  }
});
