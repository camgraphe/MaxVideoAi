import { query, type QueryExecutor } from '@/lib/db';

export const MCP_SPENDING_APPROVAL_PATH = '/account/connections?focus=mcp-spending';

export type McpSpendingLimits = {
  perGenerationCents: number | null;
  dailyCents: number | null;
  webApprovalAboveCents: number | null;
};

export type McpSpendingDecision =
  | {
      allowed: true;
      acceptedTodayCents: number;
      projectedTodayCents: number;
      limits: McpSpendingLimits;
    }
  | {
      allowed: false;
      code: 'SPENDING_LIMIT_EXCEEDED';
      reason: 'per_generation' | 'daily' | 'web_approval';
      message: string;
      approvalUrl: string;
      acceptedTodayCents: number;
      projectedTodayCents: number;
      limits: McpSpendingLimits;
    };

type SpendingCheckInput = {
  userId: string;
  priceCents: number;
  currency: string;
};

type SpendingDependencies = {
  executor: QueryExecutor;
  now?: () => Date;
};

type SpendingRow = {
  per_generation_cents: unknown;
  daily_cents: unknown;
  web_approval_above_cents: unknown;
  accepted_today_cents: unknown;
};

const defaultDependencies: SpendingDependencies = {
  executor: { query },
  now: () => new Date(),
};
const INPUT_KEYS = new Set(['userId', 'priceCents', 'currency']);
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const MAX_INTEGER_CENTS = 2_147_483_647;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertInput(value: unknown): asserts value is SpendingCheckInput {
  if (!isRecord(value)
    || Object.keys(value).length !== INPUT_KEYS.size
    || !Object.keys(value).every((key) => INPUT_KEYS.has(key))
    || typeof value.userId !== 'string'
    || value.userId.length < 1
    || value.userId.length > 128
    || value.userId !== value.userId.trim()
    || !Number.isSafeInteger(value.priceCents)
    || (value.priceCents as number) < 0
    || (value.priceCents as number) > MAX_INTEGER_CENTS
    || typeof value.currency !== 'string'
    || !CURRENCY_PATTERN.test(value.currency)) {
    throw new Error('Invalid spending check input.');
  }
}

function requireNow(dependencies: SpendingDependencies): Date {
  const value = (dependencies.now ?? defaultDependencies.now)?.();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Invalid spending check clock.');
  }
  return new Date(value.getTime());
}

function parseNullableCents(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > MAX_INTEGER_CENTS) {
    throw new Error('Invalid spending limit row.');
  }
  return value as number;
}

function parseAcceptedCents(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new Error('Invalid spending limit row.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Invalid spending limit row.');
  }
  return parsed;
}

function exceeded(
  reason: 'per_generation' | 'daily' | 'web_approval',
  acceptedTodayCents: number,
  projectedTodayCents: number,
  limits: McpSpendingLimits,
): McpSpendingDecision {
  return {
    allowed: false,
    code: 'SPENDING_LIMIT_EXCEEDED',
    reason,
    message: 'This generation is above the spending controls configured in MaxVideoAI.',
    approvalUrl: MCP_SPENDING_APPROVAL_PATH,
    acceptedTodayCents,
    projectedTodayCents,
    limits,
  };
}

export async function checkMcpSpendingLimits(
  input: SpendingCheckInput,
  dependencies: SpendingDependencies = defaultDependencies,
): Promise<McpSpendingDecision> {
  assertInput(input);
  const now = requireNow(dependencies);
  const rows = await dependencies.executor.query<SpendingRow>(
    `WITH locked_limits AS MATERIALIZED (
      SELECT per_generation_cents, daily_cents, web_approval_above_cents
        FROM mcp_spending_limits
       WHERE user_id = $1
       FOR UPDATE
    ), accepted_spend AS (
      SELECT COALESCE(SUM(price_cents), 0)::text AS accepted_today_cents
        FROM mcp_generation_quotes
       WHERE user_id = $1
         AND currency = $2
         AND funding_mode = 'wallet'
         AND state = 'accepted'
         AND claimed_at >= (
           date_trunc('day', $3::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
         )
         AND claimed_at <= $3
    )
    SELECT limits.per_generation_cents,
           limits.daily_cents,
           limits.web_approval_above_cents,
           accepted_spend.accepted_today_cents
      FROM accepted_spend
      LEFT JOIN locked_limits AS limits ON TRUE`,
    [input.userId, input.currency, now],
  );
  if (rows.length !== 1) throw new Error('Invalid spending limit row.');
  const limits: McpSpendingLimits = {
    perGenerationCents: parseNullableCents(rows[0].per_generation_cents),
    dailyCents: parseNullableCents(rows[0].daily_cents),
    webApprovalAboveCents: parseNullableCents(rows[0].web_approval_above_cents),
  };
  const acceptedTodayCents = parseAcceptedCents(rows[0].accepted_today_cents);
  const projectedTodayCents = acceptedTodayCents + input.priceCents;
  if (!Number.isSafeInteger(projectedTodayCents)) {
    throw new Error('Spending amount overflow.');
  }

  if (limits.perGenerationCents !== null && input.priceCents > limits.perGenerationCents) {
    return exceeded('per_generation', acceptedTodayCents, projectedTodayCents, limits);
  }
  if (limits.dailyCents !== null && projectedTodayCents > limits.dailyCents) {
    return exceeded('daily', acceptedTodayCents, projectedTodayCents, limits);
  }
  if (limits.webApprovalAboveCents !== null && input.priceCents > limits.webApprovalAboveCents) {
    return exceeded('web_approval', acceptedTodayCents, projectedTodayCents, limits);
  }
  return { allowed: true, acceptedTodayCents, projectedTodayCents, limits };
}
