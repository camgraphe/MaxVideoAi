import assert from 'node:assert/strict';
import test from 'node:test';

import { getDb } from '../frontend/src/lib/db.ts';

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

test('database pool handles idle client errors without throwing an uncaught exception', async () => {
  process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/maxvideoai_pool_error_test';
  const pool = getDb();
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    assert.doesNotThrow(() => {
      pool.emit('error', Object.assign(new Error('simulated idle disconnect'), { code: '57P01' }));
    });
    assert.match(String(logged[0]?.[0] ?? ''), /database pool idle client error/i);
  } finally {
    console.error = originalConsoleError;
    await pool.end();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    }
  }
});
