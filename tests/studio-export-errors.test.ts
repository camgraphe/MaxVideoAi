import test from 'node:test';
import assert from 'node:assert/strict';
import { asStudioExportAgentError } from '../frontend/src/server/studio/conversation-export-command';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';

test('export errors distinguish missing jobs from temporarily unavailable connected storage', () => {
  const missing = asStudioExportAgentError(new Error('EXPORT_NOT_FOUND'));
  assert.ok(missing instanceof AgentApiError);
  assert.equal(missing.code, 'REFERENCE_NOT_FOUND');
  assert.equal(missing.retryable, false);
  const unavailable = asStudioExportAgentError(new Error('STUDIO_CONNECTED_SCHEMA_UNAVAILABLE'));
  assert.ok(unavailable instanceof AgentApiError);
  assert.equal(unavailable.code, 'RATE_LIMITED');
  assert.equal(unavailable.retryable, true);
});
