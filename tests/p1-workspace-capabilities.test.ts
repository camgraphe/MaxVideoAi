import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry';
import {
  getP1WorkspaceExecutableModes,
  supportsWorkspaceMultiPrompt,
} from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';

function privateEngine(id: string) {
  const engine = UNPUBLISHED_FAL_ENGINE_REGISTRY.find((entry) => entry.id === id)?.engine;
  assert.ok(engine);
  return engine;
}

test('workspace derives Kling Turbo multi-shot UI from the engine schema', () => {
  for (const id of ['kling-3-turbo-standard', 'kling-3-turbo-pro']) {
    const engine = privateEngine(id);
    assert.equal(supportsWorkspaceMultiPrompt(engine, 't2v'), true);
    assert.equal(supportsWorkspaceMultiPrompt(engine, 'i2v'), true);
    assert.deepEqual(getP1WorkspaceExecutableModes(engine), ['t2v', 'i2v']);
  }
});

test('workspace keeps the complete Gemini 1.1 direct workflow, including private-interaction retake', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'gemini-omni-flash')?.engine;
  assert.ok(engine);
  assert.equal(engine.label, 'Gemini Omni Flash 1.1');
  assert.deepEqual(getP1WorkspaceExecutableModes(engine), [
    't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'retake',
  ]);
});

test('workspace keeps H3 Max media modes absent rather than rendering disabled controls', () => {
  const engine = privateEngine('minimax-h3-max');
  assert.deepEqual(getP1WorkspaceExecutableModes(engine), ['t2v']);
  assert.equal(supportsWorkspaceMultiPrompt(engine, 't2v'), false);
});

test('composer gates multi-shot and Kling-only controls independently', () => {
  const source = readFileSync(
    'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx',
    'utf8',
  );
  assert.match(source, /supportsWorkspaceMultiPrompt\(selectedEngine, submissionMode\)/);
  assert.match(source, /showMultiPrompt && field\.id === 'multi_prompt'/);
  assert.match(source, /showKlingV3Controls=\{supportsKlingV3Controls && !isKlingTurbo\}/);
  assert.match(source, /!isKlingTurbo[\s\S]*<KlingElementsBuilder/);
});
