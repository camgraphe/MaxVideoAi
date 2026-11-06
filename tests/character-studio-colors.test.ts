import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultCharacterBuilderState,
  getTraitOptionPrompt,
} from '../frontend/src/lib/character-builder';
import { normalizeStudioColor } from '../frontend/src/lib/character-studio-colors';
import { sanitizeRequest } from '../frontend/src/server/tools/character-builder/sanitize';
import { buildPrompt } from '../frontend/src/server/tools/character-builder/prompt';
import { buildSettingsSnapshot } from '../frontend/src/server/tools/character-builder/snapshot';
import { parseCharacterBuilderSnapshot } from '../frontend/src/components/tools/character-builder/_lib/character-builder-helpers';
import {
  findChoiceLabel,
  findChoiceSwatch,
} from '../frontend/src/components/tools/character-builder/_lib/character-builder-summary-helpers';
import { startNewCharacter } from '../frontend/src/components/tools/character-builder/_lib/character-studio-state';

const colorKeys = ['hairColor', 'eyeColor', 'skinTone'] as const;
const request = () => ({
  ...createDefaultCharacterBuilderState(),
  userId: 'fixture',
  action: 'generate' as const,
});

test('custom colors normalize short and full hex while rejecting unsupported color syntax', () => {
  assert.equal(normalizeStudioColor(' #a3f '), '#AA33FF');
  assert.equal(normalizeStudioColor('#4f46e5'), '#4F46E5');
  for (const value of [
    null,
    undefined,
    123,
    {},
    '',
    '#abcd',
    '#12345678',
    '#ghijkl',
    'red',
    'rgb(1,2,3)',
    'url(test)',
    '#123456;ignore',
  ]) {
    assert.equal(normalizeStudioColor(value), null);
  }
  assert.equal(getTraitOptionPrompt('faceCues', '#4F46E5'), null);
});

test('hair, iris and skin colors reach the prompt, survive reuse and can be replaced by a preset', () => {
  const presets = { hairColor: 'blonde', eyeColor: 'blue', skinTone: 'olive' };
  const targets = {
    hairColor: 'hair color',
    eyeColor: 'iris color',
    skinTone: 'skin or character surface color',
  };
  for (const key of colorKeys) {
    const input = request();
    input.traits[key] = { value: ' #a3f ', source: 'manual' };
    const sanitized = sanitizeRequest(input);
    assert.equal(sanitized.traits[key].value, '#AA33FF');
    const prompt = buildPrompt(sanitized);
    assert.ok(prompt.includes(`${targets[key]} #AA33FF`));
    const snapshot = buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i');
    assert.equal(parseCharacterBuilderSnapshot(snapshot)?.traits?.[key].value, '#AA33FF');
    assert.equal(findChoiceLabel([], '#AA33FF'), '#AA33FF');
    assert.equal(findChoiceSwatch([], '#AA33FF'), '#AA33FF');
    input.traits[key] = { value: presets[key], source: 'manual' };
    const presetPrompt = buildPrompt(sanitizeRequest(input));
    assert.ok(presetPrompt.includes(getTraitOptionPrompt(key, presets[key])!));
    assert.ok(!presetPrompt.includes('#AA33FF'));
    assert.equal(startNewCharacter(input).traits[key].value, request().traits[key].value);
  }
});

test('invalid custom colors are removed while presets and auto values stay compatible', () => {
  for (const key of colorKeys) {
    for (const value of ['#12', '#ffffff00', 'unexpected-color', 'url(https://example.com)']) {
      const input = request();
      input.traits[key] = { value, source: 'manual' };
      const sanitized = sanitizeRequest(input);
      assert.equal(sanitized.traits[key].value, null);
      assert.ok(!buildPrompt(sanitized).includes(value));
    }
    const input = request();
    input.traits[key] = { value: 'auto', source: 'auto' };
    assert.deepEqual(sanitizeRequest(input).traits[key], input.traits[key]);
  }
});

test('custom hair colors respect bald and free hairstyle overrides without losing their saved value', () => {
  const input = request();
  input.traits.hairColor = { value: '#4F46E5', source: 'manual' };
  input.traits.hairstyle = { value: 'bald', source: 'manual' };
  assert.ok(!buildPrompt(sanitizeRequest(input)).includes('#4F46E5'));
  input.traits.hairstyle = { value: 'short-crop', source: 'manual' };
  input.traits.customHairDescription = 'silver braids';
  const sanitized = sanitizeRequest(input);
  assert.equal(sanitized.traits.hairColor.value, '#4F46E5');
  assert.ok(buildPrompt(sanitized).includes('silver braids'));
  assert.ok(!buildPrompt(sanitized).includes('#4F46E5'));
});
