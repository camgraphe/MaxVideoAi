import assert from 'node:assert/strict';
import test from 'node:test';

import { getBaseEnginesByCategory } from '../frontend/src/lib/engines.ts';
import { getPublicConfiguredEnginesByCategory } from '../frontend/src/server/engines.ts';

test('public engines fall back to the base registry when DATABASE_URL is not configured', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const baseIds = getBaseEnginesByCategory('video').map((engine) => engine.id);
    const publicIds = (await getPublicConfiguredEnginesByCategory('video')).map((engine) => engine.id);
    assert.deepEqual(publicIds, baseIds);
  } finally {
    if (previousDatabaseUrl) {
      process.env.DATABASE_URL = previousDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }
});
