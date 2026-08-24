import { query } from '@/lib/db';

// Paid, trial, reference-upload, and funnel tables are migration-owned.
// Runtime bootstrap intentionally covers audit only.
let schemaPromise: Promise<void> | null = null;

async function createMcpSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS mcp_audit_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      oauth_client_id TEXT,
      tool_name TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
      surface TEXT CHECK (surface IS NULL OR surface IN ('video', 'image')),
      engine_id TEXT,
      error_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS mcp_audit_events_user_created_idx
      ON mcp_audit_events (user_id, created_at DESC)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS mcp_audit_events_type_created_idx
      ON mcp_audit_events (event_type, created_at DESC)
  `);
}

export async function ensureMcpSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createMcpSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
