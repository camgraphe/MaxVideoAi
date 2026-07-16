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
  client_label: unknown;
  model: unknown;
  price_cents: unknown;
  currency: unknown;
  state: unknown;
  job_status: unknown;
  payment_status: unknown;
  event_at: unknown;
};

type GrantLabelRow = {
  clientId: string;
  clientLabel: string;
};

type Dependencies = { executor: QueryExecutor };

const defaultDependencies: Dependencies = { executor: { query } };
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const NON_PRINTABLE_PATTERN = /[\p{C}\p{Zl}\p{Zp}]/u;
const SAFE_JOB_STATUS_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
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

function normalizeResolvedClientLabel(value: unknown): string {
  if (typeof value !== 'string') return MCP_UNKNOWN_CLIENT_LABEL;
  const normalized = value.trim();
  return isBoundedText(normalized, 120) ? normalized : MCP_UNKNOWN_CLIENT_LABEL;
}

function buildGrantLabelRows(clientLabels: Readonly<Record<string, string>>): GrantLabelRow[] {
  const rows: GrantLabelRow[] = [];
  for (const clientId of Reflect.ownKeys(clientLabels)) {
    if (typeof clientId !== 'string'
      || !isBoundedText(clientId, 256)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(clientLabels, clientId);
    if (!descriptor?.enumerable || !('value' in descriptor) || typeof descriptor.value !== 'string') {
      continue;
    }
    const clientLabel = descriptor.value.trim();
    if (!isBoundedText(clientLabel, 120) || clientLabel === clientId) continue;
    rows.push({ clientId, clientLabel });
  }
  return rows;
}

function mapRow(
  row: McpActivityRow,
): McpActivityItem | null {
  const timestamp = finiteTimestamp(row.event_at);
  if (
    !isBoundedText(row.model, 256)
    || !Number.isSafeInteger(row.price_cents)
    || (row.price_cents as number) < 0
    || (row.price_cents as number) > 2_147_483_647
    || typeof row.currency !== 'string'
    || !CURRENCY_PATTERN.test(row.currency)
    || typeof row.state !== 'string'
    || !STATES.has(row.state as ActivityQuoteState)
    || (row.job_status !== null
      && (typeof row.job_status !== 'string' || !SAFE_JOB_STATUS_PATTERN.test(row.job_status)))
    || !timestamp
  ) return null;

  const state = row.state as ActivityQuoteState;
  const prepare = state === 'prepared' || state === 'expired';
  const failed = state === 'failed' || row.job_status === 'failed';
  const refunded = failed
    && typeof row.payment_status === 'string'
    && REFUNDED_PAYMENT_STATUSES.has(row.payment_status);
  const outcome: McpActivityItem['outcome'] = refunded ? 'refunded' : failed ? 'failed' : state;
  return {
    clientLabel: normalizeResolvedClientLabel(row.client_label),
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
  const grantLabels = buildGrantLabelRows(input.clientLabels);
  const rows = await dependencies.executor.query<McpActivityRow>(
    `SELECT COALESCE(grants."clientLabel", 'Connected application') AS client_label,
            q.request_json ->> 'engineId' AS model,
            q.price_cents,
            q.currency,
            q.state,
            j.status AS job_status,
            j.payment_status,
            CASE
              WHEN q.state = 'prepared' THEN q.created_at
              ELSE q.updated_at
            END AS event_at
       FROM mcp_generation_quotes q
       LEFT JOIN app_jobs j
         ON j.job_id = q.job_id
        AND j.user_id = q.user_id
       LEFT JOIN jsonb_to_recordset($2::jsonb) AS grants("clientId" TEXT, "clientLabel" TEXT)
         ON grants."clientId" = q.oauth_client_id
      WHERE q.user_id = $1
      ORDER BY event_at DESC, q.quote_id DESC
      LIMIT 20`,
    [input.userId, JSON.stringify(grantLabels)],
  );
  const items: McpActivityItem[] = [];
  for (const row of rows) {
    const item = mapRow(row);
    if (item) items.push(item);
    if (items.length >= MCP_ACTIVITY_LIMIT) break;
  }
  return items;
}
