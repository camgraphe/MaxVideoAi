export const runtime = 'nodejs';

const REQUIRED_KEYS = ['terms', 'privacy', 'cookies'] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

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
      const result = await client.query<{ key: string; version: string }>(
        `select key, version from legal_documents where key = any($1::text[])`,
        [REQUIRED_KEYS]
      );

      const found = new Map<RequiredKey, string>();
      for (const row of result.rows) {
        if (REQUIRED_KEYS.includes(row.key as RequiredKey)) {
          found.set(row.key as RequiredKey, row.version);
        }
      }

      const missing = REQUIRED_KEYS.filter((key) => !found.has(key));
      const payload = {
        ok: missing.length === 0,
        documents: REQUIRED_KEYS.map((key) => ({
          key,
          version: found.get(key) ?? null,
        })),
      };
      const status = missing.length === 0 ? 200 : 500;
      return Response.json({ ...payload, missing }, { status });
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
