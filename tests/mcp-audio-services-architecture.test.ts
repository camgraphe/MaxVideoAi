import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Audio MCP prepare and confirm stay focused and are not publicly registered by Task 2', () => {
  const prepare = read('frontend/src/server/agent-api/prepare-audio-generation.ts');
  const confirm = read('frontend/src/server/agent-api/confirm-audio-generation.ts');
  const server = read('frontend/src/server/mcp/server.ts');

  assert.doesNotMatch(prepare, /createInitialAudioJobInExecutor|executeReservedAudioRun|reserveWalletCharge/);
  assert.match(prepare, /prepareRun\(audioRequestToGenerationBody/);
  assert.match(prepare, /insertPreparedQuote/);
  assert.match(confirm, /confirmationTransaction/);
  assert.ok(confirm.indexOf('await confirmationTransaction') < confirm.indexOf('await dependencies.executeRun'));
  assert.match(confirm, /buildReservation: buildAudioRunReservation/);
  assert.match(confirm, /reserveInitialJob: .*createInitialAudioJobInExecutor/);
  assert.doesNotMatch(server, /prepare_audio_generation|confirm_audio_generation|list_audio_capabilities/);
});

test('Audio reference resolution accepts only exact owned assets and completed job outputs', () => {
  const resolver = read('frontend/src/server/agent-api/audio-reference-assets.ts');
  assert.match(resolver, /o\.id = \$1/);
  assert.match(resolver, /o\.job_id = \$2/);
  assert.match(resolver, /o\.user_id = \$3/);
  assert.match(resolver, /j\.status = 'completed'/);
  assert.match(resolver, /COALESCE\(o\.storage_url, o\.url\) AS original_url/);
  assert.doesNotMatch(resolver, /fetch\(|inspectSourceVideo|ensure.*Schema/);
});
