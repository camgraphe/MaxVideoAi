import { query, type QueryExecutor } from '@/lib/db';
import { ensureMcpSchema } from '@/lib/schema/mcp-schema';

export type McpAuditEvent = {
  eventType: 'connection_initialized' | 'tool_discovery' | 'tool_call' | 'grant_revoked';
  userId: string;
  oauthClientId: string | null;
  tool: string | null;
  outcome: 'success' | 'failure';
  surface: 'video' | 'image' | null;
  engineId: string | null;
  errorCode: string | null;
};

export type McpAuditDeps = {
  executor: QueryExecutor;
  ensureSchema(): Promise<void>;
};

const ALLOWED_KEYS = new Set<keyof McpAuditEvent>([
  'eventType',
  'userId',
  'oauthClientId',
  'tool',
  'outcome',
  'surface',
  'engineId',
  'errorCode',
]);
const SENSITIVE_KEY = /prompt|token|secret|reference.?url|payment/i;
const EVENT_TYPES = new Set<McpAuditEvent['eventType']>([
  'connection_initialized',
  'tool_discovery',
  'tool_call',
  'grant_revoked',
]);

const defaultDeps: McpAuditDeps = {
  executor: { query },
  ensureSchema: ensureMcpSchema,
};

function nullableBoundedString(value: unknown, maxLength = 256): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= maxLength);
}

function isMcpAuditEvent(value: unknown): value is McpAuditEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => SENSITIVE_KEY.test(key) || !ALLOWED_KEYS.has(key as keyof McpAuditEvent))) return false;
  if (keys.length !== ALLOWED_KEYS.size) return false;
  if (!EVENT_TYPES.has(record.eventType as McpAuditEvent['eventType'])) return false;
  if (typeof record.userId !== 'string' || record.userId.length < 1 || record.userId.length > 128) return false;
  if (!nullableBoundedString(record.oauthClientId)) return false;
  if (!nullableBoundedString(record.tool, 128)) return false;
  if (record.outcome !== 'success' && record.outcome !== 'failure') return false;
  if (record.surface !== null && record.surface !== 'video' && record.surface !== 'image') return false;
  if (!nullableBoundedString(record.engineId)) return false;
  if (!nullableBoundedString(record.errorCode, 128)) return false;
  return true;
}

export async function recordMcpEvent(
  input: McpAuditEvent,
  deps: McpAuditDeps = defaultDeps
): Promise<boolean> {
  if (!isMcpAuditEvent(input)) return false;
  try {
    await deps.ensureSchema();
    await deps.executor.query(
      `INSERT INTO mcp_audit_events (
        event_type, user_id, oauth_client_id, tool_name, outcome, surface, engine_id, error_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.eventType,
        input.userId,
        input.oauthClientId,
        input.tool,
        input.outcome,
        input.surface,
        input.engineId,
        input.errorCode,
      ]
    );
    return true;
  } catch {
    return false;
  }
}
