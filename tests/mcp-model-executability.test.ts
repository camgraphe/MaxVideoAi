import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveAgentGenerationEngineExecutability } from '../frontend/src/server/agent-runtime/model-executability';

function getSeedreamEngine() {
  const engine = listFalEngines().find((entry) => entry.id === 'seedream')?.engine;
  assert.ok(engine, 'Seedream should be registered');
  return engine;
}

test('Seedream readiness is not evaluated as a Seedance video profile', () => {
  const seedreamEngine = getSeedreamEngine();
  const decision = resolveAgentGenerationEngineExecutability(seedreamEngine, {
    bytePlusEnabled: true,
    bytePlusApiKey: 'test-key',
  });
  assert.deepEqual(decision, { executable: true, reason: 'available' });
});

test('direct BytePlus models fail closed without the required credential', () => {
  const seedreamEngine = getSeedreamEngine();
  assert.equal(
    resolveAgentGenerationEngineExecutability(seedreamEngine, {
      bytePlusEnabled: true,
      bytePlusApiKey: '',
    }).reason,
    'provider_credentials_missing',
  );
});

test('malformed direct BytePlus configuration fails closed', () => {
  const malformedEngine = {
    ...getSeedreamEngine(),
    id: 'unrecognized-direct-model',
  };

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(malformedEngine, {
      bytePlusEnabled: true,
      bytePlusApiKey: 'test-key',
    }),
    { executable: false, reason: 'profile_invalid' },
  );
});
