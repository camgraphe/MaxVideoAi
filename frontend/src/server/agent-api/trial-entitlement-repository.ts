import { query, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

export type TrialEntitlementStatus = 'available' | 'reserved' | 'consumed' | 'released';

export type TrialEntitlement = {
  userId: string;
  status: TrialEntitlementStatus;
  reservedQuoteId: string | null;
  jobId: string | null;
  reservedAt: Date | null;
  consumedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastReasonCode: string | null;
};

declare const lockedReservableEntitlementBrand: unique symbol;

export type LockedReservableEntitlement = TrialEntitlement & {
  readonly [lockedReservableEntitlementBrand]: 'locked-reservable-entitlement';
};

export type TrialEntitlementUserInput = { userId: string };
export type TrialEntitlementTransitionInput = TrialEntitlementUserInput & {
  quoteId: string;
  jobId: string;
  reasonCode: string;
};
export type ReserveEntitlementInput = {
  lockedEntitlement: LockedReservableEntitlement;
  quoteId: string;
  jobId: string;
  reasonCode: string;
};

type RepositoryDependencies = { executor: QueryExecutor };
type TransitionDependencies = { executor: TransactionQueryExecutor };

type EntitlementRow = {
  user_id: unknown;
  status: unknown;
  reserved_quote_id: unknown;
  job_id: unknown;
  reserved_at: unknown;
  consumed_at: unknown;
  released_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  last_reason_code: unknown;
};

const defaultDependencies: RepositoryDependencies = { executor: { query } };
const USER_KEYS = new Set(['userId']);
const TRANSITION_KEYS = new Set(['userId', 'quoteId', 'jobId', 'reasonCode']);
const RESERVE_KEYS = new Set(['lockedEntitlement', 'quoteId', 'jobId', 'reasonCode']);
const ENTITLEMENT_DTO_KEYS = new Set([
  'userId', 'status', 'reservedQuoteId', 'jobId', 'reservedAt', 'consumedAt',
  'releasedAt', 'createdAt', 'updatedAt', 'lastReasonCode',
]);
const STATUSES = new Set<TrialEntitlementStatus>([
  'available', 'reserved', 'consumed', 'released',
]);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REASON_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$/u;

const ENTITLEMENT_COLUMNS = `
  user_id, status, reserved_quote_id, job_id, reserved_at, consumed_at,
  released_at, created_at, updated_at, last_reason_code
`;

function exactPlainRecord(value: unknown, expectedKeys: ReadonlySet<string>): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== expectedKeys.size || !keys.every((key) => expectedKeys.has(key))) return null;
  if (keys.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]!))) return null;
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value])) as Record<string, unknown>;
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim();
}

function nullableBoundedText(value: unknown, maxLength: number): value is string | null {
  return value === null || boundedText(value, maxLength);
}

function boundedIdentifier(value: unknown, maxLength: number): value is string {
  return boundedText(value, maxLength) && IDENTIFIER_PATTERN.test(value);
}

function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function nullableDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  return finiteDate(value) ?? undefined;
}

function assertUserInput(value: unknown): asserts value is TrialEntitlementUserInput {
  const input = exactPlainRecord(value, USER_KEYS);
  if (!input || !boundedIdentifier(input.userId, 128)) {
    throw new Error('Invalid entitlement input.');
  }
}

function assertTransitionInput(value: unknown): asserts value is TrialEntitlementTransitionInput {
  const input = exactPlainRecord(value, TRANSITION_KEYS);
  if (!input
    || !boundedIdentifier(input.userId, 128)
    || typeof input.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(input.quoteId)
    || !boundedIdentifier(input.jobId, 256)
    || typeof input.reasonCode !== 'string'
    || input.reasonCode.length > 64
    || !REASON_PATTERN.test(input.reasonCode)) {
    throw new Error('Invalid entitlement transition input.');
  }
}

function parseEntitlementValue(value: unknown): TrialEntitlement | null {
  const input = exactPlainRecord(value, ENTITLEMENT_DTO_KEYS);
  if (!input) return null;
  try {
    return parseEntitlementRow({
      user_id: input.userId,
      status: input.status,
      reserved_quote_id: input.reservedQuoteId,
      job_id: input.jobId,
      reserved_at: input.reservedAt,
      consumed_at: input.consumedAt,
      released_at: input.releasedAt,
      created_at: input.createdAt,
      updated_at: input.updatedAt,
      last_reason_code: input.lastReasonCode,
    });
  } catch {
    return null;
  }
}

function parseReserveInput(value: unknown): {
  lockedEntitlement: TrialEntitlement;
  quoteId: string;
  jobId: string;
  reasonCode: string;
} {
  const input = exactPlainRecord(value, RESERVE_KEYS);
  const lockedEntitlement = input ? parseEntitlementValue(input.lockedEntitlement) : null;
  if (!input
    || !lockedEntitlement
    || (lockedEntitlement.status !== 'available' && lockedEntitlement.status !== 'released')
    || typeof input.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(input.quoteId)
    || !boundedIdentifier(input.jobId, 256)
    || typeof input.reasonCode !== 'string'
    || input.reasonCode.length > 64
    || !REASON_PATTERN.test(input.reasonCode)) {
    throw new Error('Invalid entitlement transition input.');
  }
  return {
    lockedEntitlement,
    quoteId: input.quoteId,
    jobId: input.jobId,
    reasonCode: input.reasonCode,
  };
}

function parseEntitlementRow(row: EntitlementRow): TrialEntitlement {
  const reservedAt = nullableDate(row.reserved_at);
  const consumedAt = nullableDate(row.consumed_at);
  const releasedAt = nullableDate(row.released_at);
  const createdAt = finiteDate(row.created_at);
  const updatedAt = finiteDate(row.updated_at);
  if (!boundedIdentifier(row.user_id, 128)
    || typeof row.status !== 'string'
    || !STATUSES.has(row.status as TrialEntitlementStatus)
    || !(row.reserved_quote_id === null
      || (typeof row.reserved_quote_id === 'string' && UUID_V4_PATTERN.test(row.reserved_quote_id)))
    || !(row.job_id === null || boundedIdentifier(row.job_id, 256))
    || reservedAt === undefined
    || consumedAt === undefined
    || releasedAt === undefined
    || !createdAt
    || !updatedAt
    || !nullableBoundedText(row.last_reason_code, 64)
    || (row.last_reason_code !== null && !REASON_PATTERN.test(row.last_reason_code))
    || updatedAt < createdAt) {
    throw new Error('Invalid entitlement row.');
  }

  const hasReservation = row.reserved_quote_id !== null && row.job_id !== null && reservedAt !== null;
  const reservationTimesValid = reservedAt === null
    || (reservedAt >= createdAt && reservedAt <= updatedAt);
  const consumedTimeValid = consumedAt === null
    || (reservedAt !== null && consumedAt >= reservedAt && consumedAt <= updatedAt);
  const releasedTimeValid = releasedAt === null
    || (reservedAt !== null && releasedAt >= reservedAt && releasedAt <= updatedAt);
  const state = row.status as TrialEntitlementStatus;
  const shapeValid = state === 'available'
    ? row.reserved_quote_id === null && row.job_id === null
      && reservedAt === null && consumedAt === null && releasedAt === null
    : state === 'reserved'
      ? hasReservation && consumedAt === null && releasedAt === null
      : state === 'consumed'
        ? hasReservation && consumedAt !== null && releasedAt === null
        : hasReservation && consumedAt === null && releasedAt !== null;
  if (!reservationTimesValid || !consumedTimeValid || !releasedTimeValid || !shapeValid) {
    throw new Error('Invalid entitlement row.');
  }

  return {
    userId: row.user_id,
    status: state,
    reservedQuoteId: row.reserved_quote_id,
    jobId: row.job_id,
    reservedAt,
    consumedAt,
    releasedAt,
    createdAt,
    updatedAt,
    lastReasonCode: row.last_reason_code,
  };
}

function parseOptionalEntitlement(rows: EntitlementRow[]): TrialEntitlement | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Invalid entitlement repository result.');
  return parseEntitlementRow(rows[0]!);
}

export async function ensureEntitlement(
  input: TrialEntitlementUserInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<TrialEntitlement> {
  assertUserInput(input);
  const rows = await dependencies.executor.query<EntitlementRow>(
    `INSERT INTO mcp_trial_entitlements (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING ${ENTITLEMENT_COLUMNS}`,
    [input.userId],
  );
  const entitlement = parseOptionalEntitlement(rows);
  if (!entitlement) throw new Error('Trial entitlement was not persisted.');
  return entitlement;
}

export async function getTrialStatus(
  input: TrialEntitlementUserInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<TrialEntitlement | null> {
  assertUserInput(input);
  const rows = await dependencies.executor.query<EntitlementRow>(
    `SELECT ${ENTITLEMENT_COLUMNS}
       FROM mcp_trial_entitlements
      WHERE user_id = $1`,
    [input.userId],
  );
  return parseOptionalEntitlement(rows);
}

export async function lockReservableEntitlement(
  input: TrialEntitlementUserInput,
  dependencies: TransitionDependencies,
): Promise<LockedReservableEntitlement | null> {
  assertUserInput(input);
  await dependencies.executor.query(
    `INSERT INTO mcp_trial_entitlements (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [input.userId],
  );
  const rows = await dependencies.executor.query<EntitlementRow>(
    `SELECT ${ENTITLEMENT_COLUMNS}
       FROM mcp_trial_entitlements
      WHERE user_id = $1
        AND status IN ('available', 'released')
      FOR UPDATE`,
    [input.userId],
  );
  return parseOptionalEntitlement(rows) as LockedReservableEntitlement | null;
}

export async function reserveEntitlement(
  input: ReserveEntitlementInput,
  dependencies: TransitionDependencies,
): Promise<TrialEntitlement | null> {
  const normalized = parseReserveInput(input);
  const locked = normalized.lockedEntitlement;
  const rows = await dependencies.executor.query<EntitlementRow>(
    `WITH transition_time AS (
       SELECT clock_timestamp() AS at
     )
     UPDATE mcp_trial_entitlements AS entitlement
        SET status = 'reserved', reserved_quote_id = $2, job_id = $3,
            reserved_at = transition_time.at, consumed_at = NULL, released_at = NULL,
            updated_at = transition_time.at, last_reason_code = $4
       FROM transition_time
      WHERE entitlement.user_id = $1
        AND entitlement.status = $5
        AND entitlement.reserved_quote_id IS NOT DISTINCT FROM $6
        AND entitlement.job_id IS NOT DISTINCT FROM $7
     RETURNING ${ENTITLEMENT_COLUMNS}`,
    [
      locked.userId, normalized.quoteId, normalized.jobId, normalized.reasonCode,
      locked.status, locked.reservedQuoteId, locked.jobId,
    ],
  );
  return parseOptionalEntitlement(rows);
}

async function transitionToTerminal(
  target: 'consumed' | 'released',
  input: TrialEntitlementTransitionInput,
  dependencies: TransitionDependencies,
): Promise<TrialEntitlement | null> {
  assertTransitionInput(input);
  const timestampColumn = target === 'consumed' ? 'consumed_at' : 'released_at';
  const oppositeColumn = target === 'consumed' ? 'released_at' : 'consumed_at';
  const rows = await dependencies.executor.query<EntitlementRow>(
    `WITH transition_time AS (
       SELECT clock_timestamp() AS at
     ), transitioned AS (
       UPDATE mcp_trial_entitlements AS entitlement
          SET status = '${target}', ${timestampColumn} = transition_time.at,
              ${oppositeColumn} = NULL, updated_at = transition_time.at,
              last_reason_code = $4
         FROM transition_time
        WHERE entitlement.user_id = $1
          AND entitlement.reserved_quote_id = $2
          AND entitlement.job_id = $3
          AND entitlement.status = 'reserved'
       RETURNING ${ENTITLEMENT_COLUMNS}
     )
     SELECT * FROM transitioned
     UNION ALL
     SELECT ${ENTITLEMENT_COLUMNS}
       FROM mcp_trial_entitlements
      WHERE user_id = $1
        AND reserved_quote_id = $2
        AND job_id = $3
        AND status = '${target}'
        AND NOT EXISTS (SELECT 1 FROM transitioned)
     LIMIT 1`,
    [input.userId, input.quoteId, input.jobId, input.reasonCode],
  );
  return parseOptionalEntitlement(rows);
}

export async function consumeEntitlement(
  input: TrialEntitlementTransitionInput,
  dependencies: TransitionDependencies,
): Promise<TrialEntitlement | null> {
  return transitionToTerminal('consumed', input, dependencies);
}

export async function releaseEntitlement(
  input: TrialEntitlementTransitionInput,
  dependencies: TransitionDependencies,
): Promise<TrialEntitlement | null> {
  return transitionToTerminal('released', input, dependencies);
}
