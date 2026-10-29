import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import type { Pool } from 'pg';

/** Prove that the application query is waiting on the competing transaction. */
export async function waitForPostgresBlock(pool: Pool, waitingPid: number, blockingPid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query<{ blocked: boolean }>(
      `SELECT wait_event_type = 'Lock' AND $2::integer = ANY(pg_blocking_pids(pid)) AS blocked
         FROM pg_stat_activity WHERE pid = $1`,
      [waitingPid, blockingPid],
    );
    if (rows[0]?.blocked) return;
    await setTimeout(10);
  }
  assert.fail(`PostgreSQL backend ${waitingPid} did not wait for backend ${blockingPid}`);
}
