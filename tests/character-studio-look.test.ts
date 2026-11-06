import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import { bindStudioLookRequest, buildStudioLookDraft } from '../frontend/src/lib/character-studio-look';
import { startNewCharacter } from '../frontend/src/components/tools/character-builder/_lib/character-studio-state';
import { sanitizeRequest } from '../frontend/src/server/tools/character-builder/sanitize';
import { buildSettingsSnapshot } from '../frontend/src/server/tools/character-builder/snapshot';
import { buildPrompt } from '../frontend/src/server/tools/character-builder/prompt';
import { parseCharacterBuilderSnapshot } from '../frontend/src/components/tools/character-builder/_lib/character-builder-helpers';
import type { StudioCharacter } from '../frontend/types/character-studio';

const base = createDefaultCharacterBuilderState();
base.traits.eyeColor = { value: 'green', source: 'manual' };
base.traits.characterType = { value: 'alien', source: 'manual' };
const identitySnapshot = buildSettingsSnapshot(
  { ...base, action: 'generate' },
  'original',
  'fixture',
  'Fixture',
  't2i',
);
const character: StudioCharacter = {
  id: '12',
  name: 'Alba',
  identity: {
    jobId: 'source-job',
    imageUrl: 'https://example.invalid/original.png',
    thumbUrl: 'https://example.invalid/thumbnail.png',
    settingsSnapshot: identitySnapshot,
  },
  looks: [],
  nextLookCursor: null,
  lookCount: 0,
  createdAt: '',
};

test('a new look uses the original saved identity while preserving history', () => {
  const previous = createDefaultCharacterBuilderState();
  previous.advancedNotes = 'old unrelated instructions';
  const draft = buildStudioLookDraft(previous, character);
  assert.equal(draft.characterId, '12');
  assert.equal(draft.referenceImages[0].url, character.identity.imageUrl);
  assert.equal(draft.sourceMode, 'reference-image');
  assert.equal(draft.referenceStrength, 'strong');
  assert.equal(draft.consistencyMode, 'strict');
  assert.equal(draft.runs, previous.runs);
  assert.equal(draft.advancedNotes, '');
  assert.equal(startNewCharacter(draft).characterId ?? null, null);
});

test('server binding rejects replacement identity traits and stale URLs but permits styling', () => {
  const request = {
    ...createDefaultCharacterBuilderState(),
    userId: 'owner',
    action: 'generate' as const,
    characterId: '12',
    selectedResultUrl: 'https://example.invalid/wrong.png',
    pinnedReferenceResultUrl: 'https://example.invalid/wrong.png',
  };
  request.traits.eyeColor.value = 'blue';
  request.traits.outfitStyle.value = 'business';
  request.traits.hairColor.value = '#FF00AA';
  request.traits.customSceneDescription = 'A warm cafe';
  const bound = bindStudioLookRequest(request, character);
  const normalized = sanitizeRequest(bound);
  assert.equal(normalized.traits.eyeColor.value, 'green');
  assert.equal(normalized.traits.characterType?.value, 'alien');
  assert.equal(normalized.traits.outfitStyle.value, 'business');
  assert.equal(normalized.traits.hairColor.value, '#FF00AA');
  assert.equal(normalized.traits.customSceneDescription, 'A warm cafe');
  assert.equal(normalized.selectedResultUrl, null);
  assert.equal(normalized.pinnedReferenceResultUrl, null);
  assert.equal(normalized.referenceImages[0].url, character.identity.imageUrl);
  assert.match(buildPrompt(normalized), /saved character identity/i);
  const snapshot = buildSettingsSnapshot(normalized, 'look prompt', 'fixture', 'Fixture', 'i2i');
  assert.equal(snapshot.builder.characterId, '12');
  assert.equal(parseCharacterBuilderSnapshot(snapshot)?.characterId, '12');
});

test('legacy settings reuse explicitly leaves the previous look context', () => {
  assert.equal(parseCharacterBuilderSnapshot(identitySnapshot)?.characterId, null);
});
