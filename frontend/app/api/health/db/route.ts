export const runtime = 'nodejs';

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return Response.json({ ok: false, error: 'DATABASE_URL missing' }, { status: 500 });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{ ok: number }>('SELECT 1 as ok');
      return Response.json({ ok: result.rows?.[0]?.ok === 1 });
    } finally {
      client.release();
    }
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}
