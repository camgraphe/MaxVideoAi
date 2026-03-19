import { Pool } from 'pg';

let pool: Pool | null = null;
let activeConnectionString: string | null = null;

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

export async function query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>) {
  const client = await getDb().connect();
  try {
    const res = await client.query<TRecord>(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}
