import assert from 'node:assert/strict';
import test from 'node:test';

import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import {
  startStudioAuthFixture,
  STUDIO_FIXTURE_NON_ADMIN,
  STUDIO_FIXTURE_OWNERS,
} from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture } from './helpers/studio-connected-fixture-data';

test('connected Studio fixture grants admin access to both owners but not the member identity', async (t) => {
  assert.equal(missingDisposablePostgresCommand(), null, 'Disposable PostgreSQL commands are required.');

  const database = await startDisposablePostgres('studio-admin-fixture');
  t.after(() => database.cleanup());
  const auth = await startStudioAuthFixture();
  t.after(() => auth.close());

  await initializeStudioConnectedFixture(database);

  const seededAdmins = await database.pool.query<{ user_id: string }>(
    'SELECT user_id FROM app_admins ORDER BY user_id',
  );
  assert.deepEqual(
    seededAdmins.rows.map((row) => row.user_id),
    [...STUDIO_FIXTURE_OWNERS],
  );

  for (const owner of STUDIO_FIXTURE_OWNERS) {
    assert.equal(auth.createSession(owner).user.id, owner);
  }
  assert.equal(auth.createSession(STUDIO_FIXTURE_NON_ADMIN).user.id, STUDIO_FIXTURE_NON_ADMIN);
  assert.equal(
    seededAdmins.rows.some((row) => row.user_id === STUDIO_FIXTURE_NON_ADMIN),
    false,
  );
});
