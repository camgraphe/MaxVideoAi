import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STORYBOARD_COPY,
  resolveStoryboardWorkspaceCopy,
} from '../frontend/src/components/tools/storyboard/_lib/storyboard-workspace-copy.ts';

test('storyboard workspace copy falls back to every default value', () => {
  assert.deepEqual(resolveStoryboardWorkspaceCopy(undefined), DEFAULT_STORYBOARD_COPY);
});

test('storyboard workspace copy applies a top-level localized override', () => {
  const copy = resolveStoryboardWorkspaceCopy({ title: 'Localized storyboarder' });

  assert.equal(copy.title, 'Localized storyboarder');
  assert.equal(copy.subtitle, DEFAULT_STORYBOARD_COPY.subtitle);
});

test('storyboard workspace copy preserves target-note defaults around a partial override', () => {
  const copy = resolveStoryboardWorkspaceCopy({
    targetNotes: { seedance: 'Localized Seedance note' },
  });

  assert.equal(copy.targetNotes.seedance, 'Localized Seedance note');
  assert.equal(copy.targetNotes.kling, DEFAULT_STORYBOARD_COPY.targetNotes.kling);
  assert.equal(copy.targetNotes.klingFallback, DEFAULT_STORYBOARD_COPY.targetNotes.klingFallback);
});

test('storyboard workspace copy preserves style defaults around a partial override', () => {
  const copy = resolveStoryboardWorkspaceCopy({
    styles: { anime: 'Localized anime' },
  });

  assert.equal(copy.styles.anime, 'Localized anime');
  assert.equal(copy.styles.realistic, DEFAULT_STORYBOARD_COPY.styles.realistic);
  assert.equal(copy.styles.ugc, DEFAULT_STORYBOARD_COPY.styles.ugc);
  assert.equal(copy.styles.cinema, DEFAULT_STORYBOARD_COPY.styles.cinema);
});
