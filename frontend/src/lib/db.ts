import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;
let activeConnectionString: string | null = null;

export type QueryExecutor = {
  query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]>;
};

function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL ?? '').trim();
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl().length > 0;
}

export function getDb() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!pool || activeConnectionString !== connectionString) {
    if (pool) {
      void pool.end().catch(() => {
        // Ignore stale pool shutdown failures.
      });
    }
    pool = new Pool({ connectionString });
    activeConnectionString = connectionString;
  }
  return pool;
}

export function createQueryExecutor(client: Pick<PoolClient, 'query'>): QueryExecutor {
  return {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>) {
      const res = await client.query<TRecord>(text, params);
      return res.rows;
    },
  };
}

export async function query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>) {
  const client = await getDb().connect();
  try {
    return await createQueryExecutor(client).query<TRecord>(text, params);
  } finally {
    client.release();
  }
}

export async function withDbTransaction<TResult>(
  callback: (executor: QueryExecutor, client: PoolClient) => Promise<TResult>
): Promise<TResult> {
  const client = await getDb().connect();
  const executor = createQueryExecutor(client);

  try {
    await client.query('BEGIN');
    const result = await callback(executor, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
