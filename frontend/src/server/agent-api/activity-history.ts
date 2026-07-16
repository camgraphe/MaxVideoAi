import { query, type QueryExecutor } from '@/lib/db';

export const MCP_ACTIVITY_LIMIT = 20;
export const MCP_UNKNOWN_CLIENT_LABEL = 'Connected application';

export type McpActivityItem = {
  clientLabel: string;
  tool: 'prepare_generation' | 'confirm_generation';
  model: string;
  amountCents: number;
  currency: string;
  outcome: 'prepared' | 'expired' | 'claimed' | 'accepted' | 'failed' | 'refunded';
  timestamp: string;
};

export type McpActivityHistoryInput = {
  userId: string;
  clientLabels: Readonly<Record<string, string>>;
};

type McpActivityRow = {
  quote_id: unknown;
  oauth_client_id: unknown;
  model: unknown;
  price_cents: unknown;
  currency: unknown;
  state: unknown;
  payment_status: unknown;
  event_at: unknown;
};

type Dependencies = { executor: QueryExecutor };

const defaultDependencies: Dependencies = { executor: { query } };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const NON_PRINTABLE_PATTERN = /[\p{C}\p{Zl}\p{Zp}]/u;
type ActivityQuoteState = 'prepared' | 'expired' | 'claimed' | 'accepted' | 'failed';
const STATES = new Set<ActivityQuoteState>(['prepared', 'expired', 'claimed', 'accepted', 'failed']);
const REFUNDED_PAYMENT_STATUSES = new Set(['refunded', 'refunded_wallet']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim()
    && !NON_PRINTABLE_PATTERN.test(value);
}

function finiteTimestamp(value: unknown): string | null {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  return value instanceof Date || value === iso ? iso : null;
}

function clientLabel(
  oauthClientId: unknown,
  clientLabels: Readonly<Record<string, string>>,
): string {
  if (typeof oauthClientId !== 'string') return MCP_UNKNOWN_CLIENT_LABEL;
  const descriptor = Object.getOwnPropertyDescriptor(clientLabels, oauthClientId);
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    return MCP_UNKNOWN_CLIENT_LABEL;
  }
  const raw = descriptor.value;
  if (typeof raw !== 'string') return MCP_UNKNOWN_CLIENT_LABEL;
  const normalized = raw.trim();
  return isBoundedText(normalized, 120) ? normalized : MCP_UNKNOWN_CLIENT_LABEL;
}

function mapRow(
  row: McpActivityRow,
  clientLabels: Readonly<Record<string, string>>,
): McpActivityItem | null {
  const timestamp = finiteTimestamp(row.event_at);
  if (
    typeof row.quote_id !== 'string'
    || !UUID_PATTERN.test(row.quote_id)
    || !isBoundedText(row.model, 256)
    || !Number.isSafeInteger(row.price_cents)
    || (row.price_cents as number) < 0
    || (row.price_cents as number) > 2_147_483_647
    || typeof row.currency !== 'string'
    || !CURRENCY_PATTERN.test(row.currency)
    || typeof row.state !== 'string'
    || !STATES.has(row.state as ActivityQuoteState)
    || !timestamp
  ) return null;

  const state = row.state as ActivityQuoteState;
  const prepare = state === 'prepared' || state === 'expired';
  const outcome: McpActivityItem['outcome'] = state === 'failed' && typeof row.payment_status === 'string'
    && REFUNDED_PAYMENT_STATUSES.has(row.payment_status)
    ? 'refunded'
    : state;
  return {
    clientLabel: clientLabel(row.oauth_client_id, clientLabels),
    tool: prepare ? 'prepare_generation' : 'confirm_generation',
    model: row.model,
    amountCents: row.price_cents as number,
    currency: row.currency,
    outcome,
    timestamp,
  };
}

export async function listMcpActivityHistory(
  input: McpActivityHistoryInput,
  dependencies: Dependencies = defaultDependencies,
): Promise<McpActivityItem[]> {
  if (!isRecord(input)
    || !isBoundedText(input.userId, 128)
    || !isRecord(input.clientLabels)) {
    throw new Error('Invalid MCP activity history input.');
  }
  const rows = await dependencies.executor.query<McpActivityRow>(
    `SELECT q.quote_id,
            q.oauth_client_id,
            q.request_json ->> 'engineId' AS model,
            q.price_cents,
            q.currency,
            q.state,
            j.payment_status,
            CASE
              WHEN q.state = 'prepared' THEN q.created_at
              ELSE q.updated_at
            END AS event_at
       FROM mcp_generation_quotes q
       LEFT JOIN app_jobs j
         ON j.job_id = q.job_id
        AND j.user_id = q.user_id
      WHERE q.user_id = $1
      ORDER BY event_at DESC, q.quote_id DESC
      LIMIT 20`,
    [input.userId],
  );
  const items: McpActivityItem[] = [];
  for (const row of rows) {
    const item = mapRow(row, input.clientLabels);
    if (item) items.push(item);
    if (items.length >= MCP_ACTIVITY_LIMIT) break;
  }
  return items;
}
