import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const executeSource = readFileSync(join(root, 'frontend/src/server/images/execute-image-generation.ts'), 'utf8');
const dispatcherSource = readFileSync(join(root, 'frontend/src/server/images/image-direct-provider-execution.ts'), 'utf8');

test('Vertex image availability is checked before the atomic wallet charge', () => {
  const preflight = executeSource.indexOf('assertGoogleVertexImageAvailable');
  const walletCharge = executeSource.indexOf('await createAtomicInitialImageJob');
  assert.ok(preflight >= 0, 'Vertex image preflight should be called');
  assert.ok(walletCharge >= 0, 'atomic image job helper should remain present');
  assert.ok(preflight < walletCharge, 'Vertex image preflight must run before wallet reservation');
});

test('the direct image dispatcher selects Vertex and not the Gemini Developer API', () => {
  assert.match(dispatcherSource, /google_vertex_image/);
  assert.doesNotMatch(dispatcherSource, /google_gemini_image/);
  assert.doesNotMatch(dispatcherSource, /executeGoogleGeminiImageGeneration/);
});
