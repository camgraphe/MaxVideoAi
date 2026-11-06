import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCharacterBuilderState, getTraitOptionPrompt } from '../frontend/src/lib/character-builder';
import { STUDIO_CLOTHING, STUDIO_HAIR, STUDIO_EYES, STUDIO_SCENES, STUDIO_CHARACTER_TYPES } from '../frontend/src/lib/character-studio-catalog';
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

test('character type is whitelisted, compiled and retained when a generation is reused', () => {
  const input = request();
  input.traits.characterType = { value: 'exaggerated', source: 'manual' };
  const sanitized = sanitizeRequest(input);
  const prompt = buildPrompt(sanitized);
  assert.ok(prompt.includes('deliberately exaggerated unusual human facial proportions'));
  const snapshot = buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i');
  assert.equal(parseCharacterBuilderSnapshot(snapshot)?.traits?.characterType?.value, 'exaggerated');
  input.traits.characterType = {value:'untrusted-type',source:'manual'};
  assert.equal(sanitizeRequest(input).traits.characterType?.value,null);
  delete input.traits.characterType;
  assert.doesNotThrow(()=>buildPrompt(sanitizeRequest(input)));
});

test('custom scene directions work alone or with a preset and survive settings reuse', () => {
  for (const outputMode of ['portrait-reference', 'character-sheet'] as const) {
    for (const sceneId of [null, 'comfy_cafe']) {
      const input = request();
      input.outputMode = outputMode;
      input.traits.sceneId = sceneId;
      input.traits.customSceneDescription = '  A quiet rooftop at night, warm lanterns and light rain  ';
      const sanitized = sanitizeRequest(input);
      const prompt = buildPrompt(sanitized);
      assert.ok(prompt.includes('A quiet rooftop at night, warm lanterns and light rain'));
      assert.ok(!prompt.includes('neutral studio background'));
      assert.ok(prompt.includes('Keep the environment consistent across every view.'));
      if (sceneId) {
        assert.ok(prompt.includes('cozy cafe interior'));
        assert.ok(prompt.includes('taking priority over any conflicting preset details'));
      }
      const restored = parseCharacterBuilderSnapshot(buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i'));
      assert.equal(restored?.traits?.customSceneDescription, 'A quiet rooftop at night, warm lanterns and light rain');
      assert.equal(restored?.traits?.sceneId, sceneId);
      assert.equal(startNewCharacter(input).traits.customSceneDescription, '');
    }
  }
});

test('scene description length is bounded and blank or legacy input retains the background fallback', () => {
  const input = request();
  input.traits.customSceneDescription = 'x'.repeat(1100);
  assert.equal(sanitizeRequest(input).traits.customSceneDescription?.length, 1000);
  input.traits.customSceneDescription = ' \n ';
  assert.ok(buildPrompt(sanitizeRequest(input)).includes('Use a clean neutral studio background'));
  delete input.traits.customSceneDescription;
  assert.ok(buildPrompt(sanitizeRequest(input)).includes('Use a clean neutral studio background'));
});

test('all character types survive sanitation, prompt compilation and settings reuse', () => {
  for (const type of STUDIO_CHARACTER_TYPES) {
    const input = request();
    input.traits.characterType = { value: type.id, source: 'manual' };
    const sanitized = sanitizeRequest(input);
    const prompt = buildPrompt(sanitized);
    assert.ok(prompt.includes(type.prompt), type.id);
    const snapshot = buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i');
    assert.equal(parseCharacterBuilderSnapshot(snapshot)?.traits?.characterType?.value, type.id);
  }
});

test('custom character concepts replace presets, preserve other choices and reset with a new draft', () => {
  for (const typeId of ['natural', 'alien', null]) {
    const input = request();
    input.traits.characterType = { value: typeId, source: 'manual' };
    input.traits.customCharacterDescription = '  A sunflower character with petals around its face  ';
    input.traits.customOutfitDescription = 'a linen jacket';
    input.traits.customSceneDescription = 'a moonlit garden';
    const sanitized = sanitizeRequest(input);
    const prompt = buildPrompt(sanitized);
    assert.ok(prompt.includes('A sunflower character with petals around its face'));
    assert.ok(prompt.includes('a linen jacket'));
    assert.ok(prompt.includes('a moonlit garden'));
    assert.ok(prompt.includes('concept takes priority'));
    for (const preset of STUDIO_CHARACTER_TYPES) assert.ok(!prompt.includes(preset.prompt));
    const snapshot = buildSettingsSnapshot(sanitized, prompt, 'fixture-engine', 'Fixture', 't2i');
    assert.equal(parseCharacterBuilderSnapshot(snapshot)?.traits?.customCharacterDescription, 'A sunflower character with petals around its face');
    assert.equal(startNewCharacter(input).traits.customCharacterDescription, '');
    assert.equal(applyCharacterInspiration(input, 'Alba').traits.customCharacterDescription, '');
  }
});

test('nonhuman portraits, sheets and repairs avoid imposing human skin or anatomy, including reference mode', () => {
  for (const type of STUDIO_CHARACTER_TYPES.filter((entry) => entry.nonHuman)) {
    for (const outputMode of ['portrait-reference', 'character-sheet'] as const) {
      for (const action of ['generate', 'full-body-fix', 'lighting-variant'] as const) {
        const input = { ...request(), outputMode, action, sourceMode: 'reference-image' as const };
        input.referenceImages = [{ id: 'fixture', url: 'https://example.com/portrait.png', role: 'identity' }];
        input.referenceStrength = 'strong';
        input.selectedResultUrl = 'https://example.com/selected-character.png';
        input.traits.characterType = { value: type.id, source: 'manual' };
        input.traits.hairstyle = { value: 'short-crop', source: 'manual' };
        input.outputOptions.includeCloseUps = true;
        const prompt = buildPrompt(sanitizeRequest(input));
        assert.ok(prompt.includes('only where compatible'));
        assert.ok(prompt.includes('Transform the reference into the requested character concept'));
        assert.ok(!prompt.includes('readable skin texture'));
        assert.ok(!prompt.includes('realistic anatomy'));
        assert.ok(!prompt.includes('ankles, and feet'));
      }
    }
  }
});

test('custom character input is bounded and blank or old requests retain the human preset behavior', () => {
  const input = request();
  input.traits.characterType = { value: 'natural', source: 'manual' };
  input.traits.customCharacterDescription = 'x'.repeat(1100);
  assert.equal(sanitizeRequest(input).traits.customCharacterDescription?.length, 1000);
  for (const value of [' \n ', undefined]) {
    input.traits.customCharacterDescription = value;
    const prompt = buildPrompt(sanitizeRequest(input));
    assert.ok(prompt.includes('natural balanced human facial proportions'));
    assert.ok(prompt.includes('readable skin texture'));
    assert.ok(!prompt.includes('concept takes priority'));
  }
});
