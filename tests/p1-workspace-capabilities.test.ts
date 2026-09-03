import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry';
import { supportsWorkspaceMultiPrompt } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';

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
    assert.deepEqual(engine.modes, ['t2v', 'i2v']);
  }
});

test('workspace keeps the complete Gemini 1.1 direct workflow, including private-interaction retake', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'gemini-omni-flash')?.engine;
  assert.ok(engine);
  assert.equal(engine.label, 'Gemini Omni Flash 1.1');
  assert.deepEqual(engine.modes, [
    't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'retake',
  ]);
});

test('workspace derives P1 controls from projected modes and schemas without model-id branches', () => {
  const paths = [
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts',
    'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx',
    'frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts',
    'frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload.ts',
  ];
  const sources = paths.map((path) => readFileSync(path, 'utf8'));
  const composer = sources[1]!;
  assert.match(composer, /supportsWorkspaceMultiPrompt\(selectedEngine, submissionMode\)/);
  assert.match(composer, /showMultiPrompt && field\.id === 'multi_prompt'/);
  assert.match(composer, /showKlingV3Controls=\{supportsKlingV3Controls\}/);
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /kling-3-turbo|minimax-h3-max/, paths[index]);
  }
});
