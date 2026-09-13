import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStudioGenerationMode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/studio-generation-mode';

test('Studio is Live by default and production can never enable the local test simulation', () => {
  assert.equal(resolveStudioGenerationMode({ nodeEnv: 'development', testSimulation: null }), 'real');
  assert.equal(resolveStudioGenerationMode({ nodeEnv: 'development', testSimulation: '1' }), 'mock');
  assert.equal(resolveStudioGenerationMode({ nodeEnv: 'test', testSimulation: '1' }), 'mock');
  assert.equal(resolveStudioGenerationMode({ nodeEnv: 'production', testSimulation: '1' }), 'real');
});
