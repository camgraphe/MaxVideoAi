import { createHash } from 'node:crypto';

import { query, type QueryExecutor } from '@/lib/db';

export {
  approveMcpOAuthConnectionBinding,
  bindAuthenticatedMcpConnection,
  createMcpOAuthApprovalBinding,
  MCP_CONNECTION_BINDING_WINDOW_SECONDS,
  type McpConnectionBindingResult,
} from '@/server/agent-api/mcp-oauth-funnel';

export type McpFunnelStage =
  | 'oauth_connected'
  | 'trial_prepared'
  | 'trial_completed'
  | 'wallet_funded'
  | 'first_paid_generation'
  | 'repeat_paid_generation';

export type McpFunnelEventType =
  | 'landing_cta_clicked'
  | 'oauth_connection_started'
  | 'oauth_connection_completed'
  | 'oauth_connection_revoked'
  | 'trial_quote_prepared'
  | 'trial_generation_accepted'
  | 'trial_generation_completed'
  | 'trial_generation_released'
  | 'trial_generation_blocked'
  | 'topup_handoff_created'
  | 'wallet_funded'
  | 'paid_quote_prepared'
  | 'paid_generation_accepted'
  | 'paid_generation_completed'
  | 'paid_generation_failed'
  | 'tool_called'
  | 'tool_failed';

export type McpFunnelSource = 'mcp_landing' | 'direct_mcp';
export type McpFunnelClient = 'chatgpt' | 'claude' | 'codex' | 'other';

export type McpFunnelEvent = {
  eventType: McpFunnelEventType;
  stage: McpFunnelStage | null;
  occurredAt: Date;
  userId: string | null;
  oauthClientId: string | null;
  acquisitionId: string | null;
  quoteId: string | null;
  jobId: string | null;
  amountCents: number | null;
  currency: string | null;
  source: McpFunnelSource;
  medium: 'owned' | 'mcp';
  campaign: 'mcp_connect' | 'none';
  client: McpFunnelClient;
  idempotencyKey: string;
  receiptHash: string | null;
};

type FunnelDeps = { executor: QueryExecutor };

const defaultDeps: FunnelDeps = { executor: { query } };
const ACQUISITION_ID_PATTERN = /^acq_[A-Za-z0-9_-]{24}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const POSITIVE_PG_BIGINT_PATTERN = /^[1-9]\d{0,18}$/;
const MAX_PG_BIGINT = '9223372036854775807';
const RECEIPT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9:_-]+$/;
const EVENT_KEYS = new Set<keyof McpFunnelEvent>([
  'eventType', 'stage', 'occurredAt', 'userId', 'oauthClientId', 'acquisitionId', 'quoteId',
  'jobId', 'amountCents', 'currency', 'source', 'medium', 'campaign', 'client',
  'idempotencyKey', 'receiptHash',
]);
const EVENT_TYPES = new Set<McpFunnelEventType>([
  'landing_cta_clicked', 'oauth_connection_started', 'oauth_connection_completed',
  'oauth_connection_revoked', 'trial_quote_prepared', 'trial_generation_accepted',
  'trial_generation_completed', 'trial_generation_released', 'trial_generation_blocked',
  'topup_handoff_created', 'wallet_funded', 'paid_quote_prepared', 'paid_generation_accepted',
  'paid_generation_completed', 'paid_generation_failed', 'tool_called', 'tool_failed',
]);
const STAGES = new Set<McpFunnelStage>([
  'oauth_connected', 'trial_prepared', 'trial_completed', 'wallet_funded',
  'first_paid_generation', 'repeat_paid_generation',
]);
const EVENT_STAGE: Partial<Record<McpFunnelEventType, McpFunnelStage | readonly McpFunnelStage[]>> = {
  oauth_connection_completed: 'oauth_connected',
  trial_quote_prepared: 'trial_prepared',
  trial_generation_completed: 'trial_completed',
  wallet_funded: 'wallet_funded',
  paid_generation_completed: ['first_paid_generation', 'repeat_paid_generation'],
};
const AMOUNT_EVENTS = new Set<McpFunnelEventType>([
  'trial_quote_prepared', 'paid_quote_prepared', 'wallet_funded',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: Set<string>): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function boundedNullable(value: unknown, maxLength: number): value is string | null {
  return value === null
    || (typeof value === 'string' && value.length >= 1 && value.length <= maxLength && value === value.trim());
}

function stageMatches(eventType: McpFunnelEventType, stage: McpFunnelStage | null): boolean {
  const expected = EVENT_STAGE[eventType];
  if (!expected) return stage === null;
  return Array.isArray(expected) ? expected.includes(stage as McpFunnelStage) : stage === expected;
}

function attributionMatches(event: McpFunnelEvent): boolean {
  if (event.source === 'mcp_landing') {
    return event.medium === 'owned'
      && event.campaign === 'mcp_connect'
      && (event.client === 'chatgpt' || event.client === 'claude' || event.client === 'codex')
      && typeof event.acquisitionId === 'string'
      && ACQUISITION_ID_PATTERN.test(event.acquisitionId);
  }
  return event.medium === 'mcp'
    && event.campaign === 'none'
    && event.client === 'other'
    && event.acquisitionId === null;
}

function isMcpFunnelEvent(value: unknown): value is McpFunnelEvent {
  if (!isPlainRecord(value) || !hasExactKeys(value, EVENT_KEYS as Set<string>)) return false;
  const event = value as McpFunnelEvent;
  if (!EVENT_TYPES.has(event.eventType)) return false;
  if (event.stage !== null && !STAGES.has(event.stage)) return false;
  if (!stageMatches(event.eventType, event.stage)) return false;
  if (!(event.occurredAt instanceof Date) || !Number.isFinite(event.occurredAt.getTime())) return false;
  if (!boundedNullable(event.userId, 128) || !boundedNullable(event.oauthClientId, 256)) return false;
  if (!boundedNullable(event.acquisitionId, 28) || !attributionMatches(event)) return false;
  if (!boundedNullable(event.quoteId, 36) || (event.quoteId !== null && !UUID_PATTERN.test(event.quoteId))) return false;
  if (!boundedNullable(event.jobId, 256)) return false;
  if (!boundedNullable(event.idempotencyKey, 256) || !IDEMPOTENCY_PATTERN.test(event.idempotencyKey)) return false;
  if (!boundedNullable(event.receiptHash, 64)
    || (event.receiptHash !== null && !RECEIPT_HASH_PATTERN.test(event.receiptHash))) return false;
  const hasAmount = event.amountCents !== null || event.currency !== null;
  if (hasAmount) {
    if (!Number.isSafeInteger(event.amountCents) || (event.amountCents as number) < 0) return false;
    if (typeof event.currency !== 'string' || !CURRENCY_PATTERN.test(event.currency)) return false;
    if (!AMOUNT_EVENTS.has(event.eventType)) return false;
  }
  if ((event.amountCents === null) !== (event.currency === null)) return false;
  if (event.eventType === 'wallet_funded') {
    if (!event.amountCents || event.receiptHash === null) return false;
  } else if (event.receiptHash !== null) return false;
  if (event.eventType === 'landing_cta_clicked') {
    if (event.acquisitionId === null) return false;
  } else if (event.userId === null) return false;
  if (event.eventType === 'oauth_connection_started'
    && (event.oauthClientId === null || event.source !== 'mcp_landing')) return false;
  return true;
}

export async function recordMcpFunnelEvent(
  input: McpFunnelEvent,
  deps: FunnelDeps = defaultDeps,
): Promise<boolean> {
  if (!isMcpFunnelEvent(input)) return false;
  try {
    const rows = await deps.executor.query<{ id: number }>(
      `INSERT INTO mcp_funnel_events (
        event_type, stage, occurred_at, user_id, oauth_client_id, acquisition_id, quote_id,
        job_id, amount_cents, currency, source, medium, campaign, acquisition_client,
        idempotency_key, receipt_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      RETURNING id`,
      [
        input.eventType, input.stage, input.occurredAt, input.userId, input.oauthClientId,
        input.acquisitionId, input.quoteId, input.jobId, input.amountCents, input.currency,
        input.source, input.medium, input.campaign, input.client, input.idempotencyKey,
        input.receiptHash,
      ],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export type McpFunnelSummaryConfig = {
  from: Date;
  to: Date;
  conversionWindowSeconds: number;
  timeZone: 'UTC';
};

type FunnelSummaryRow = {
  event_type: McpFunnelEventType;
  stage: McpFunnelStage | null;
  user_id: string | null;
  occurred_at: string | Date;
  source: McpFunnelSource;
  acquisition_client: McpFunnelClient;
  acquisition_id: string | null;
};

export type McpFunnelCohortSummary = {
  source: McpFunnelSource;
  client: McpFunnelClient;
  completedTrialUsers: number;
  fundedAfterTrialUsers: number;
  trialToWalletRate: number | null;
};

export type McpFunnelSummary = {
  window: {
    from: string;
    to: string;
    conversionWindowSeconds: number;
    timeZone: 'UTC';
  };
  stages: Record<McpFunnelStage, number>;
  completedTrialUsers: number;
  fundedAfterTrialUsers: number;
  trialToWalletRate: number | null;
  cohorts: McpFunnelCohortSummary[];
};

function eventTime(value: string | Date): number | null {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function assertSummaryConfig(config: McpFunnelSummaryConfig): void {
  if (config.timeZone !== 'UTC'
    || !Number.isFinite(config.from.getTime())
    || !Number.isFinite(config.to.getTime())
    || config.from >= config.to
    || !Number.isSafeInteger(config.conversionWindowSeconds)
    || config.conversionWindowSeconds <= 0
    || config.conversionWindowSeconds > 365 * 24 * 60 * 60) {
    throw new Error('Invalid MCP funnel summary window.');
  }
}

function summarizeRows(rows: FunnelSummaryRow[], config: McpFunnelSummaryConfig): McpFunnelSummary {
  const from = config.from.getTime();
  const to = config.to.getTime();
  const conversionWindowMs = config.conversionWindowSeconds * 1000;
  const stageUsers = new Map<McpFunnelStage, Set<string>>();
  for (const stage of STAGES) stageUsers.set(stage, new Set());

  const firstTrialByUser = new Map<string, { time: number; source: McpFunnelSource; client: McpFunnelClient }>();
  const fundingByUser = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const time = eventTime(row.occurred_at);
    if (time === null) continue;
    if (row.stage && STAGES.has(row.stage) && time >= from && time < to) {
      stageUsers.get(row.stage)?.add(row.user_id);
    }
    if (row.event_type === 'trial_generation_completed' && row.stage === 'trial_completed'
      && time >= from && time < to) {
      const previous = firstTrialByUser.get(row.user_id);
      if (!previous || time < previous.time) {
        firstTrialByUser.set(row.user_id, {
          time,
          source: row.source === 'mcp_landing' ? 'mcp_landing' : 'direct_mcp',
          client: row.source === 'mcp_landing'
            ? row.acquisition_client === 'chatgpt'
              ? 'chatgpt'
              : row.acquisition_client === 'codex'
                ? 'codex'
                : 'claude'
            : 'other',
        });
      }
    }
    if (row.event_type === 'wallet_funded' && row.stage === 'wallet_funded') {
      const times = fundingByUser.get(row.user_id) ?? [];
      times.push(time);
      fundingByUser.set(row.user_id, times);
    }
  }

  const convertedUsers = new Set<string>();
  const cohorts = new Map<string, McpFunnelCohortSummary>();
  for (const [userId, trial] of firstTrialByUser) {
    const converted = (fundingByUser.get(userId) ?? []).some(
      (fundedAt) => fundedAt > trial.time && fundedAt <= trial.time + conversionWindowMs,
    );
    if (converted) convertedUsers.add(userId);
    const key = `${trial.source}:${trial.client}`;
    const cohort = cohorts.get(key) ?? {
      source: trial.source,
      client: trial.client,
      completedTrialUsers: 0,
      fundedAfterTrialUsers: 0,
      trialToWalletRate: null,
    };
    cohort.completedTrialUsers += 1;
    if (converted) cohort.fundedAfterTrialUsers += 1;
    cohorts.set(key, cohort);
  }
  const cohortSummaries = [...cohorts.values()]
    .map((cohort) => ({
      ...cohort,
      trialToWalletRate: cohort.completedTrialUsers === 0
        ? null
        : cohort.fundedAfterTrialUsers / cohort.completedTrialUsers,
    }))
    .sort((left, right) => left.source.localeCompare(right.source) || left.client.localeCompare(right.client));
  const completedTrialUsers = firstTrialByUser.size;
  const stages = Object.fromEntries(
    [...STAGES].map((stage) => [stage, stageUsers.get(stage)?.size ?? 0]),
  ) as Record<McpFunnelStage, number>;
  return {
    window: {
      from: config.from.toISOString(),
      to: config.to.toISOString(),
      conversionWindowSeconds: config.conversionWindowSeconds,
      timeZone: 'UTC',
    },
    stages,
    completedTrialUsers,
    fundedAfterTrialUsers: convertedUsers.size,
    trialToWalletRate: completedTrialUsers === 0 ? null : convertedUsers.size / completedTrialUsers,
    cohorts: cohortSummaries,
  };
}

export async function getMcpFunnelSummary(
  config: McpFunnelSummaryConfig,
  deps: FunnelDeps = defaultDeps,
): Promise<McpFunnelSummary> {
  assertSummaryConfig(config);
  const queryTo = new Date(config.to.getTime() + config.conversionWindowSeconds * 1000);
  const rows = await deps.executor.query<FunnelSummaryRow>(
    `SELECT event_type, stage, user_id, occurred_at, source, acquisition_client, acquisition_id
       FROM mcp_funnel_events
      WHERE occurred_at >= $1
        AND occurred_at < $2
        AND event_type IN (
          'oauth_connection_completed',
          'trial_quote_prepared',
          'trial_generation_completed',
          'wallet_funded',
          'paid_generation_completed'
        )
      ORDER BY occurred_at ASC`,
    [config.from, queryTo],
  );
  return summarizeRows(rows, config);
}

const CONFIRMED_WALLET_KEYS = new Set([
  'receiptId', 'userId', 'amountCents', 'currency', 'occurredAt',
]);

export const MCP_TRIAL_TO_WALLET_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export function resolveMcpTrialToWalletWindowSeconds(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.MCP_FUNNEL_TRIAL_TO_WALLET_WINDOW_SECONDS?.trim();
  if (!raw) return MCP_TRIAL_TO_WALLET_WINDOW_SECONDS;
  if (!/^[1-9]\d*$/.test(raw)) return MCP_TRIAL_TO_WALLET_WINDOW_SECONDS;
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) && seconds <= 365 * 24 * 60 * 60
    ? seconds
    : MCP_TRIAL_TO_WALLET_WINDOW_SECONDS;
}

export async function recordConfirmedMcpWalletFunding(
  input: {
    receiptId: string;
    userId: string;
    amountCents: number;
    currency: string;
    occurredAt: Date;
  },
  options: FunnelDeps & { conversionWindowSeconds: number },
): Promise<boolean> {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, CONFIRMED_WALLET_KEYS)
    || typeof input.receiptId !== 'string'
    || !POSITIVE_PG_BIGINT_PATTERN.test(input.receiptId)
    || (input.receiptId.length === MAX_PG_BIGINT.length && input.receiptId > MAX_PG_BIGINT)
    || !boundedNullable(input.userId, 128)
    || !Number.isSafeInteger(input.amountCents)
    || input.amountCents <= 0
    || !CURRENCY_PATTERN.test(input.currency)
    || !(input.occurredAt instanceof Date)
    || !Number.isFinite(input.occurredAt.getTime())
    || !Number.isSafeInteger(options.conversionWindowSeconds)
    || options.conversionWindowSeconds <= 0
    || options.conversionWindowSeconds > 365 * 24 * 60 * 60) {
    return false;
  }
  const receiptHash = sha256(`mcp-funnel-wallet-v1:${input.receiptId}`);
  try {
    const rows = await options.executor.query<{ id: number }>(
      `WITH eligible_trial AS (
        SELECT user_id, oauth_client_id, acquisition_id, source, medium, campaign, acquisition_client
          FROM mcp_funnel_events
         WHERE user_id = $1
           AND event_type = 'trial_generation_completed'
           AND stage = 'trial_completed'
           AND occurred_at < $2
           AND occurred_at >= $2 - ($3 * INTERVAL '1 second')
         ORDER BY occurred_at DESC
         LIMIT 1
      )
      INSERT INTO mcp_funnel_events (
        event_type, stage, occurred_at, user_id, oauth_client_id, acquisition_id, quote_id,
        job_id, amount_cents, currency, source, medium, campaign, acquisition_client,
        idempotency_key, receipt_hash
      )
      SELECT
        'wallet_funded', 'wallet_funded', $2, user_id, oauth_client_id, acquisition_id,
        NULL, NULL, $5, $6, source, medium, campaign, acquisition_client, $7, $4
      FROM eligible_trial
      ON CONFLICT (receipt_hash) WHERE receipt_hash IS NOT NULL DO NOTHING
      RETURNING id`,
      [
        input.userId,
        input.occurredAt,
        options.conversionWindowSeconds,
        receiptHash,
        input.amountCents,
        input.currency,
        `wallet-funded:${receiptHash}`,
      ],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
