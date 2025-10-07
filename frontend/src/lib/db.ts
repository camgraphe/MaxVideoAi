import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString: url });
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
