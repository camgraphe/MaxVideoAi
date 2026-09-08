import assert from 'node:assert/strict';
import test from 'node:test';

import { connectedStudioError } from '../frontend/app/api/studio/_lib/studio-connected-route-utils';
import { StudioConnectedPersistenceError } from '../frontend/src/server/studio/montage-command';

test('connected Studio routes expose only bounded business errors', () => {
  assert.deepEqual(
    connectedStudioError(new Error('Invalid Studio workspace graph nodes.'), 'STUDIO_WORKSPACE_SAVE_FAILED'),
    { error: 'Invalid Studio workspace graph nodes.', status: 400 },
  );
  assert.deepEqual(
    connectedStudioError(new Error('MEDIA_NOT_AVAILABLE'), 'STUDIO_MEDIA_ACCESS_FAILED'),
    { error: 'MEDIA_NOT_AVAILABLE', status: 404 },
  );
  assert.deepEqual(
    connectedStudioError(new StudioConnectedPersistenceError('STUDIO_REVISION_CONFLICT', 409), 'STUDIO_WORKSPACE_SAVE_FAILED'),
    { error: 'STUDIO_REVISION_CONFLICT', status: 409 },
  );
});

test('unexpected storage and database details become opaque route-specific failures', () => {
  for (const unexpected of [
    new Error('duplicate key violates constraint studio_projects_user_id_key'),
    new Error('S3_SECRET_ACCESS_KEY=do-not-leak'),
    'driver threw a non-Error value',
  ]) {
    assert.deepEqual(
      connectedStudioError(unexpected, 'STUDIO_WORKSPACE_SAVE_FAILED'),
      { error: 'STUDIO_WORKSPACE_SAVE_FAILED', status: 500 },
    );
  }
});
