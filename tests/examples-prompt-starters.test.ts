import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesPromptStarters } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';

const video = (id: string, engineIconId: string, engineLabel: string) => ({
  id, engineIconId, engineLabel, href: `/video/${id}`, prompt: 'Exact public excerpt…', promptFull: 'Full prompt stays in the reader',
  durationSec: 10, aspectRatio: '16:9', hasAudio: true, priceLabel: '$9.99',
});

test('family prompt shortcuts reuse distinct versions from the current SSR page', () => {
  const page = [video('new', 'ltx-2-5-fast', 'LTX 2.5 Fast'), video('old', 'ltx-2-3', 'LTX 2.3 Pro'), video('other', 'seedance-2-5', 'Seedance 2.5')];
  const sources = page.map(item => ({ id: item.id, promptExcerpt: item.prompt }));
  const selected = buildExamplesPromptStarters('ltx', page, sources);
  assert.deepEqual(selected.map(item => item.engineLabel), ['LTX 2.5 Fast', 'LTX 2.3 Pro']);
  assert.equal(selected[1].prompt, page[1].prompt);
  assert.equal(selected[1].href, page[1].href);
  assert.equal(selected[1].durationSec, page[1].durationSec);
  assert.equal(selected[1].aspectRatio, page[1].aspectRatio);
  assert.ok(selected.every(item => !('promptFull' in item) && !('priceLabel' in item)), 'no duplicated full prompts or unrelated new-generation prices');
  assert.deepEqual(buildExamplesPromptStarters('ltx', [], sources), []);
  assert.deepEqual(buildExamplesPromptStarters('wan', page, sources), []);
  assert.deepEqual(buildExamplesPromptStarters('seedance', page, sources).map(item => item.href), ['/video/other']);
});

test('localized gallery captions cannot replace the actual public prompt in a shortcut', () => {
  const card = { ...video('new', 'ltx-2-5-fast', 'LTX 2.5 Fast'), prompt: 'Exemple LTX 2.5 Fast · 10 s · 16:9' };
  const source = { id: card.id, prompt: 'A single continuous action shot with soft daylight and a steady camera.', promptExcerpt: '' };
  const [starter] = buildExamplesPromptStarters('ltx', [card], [source]);
  assert.equal(starter.prompt, source.prompt);
  assert.notEqual(starter.prompt, card.prompt);
  assert.deepEqual(buildExamplesPromptStarters('ltx', [card], [{ ...source, prompt: '' }]), [], 'do not invent a prompt for missing source text');
  const [long] = buildExamplesPromptStarters('ltx', [card], [{ ...source, prompt: 'public '.repeat(1000) }]);
  assert.equal(long.prompt.split(' ').length, 18, 'full source text remains outside the shortcut');
});
