import { query } from '@/lib/db';

let ensureEmailPromise: Promise<void> | null = null;

export async function ensureEmailSchema(): Promise<void> {
  if (ensureEmailPromise) return ensureEmailPromise;

  const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS email_events (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      recipient TEXT,
      provider_id TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS email_events_recipient_idx ON email_events (recipient);
  `);
  };

  ensureEmailPromise = ensure().catch((error) => {
  ensureEmailPromise = null;
  console.error('[schema] Failed to ensure email schema', error);
  throw error;
  });

  await ensureEmailPromise;
}
