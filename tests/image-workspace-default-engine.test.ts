import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_IMAGE_WORKSPACE_ENGINE_ID,
  sortImageWorkspaceEngineOptions,
} from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-engine-options.ts';

test('image workspace promotes Seedream as the default engine option', () => {
  const engines = [
    { id: 'nano-banana', label: 'Nano Banana' },
    { id: 'gpt-image-2', label: 'GPT Image 2' },
    { id: 'seedream', label: 'Seedream' },
  ];

  const sorted = sortImageWorkspaceEngineOptions(engines);

  assert.equal(DEFAULT_IMAGE_WORKSPACE_ENGINE_ID, 'seedream');
  assert.deepEqual(
    sorted.map((engine) => engine.id),
    ['seedream', 'nano-banana', 'gpt-image-2']
  );
});

test('image workspace preserves catalog order after preferred engines', () => {
  const engines = [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }];

  assert.deepEqual(sortImageWorkspaceEngineOptions(engines), engines);
});
