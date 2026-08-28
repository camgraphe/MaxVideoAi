import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { AgentApiError, toAgentApiFailure } from '../frontend/src/server/agent-api/errors';

const root = process.cwd();
const facadeDirectory = join(root, 'frontend/src/server/agent-api');

test('agent facade exposes a normalized OAuth principal and stable error contract', () => {
  const principalPath = join(facadeDirectory, 'principal.ts');
  const errorsPath = join(facadeDirectory, 'errors.ts');

  assert.equal(existsSync(principalPath), true);
  assert.equal(existsSync(errorsPath), true);

  const principalSource = readFileSync(principalPath, 'utf8');
  const errorsSource = readFileSync(errorsPath, 'utf8');

  assert.match(principalSource, /export type AgentPrincipal/);
  assert.match(principalSource, /authMethod:\s*'oauth'/);
  assert.match(errorsSource, /export type AgentApiErrorCode/);
  assert.match(errorsSource, /'CONFIRMATION_REQUIRED'/);
  assert.match(errorsSource, /'PROVIDER_REJECTED'/);
});

test('agent API errors produce transport-neutral safe failures', () => {
  const error = new AgentApiError('RATE_LIMITED', 'Try again shortly.', true, {
    retryAfterSeconds: 30,
  });

  assert.deepEqual(toAgentApiFailure(error), {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Try again shortly.',
      retryable: true,
      nextAction: { retryAfterSeconds: 30 },
    },
  });
});

test('agent facade types cover account, catalog, and recommendation results', () => {
  const typesSource = readFileSync(join(facadeDirectory, 'types.ts'), 'utf8');

  for (const exportedType of [
    'AgentApiResult',
    'AgentAccountStatus',
    'AgentModel',
    'AgentModelFilter',
    'AgentModelRecommendationInput',
    'AgentModelRecommendation',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${exportedType}\\b`));
  }
});

test('agent API stays independent from Next.js and MCP transport, with provider-neutral public contracts', () => {
  const files = readdirSync(facadeDirectory).filter((name) => name.endsWith('.ts'));
  assert.ok(files.length >= 4);

  for (const file of files) {
    const source = readFileSync(join(facadeDirectory, file), 'utf8');
    assert.doesNotMatch(source, /from ['"]next\/server['"]/);
    assert.doesNotMatch(source, /@modelcontextprotocol\/sdk/);
  }

  for (const file of ['principal.ts', 'errors.ts', 'types.ts', 'generation-types.ts', 'media-types.ts', 'reference-types.ts']) {
    const source = readFileSync(join(facadeDirectory, file), 'utf8');
    assert.doesNotMatch(source, /video-providers|fal-client|provider-client/);
  }
});
