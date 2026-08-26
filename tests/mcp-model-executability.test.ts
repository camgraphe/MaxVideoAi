import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  resolveAgentGenerationEngineExecutability,
  type AgentGenerationExecutabilityEnvironment,
} from '../frontend/src/server/agent-runtime/model-executability';

function getSeedreamEngine() {
  const engine = listFalEngines().find((entry) => entry.id === 'seedream')?.engine;
  assert.ok(engine, 'Seedream should be registered');
  return engine;
}

function getH3Engine() {
  const engine = listFalEngines().find((entry) => entry.id === 'minimax-h3')?.engine;
  assert.ok(engine, 'MiniMax H3 should be registered');
  return engine;
}

function getEngine(id: string) {
  const engine = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(engine, `${id} should be registered`);
  return engine;
}

function environment(
  overrides: Partial<AgentGenerationExecutabilityEnvironment> = {},
): AgentGenerationExecutabilityEnvironment {
  return {
    bytePlusEnabled: false,
    bytePlusApiKey: '',
    falApiKey: '',
    providerEnv: {},
    ...overrides,
  };
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

test('Fal-backed H3 is executable only when the effective Fal credential exists', () => {
  const h3 = getH3Engine();
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(h3, {
      bytePlusEnabled: true,
      bytePlusApiKey: 'test-byteplus-key',
      falApiKey: '',
    }),
    { executable: false, reason: 'provider_credentials_missing' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(h3, {
      bytePlusEnabled: true,
      bytePlusApiKey: 'test-byteplus-key',
      falApiKey: 'test-fal-key',
    }),
    { executable: true, reason: 'available' },
  );
});

test('direct video providers require their own effective credentials', () => {
  const cases = [
    {
      id: 'kling-3-pro',
      flags: {
        KLING_DIRECT_ENABLED: 'true',
        KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
        KLING_DIRECT_ADMIN_ONLY: 'false',
      },
      credentials: { KLING_ACCESS_KEY: 'access', KLING_SECRET_KEY: 'secret' },
    },
    {
      id: 'luma-ray-3-2',
      flags: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'true',
        LUMA_AGENTS_ADMIN_ONLY: 'false',
      },
      credentials: { LUMA_AGENTS_API_KEY: 'luma-key' },
    },
    {
      id: 'veo-3-1',
      flags: {
        GOOGLE_VERTEX_VEO_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'false',
      },
      credentials: {
        GOOGLE_VERTEX_PROJECT_ID: 'project',
        GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"key"}',
      },
    },
    {
      id: 'gemini-omni-flash',
      flags: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'false',
      },
      credentials: {
        GOOGLE_VERTEX_OMNI_PROJECT_ID: 'project',
        GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"key"}',
      },
    },
  ] as const;

  for (const item of cases) {
    const engine = getEngine(item.id);
    assert.deepEqual(
      resolveAgentGenerationEngineExecutability(engine, environment({ providerEnv: item.flags })),
      { executable: false, reason: 'provider_credentials_missing' },
      `${item.id} must fail closed without direct credentials`,
    );
    assert.deepEqual(
      resolveAgentGenerationEngineExecutability(engine, environment({
        providerEnv: { ...item.flags, ...item.credentials },
      })),
      { executable: true, reason: 'available' },
      `${item.id} must not require Fal when its direct route is ready`,
    );
  }
});

test('Google image models follow their forced direct provider instead of Fal readiness', () => {
  const engine = getEngine('nano-banana-2');
  const googleCredentials = {
    GOOGLE_VERTEX_PROJECT_ID: 'project',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"key"}',
    GOOGLE_VERTEX_INPUT_GCS_URI: 'gs://maxvideoai-inputs/images',
  };

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: '',
      providerEnv: googleCredentials,
    })),
    { executable: true, reason: 'available' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: 'fal-key',
      providerEnv: {},
    })),
    { executable: false, reason: 'provider_credentials_missing' },
  );
});

test('Luma image models use direct readiness when enabled and Fal otherwise', () => {
  const engine = getEngine('luma-uni-1');
  const directFlags = {
    LUMA_AGENTS_ENABLED: 'true',
    LUMA_AGENTS_IMAGE_DIRECT_ENABLED: 'true',
    LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'true',
    LUMA_AGENTS_ADMIN_ONLY: 'false',
  };

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: '',
      providerEnv: { ...directFlags, LUMA_AGENTS_API_KEY: 'luma-key' },
    })),
    { executable: true, reason: 'available' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: 'fal-key',
      providerEnv: directFlags,
    })),
    { executable: false, reason: 'provider_credentials_missing' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: 'fal-key',
      providerEnv: { LUMA_AGENTS_ENABLED: 'false' },
    })),
    { executable: true, reason: 'available' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine, environment({
      falApiKey: '',
      providerEnv: { LUMA_AGENTS_ENABLED: 'false' },
    })),
    { executable: false, reason: 'provider_credentials_missing' },
  );
});
