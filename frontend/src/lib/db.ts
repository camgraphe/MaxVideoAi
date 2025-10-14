import { Pool } from 'pg';

const DATABASE_URL = (process.env.DATABASE_URL ?? '').trim();
const DATABASE_CONFIGURED = DATABASE_URL.length > 0;

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return DATABASE_CONFIGURED;
}

export function getDb() {
  if (!DATABASE_CONFIGURED) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
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
