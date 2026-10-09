import { readFileSync } from 'node:fs';
import type { PoolClient } from 'pg';
import { getDb } from '../../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './disposable-postgres';

export const tariffReaderActor = '11111111-1111-4111-8111-111111111111';
export const tariffSelectorKey = (selector: object) =>
  JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));

/** Captures commands sent to the real PG17 driver, without supplying query results. */
export async function withTariffReaderFixture<T>(work: (fixture: {
  database: Awaited<ReturnType<typeof startDisposablePostgres>>;
  commands: string[];
  beforeQuery?: (sql: string, client: PoolClient) => Promise<void>;
}) => Promise<T>): Promise<T> {
  const database = await startDisposablePostgres('selected-tariff-reader');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'production', PRICING_SANDBOX: '0' });
  const appPool = getDb();
  const fixture: Parameters<typeof work>[0] = { database, commands: [] };
  appPool.on('connect', client => {
    const query = client.query;
    client.query = (async function (this: PoolClient, ...args: unknown[]) {
      const sql = typeof args[0] === 'string' ? args[0] : (args[0] as { text: string }).text;
      await fixture.beforeQuery?.(sql, client);
      fixture.commands.push(sql);
      return Reflect.apply(query, this, args);
    }) as typeof client.query;
  });
  try {
    await createPaidGenerationTestSchema(database.pool);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    return await work(fixture);
  } finally {
    await appPool.end().catch(() => undefined);
    await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
