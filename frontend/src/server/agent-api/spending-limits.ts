import type { QueryExecutor, TransactionQueryExecutor } from '@/lib/db';

export const MCP_SPENDING_APPROVAL_PATH = '/account/connections?focus=mcp-spending';

export type McpSpendingLimits = {
  perGenerationCents: number | null;
  dailyCents: number | null;
  webApprovalAboveCents: number | null;
};

export type McpSpendingSettings = McpSpendingLimits & {
  paidGenerationEnabled: boolean;
  updatedAt: string;
};

export type McpSpendingSettingsUpdate = Omit<McpSpendingSettings, 'updatedAt'>;

export class McpSpendingSettingsInputError extends Error {
  constructor() {
    super('Invalid MCP spending settings.');
    this.name = 'McpSpendingSettingsInputError';
  }
}

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
      reason: 'paid_generation_disabled' | 'per_generation' | 'daily' | 'web_approval';
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
  executor: TransactionQueryExecutor;
};

type SpendingLimitsRow = {
  paid_generation_enabled: unknown;
  per_generation_cents: unknown;
  daily_cents: unknown;
  web_approval_above_cents: unknown;
};

type SpendingSettingsRow = SpendingLimitsRow & {
  updated_at: unknown;
};

type AcceptedSpendingRow = {
  accepted_today_cents: unknown;
};

const INPUT_KEYS = new Set(['userId', 'priceCents', 'currency']);
const SETTINGS_KEYS = new Set([
  'paidGenerationEnabled',
  'perGenerationCents',
  'dailyCents',
  'webApprovalAboveCents',
]);
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const MAX_INTEGER_CENTS = 2_147_483_647;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isExactDataRecord(value: unknown, keys: ReadonlySet<string>): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === keys.size
    && actualKeys.every((key) => typeof key === 'string' && keys.has(key))
    && actualKeys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor?.enumerable && 'value' in descriptor);
    });
}

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== 'string'
    || value.length < 1
    || value.length > 128
    || value !== value.trim()) {
    throw new McpSpendingSettingsInputError();
  }
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

function parseNullableCents(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > MAX_INTEGER_CENTS) {
    throw new Error('Invalid spending limit row.');
  }
  return value as number;
}

function parseUpdatedAt(value: unknown): string {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Invalid spending limit row.');
  const iso = date.toISOString();
  if (!(value instanceof Date) && value !== iso) throw new Error('Invalid spending limit row.');
  return iso;
}

function parseSettingsRow(row: SpendingSettingsRow): McpSpendingSettings {
  if (typeof row.paid_generation_enabled !== 'boolean') {
    throw new Error('Invalid spending limit row.');
  }
  return {
    paidGenerationEnabled: row.paid_generation_enabled,
    perGenerationCents: parseNullableCents(row.per_generation_cents),
    dailyCents: parseNullableCents(row.daily_cents),
    webApprovalAboveCents: parseNullableCents(row.web_approval_above_cents),
    updatedAt: parseUpdatedAt(row.updated_at),
  };
}

export function normalizeMcpSpendingSettingsUpdate(value: unknown): McpSpendingSettingsUpdate {
  if (!isExactDataRecord(value, SETTINGS_KEYS)
    || typeof value.paidGenerationEnabled !== 'boolean') {
    throw new McpSpendingSettingsInputError();
  }
  let perGenerationCents: number | null;
  let dailyCents: number | null;
  let webApprovalAboveCents: number | null;
  try {
    perGenerationCents = parseNullableCents(value.perGenerationCents);
    dailyCents = parseNullableCents(value.dailyCents);
    webApprovalAboveCents = parseNullableCents(value.webApprovalAboveCents);
  } catch {
    throw new McpSpendingSettingsInputError();
  }
  return {
    paidGenerationEnabled: value.paidGenerationEnabled,
    perGenerationCents,
    dailyCents,
    webApprovalAboveCents,
  };
}

export async function getMcpSpendingSettings(
  userId: string,
  dependencies: { executor: QueryExecutor },
): Promise<McpSpendingSettings> {
  assertUserId(userId);
  const rows = await dependencies.executor.query<SpendingSettingsRow>(
    `INSERT INTO mcp_spending_limits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE
       SET updated_at = mcp_spending_limits.updated_at
     RETURNING paid_generation_enabled, per_generation_cents, daily_cents,
               web_approval_above_cents, updated_at`,
    [userId],
  );
  if (rows.length !== 1) throw new Error('Invalid spending limit row.');
  return parseSettingsRow(rows[0]);
}

export async function updateMcpSpendingSettings(
  userId: string,
  input: McpSpendingSettingsUpdate,
  dependencies: { executor: QueryExecutor },
): Promise<McpSpendingSettings> {
  assertUserId(userId);
  const normalized = normalizeMcpSpendingSettingsUpdate(input);
  const rows = await dependencies.executor.query<SpendingSettingsRow>(
    `INSERT INTO mcp_spending_limits (
       user_id, paid_generation_enabled, per_generation_cents, daily_cents,
       web_approval_above_cents, updated_at
     ) VALUES ($1, $2, $3, $4, $5, clock_timestamp())
     ON CONFLICT (user_id) DO UPDATE
       SET paid_generation_enabled = EXCLUDED.paid_generation_enabled,
           per_generation_cents = EXCLUDED.per_generation_cents,
           daily_cents = EXCLUDED.daily_cents,
           web_approval_above_cents = EXCLUDED.web_approval_above_cents,
           updated_at = clock_timestamp()
     RETURNING paid_generation_enabled, per_generation_cents, daily_cents,
               web_approval_above_cents, updated_at`,
    [
      userId,
      normalized.paidGenerationEnabled,
      normalized.perGenerationCents,
      normalized.dailyCents,
      normalized.webApprovalAboveCents,
    ],
  );
  if (rows.length !== 1) throw new Error('Invalid spending limit row.');
  return parseSettingsRow(rows[0]);
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
  reason: 'paid_generation_disabled' | 'per_generation' | 'daily' | 'web_approval',
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

async function checkSpendingLimits(
  input: SpendingCheckInput,
  dependencies: SpendingDependencies,
  includeClaimed: boolean,
): Promise<McpSpendingDecision> {
  assertInput(input);
  // The no-op conflict update is intentional: it ensures and locks one account scope
  // before the next READ COMMITTED statement calculates accepted spend.
  const limitRows = await dependencies.executor.query<SpendingLimitsRow>(
    `INSERT INTO mcp_spending_limits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE
       SET updated_at = mcp_spending_limits.updated_at
     RETURNING paid_generation_enabled, per_generation_cents, daily_cents,
               web_approval_above_cents`,
    [input.userId],
  );
  if (limitRows.length !== 1) throw new Error('Invalid spending limit row.');
  if (typeof limitRows[0].paid_generation_enabled !== 'boolean') {
    throw new Error('Invalid spending limit row.');
  }
  const limits: McpSpendingLimits = {
    perGenerationCents: parseNullableCents(limitRows[0].per_generation_cents),
    dailyCents: parseNullableCents(limitRows[0].daily_cents),
    webApprovalAboveCents: parseNullableCents(limitRows[0].web_approval_above_cents),
  };
  if (!limitRows[0].paid_generation_enabled) {
    return exceeded('paid_generation_disabled', 0, input.priceCents, limits);
  }

  const statePredicate = includeClaimed
    ? "state IN ('claimed', 'accepted')"
    : "state = 'accepted'";
  const spendingRows = await dependencies.executor.query<AcceptedSpendingRow>(
    `WITH spending_clock AS (
       SELECT clock_timestamp() AS spending_now
     )
     SELECT COALESCE(SUM(price_cents), 0)::text AS accepted_today_cents
       FROM mcp_generation_quotes
       CROSS JOIN spending_clock
      WHERE user_id = $1
        AND currency = $2
        AND funding_mode = 'wallet'
        AND ${statePredicate}
        AND claimed_at >= (
          date_trunc('day', spending_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
         )
        AND claimed_at <= spending_now`,
    [input.userId, input.currency],
  );
  if (spendingRows.length !== 1) throw new Error('Invalid spending limit row.');
  const acceptedTodayCents = parseAcceptedCents(spendingRows[0].accepted_today_cents);
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

export async function checkMcpSpendingLimits(
  input: SpendingCheckInput,
  dependencies: SpendingDependencies,
): Promise<McpSpendingDecision> {
  return checkSpendingLimits(input, dependencies, false);
}

export async function checkMcpConfirmationSpendingLimits(
  input: SpendingCheckInput,
  dependencies: SpendingDependencies,
): Promise<McpSpendingDecision> {
  return checkSpendingLimits(input, dependencies, true);
}
