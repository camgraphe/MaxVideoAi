import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWorkspaceMultiPromptState,
  KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-multi-prompt-state';

test('workspace multi-prompt state uses the exact Kling provider scene prompt limit', () => {
  assert.equal(KLING_MULTI_PROMPT_SCENE_MAX_CHARS, 512);

  const valid = getWorkspaceMultiPromptState({
    active: true,
    scenes: [{ id: 'scene-1', prompt: 'x'.repeat(512), duration: 5 }],
    minDurationSec: 3,
    maxDurationSec: 15,
  });
  assert.equal(valid.invalid, false);
  assert.equal(valid.error, null);

  const invalid = getWorkspaceMultiPromptState({
    active: true,
    scenes: [{ id: 'scene-1', prompt: 'x'.repeat(513), duration: 5 }],
    minDurationSec: 3,
    maxDurationSec: 15,
  });
  assert.equal(invalid.invalid, true);
  assert.match(invalid.error ?? '', /1 character over the 512-character provider limit/i);
});
