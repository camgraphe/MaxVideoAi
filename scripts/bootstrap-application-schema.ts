const target = process.env.APPLICATION_DATABASE_URL?.trim();

if (!target) {
  throw new Error(
    'APPLICATION_DATABASE_URL is required; inherited DATABASE_URL values are intentionally ignored.',
  );
}

let parsed: URL;
try {
  parsed = new URL(target);
} catch {
  throw new Error('APPLICATION_DATABASE_URL must be a valid PostgreSQL URL.');
}

if (
  (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
  || !parsed.username
  || !parsed.hostname
  || parsed.pathname === '/'
) {
  throw new Error('APPLICATION_DATABASE_URL must identify a user, host, and database.');
}

const hostname = parsed.hostname.toLowerCase();
const isDirectNeon = hostname.endsWith('.neon.tech') && !/(^|\.)[^.]*-pooler(\.|$)/.test(hostname);
const allowLocalPostgresTest =
  process.env.NODE_ENV === 'test'
  && process.argv.includes('--allow-local-postgres-test')
  && (hostname === 'localhost' || hostname === '127.0.0.1');

if (!isDirectNeon && !allowLocalPostgresTest) {
  throw new Error('Application schema bootstrap requires an explicit direct Neon target.');
}

async function main(): Promise<void> {
  process.env.DATABASE_URL = target;

  const {
    ensureAssetSchema,
    ensureBillingSchema,
    ensureEmailSchema,
    ensureMcpSchema,
    ensureMediaLibrarySchema,
  } = await import('../frontend/src/lib/schema.ts');
  const { getDb } = await import('../frontend/src/lib/db.ts');

  try {
    await ensureBillingSchema();
    await ensureAssetSchema();
    await ensureMediaLibrarySchema();
    await ensureEmailSchema();
    await ensureMcpSchema();
    console.info(
      `Application schema bootstrap completed for host=${hostname} database=${decodeURIComponent(parsed.pathname.slice(1))}.`,
    );
  } finally {
    await getDb().end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
