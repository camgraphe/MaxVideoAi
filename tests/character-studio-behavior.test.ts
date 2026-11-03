import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCharacterBuilderState, getTraitOptionPrompt } from '../frontend/src/lib/character-builder';
import { STUDIO_CLOTHING, STUDIO_HAIR, STUDIO_EYES, STUDIO_SCENES } from '../frontend/src/lib/character-studio-catalog';
import { startNewCharacter, applyCharacterInspiration } from '../frontend/src/components/tools/character-builder/_lib/character-studio-state';
import { sanitizeRequest } from '../frontend/src/server/tools/character-builder/sanitize';
import { buildPrompt } from '../frontend/src/server/tools/character-builder/prompt';
import { buildSettingsSnapshot } from '../frontend/src/server/tools/character-builder/snapshot';
import { parseCharacterBuilderSnapshot } from '../frontend/src/components/tools/character-builder/_lib/character-builder-helpers';

function request() {
  return { ...createDefaultCharacterBuilderState(), userId: 'fixture', action: 'generate' as const };
}

test('every visible hair and clothing choice resolves into a supported generation prompt', () => {
  for (const item of STUDIO_HAIR) assert.ok(getTraitOptionPrompt('hairstyle', item.id), item.id);
  for (const item of STUDIO_CLOTHING) assert.ok(getTraitOptionPrompt('outfitStyle', item.id), item.id);
  for (const id of ['luxury', 'sci-fi', 'fantasy', 'tactical']) assert.ok(getTraitOptionPrompt('outfitStyle', id));
  assert.equal(STUDIO_HAIR.length, 12);
  assert.equal(STUDIO_CLOTHING.length, 8);
});

test('eye and scene choices survive sanitization, prompt compilation and snapshot reuse', () => {
  for (const eye of STUDIO_EYES) {
    const input = request();
    input.traits.eyeShape = { value: eye.id, source: 'manual' };
    input.traits.sceneId = 'comfy_cafe';
    const sanitized = sanitizeRequest(input);
    const prompt = buildPrompt(sanitized);
    assert.ok(prompt.includes(eye.prompt));
    assert.ok(prompt.includes('cozy cafe interior'));
    assert.ok(!prompt.includes('Use a clean neutral studio background'));
    const snapshot = buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i');
    const restored = parseCharacterBuilderSnapshot(snapshot);
    assert.equal(restored?.traits?.eyeShape?.value, eye.id);
    assert.equal(restored?.traits?.sceneId, 'comfy_cafe');
  }
});

test('unknown catalogue IDs are discarded and legacy requests retain neutral studio behavior', () => {
  const input = request();
  input.traits.sceneId = 'untrusted-id';
  input.traits.eyeShape = { value: 'untrusted-id', source: 'manual' };
  const sanitized = sanitizeRequest(input);
  assert.equal(sanitized.traits.sceneId, null);
  assert.equal(sanitized.traits.eyeShape?.value, null);
  assert.ok(buildPrompt(sanitized).includes('Use a clean neutral studio background'));
  delete input.traits.eyeShape;
  delete input.traits.sceneId;
  assert.doesNotThrow(() => buildPrompt(sanitizeRequest(input)));
});

test('each scene compiles without conflicting neutral-background instructions even on a sheet', () => {
  for (const scene of STUDIO_SCENES) {
    const input = request();
    input.outputMode = 'character-sheet';
    input.traits.sceneId = scene.id;
    const prompt = buildPrompt(sanitizeRequest(input));
    assert.ok(prompt.includes(scene.prompt));
    assert.ok(!prompt.includes('neutral background'));
    assert.ok(!prompt.includes('neutral studio background'));
  }
});

test('new character and inspirations preserve completed runs without retaining old identity references', () => {
  const previous = request();
  previous.advancedNotes = 'Old character details';
  previous.referenceImages = [{ id: 'private-image', url: 'https://example.com/private.png', role: 'identity' }];
  previous.sourceMode = 'reference-image';
  previous.selectedResultId = 'old-result';
  const next = startNewCharacter(previous);
  assert.equal(next.runs, previous.runs);
  assert.equal(next.refinementHistory, previous.refinementHistory);
  assert.equal(next.sourceMode, 'scratch');
  assert.equal(next.selectedResultId, null);
  assert.equal(next.advancedNotes, '');
  assert.deepEqual(next.referenceImages, []);
  const alba = applyCharacterInspiration(previous, 'Alba');
  assert.equal(alba.runs, previous.runs);
  assert.equal(alba.traits.hairstyle.value, 'wavy-bob');
  assert.deepEqual(alba.referenceImages, []);
  assert.equal(previous.advancedNotes, 'Old character details');
  assert.equal(applyCharacterInspiration(previous, 'missing'), previous);
});

test('a bald choice does not compile stale hair color or length into a contradictory prompt', () => {
  const input = request();
  input.traits.hairstyle = { value: 'bald', source: 'manual' };
  input.traits.hairColor = { value: 'red', source: 'manual' };
  input.traits.hairLength = { value: 'long', source: 'manual' };
  const prompt = buildPrompt(sanitizeRequest(input));
  assert.ok(prompt.includes('bald head without hair'));
  assert.ok(!prompt.includes('red hair'));
  assert.ok(!prompt.includes('long hair length'));
});
