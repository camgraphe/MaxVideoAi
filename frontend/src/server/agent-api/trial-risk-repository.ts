import { query, type QueryExecutor } from '@/lib/db';

export type TrialRiskOutcome = 'allowed' | 'blocked' | 'rate_limited' | 'error';
export type TrialRiskScope = 'user' | 'oauth_client' | 'fingerprint' | 'global';

export type RecordTrialRiskEventInput = {
  userId: string;
  oauthClientId: string | null;
  riskFingerprintHash: string;
  outcome: TrialRiskOutcome;
  reasonCode: string;
};

export type CountTrialRiskEventsInput = {
  scope: TrialRiskScope;
  scopeValue: string | null;
  since: Date;
  outcomes: TrialRiskOutcome[];
};

export type CleanupTrialRiskEventsInput = { cutoff: Date; limit: number };

type RepositoryDependencies = { executor: QueryExecutor };
type RiskEventRow = { id: unknown; created_at: unknown };
type CountRow = { count: unknown };

const defaultDependencies: RepositoryDependencies = { executor: { query } };
const EVENT_KEYS = new Set([
  'userId', 'oauthClientId', 'riskFingerprintHash', 'outcome', 'reasonCode',
]);
const COUNT_KEYS = new Set(['scope', 'scopeValue', 'since', 'outcomes']);
const CLEANUP_KEYS = new Set(['cutoff', 'limit']);
const OUTCOMES = new Set<TrialRiskOutcome>(['allowed', 'blocked', 'rate_limited', 'error']);
const SCOPES = new Set<TrialRiskScope>(['user', 'oauth_client', 'fingerprint', 'global']);
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const REASON_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const MAX_CLEANUP_LIMIT = 1_000;

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

function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function assertEventInput(value: unknown): asserts value is RecordTrialRiskEventInput {
  const input = exactPlainRecord(value, EVENT_KEYS);
  if (!input
    || !boundedText(input.userId, 128)
    || !(input.oauthClientId === null || boundedText(input.oauthClientId, 256))
    || typeof input.riskFingerprintHash !== 'string'
    || !HASH_PATTERN.test(input.riskFingerprintHash)
    || typeof input.outcome !== 'string'
    || !OUTCOMES.has(input.outcome as TrialRiskOutcome)
    || typeof input.reasonCode !== 'string'
    || input.reasonCode.length > 64
    || !REASON_PATTERN.test(input.reasonCode)) {
    throw new Error('Invalid trial risk event input.');
  }
}

function assertCountInput(value: unknown): asserts value is CountTrialRiskEventsInput {
  const input = exactPlainRecord(value, COUNT_KEYS);
  const outcomes = input?.outcomes;
  if (!input
    || typeof input.scope !== 'string'
    || !SCOPES.has(input.scope as TrialRiskScope)
    || !finiteDate(input.since)
    || !Array.isArray(outcomes)
    || outcomes.length > OUTCOMES.size
    || !outcomes.every((outcome) => typeof outcome === 'string' && OUTCOMES.has(outcome as TrialRiskOutcome))
    || new Set(outcomes).size !== outcomes.length
    || (input.scope === 'global'
      ? input.scopeValue !== null
      : !boundedText(
        input.scopeValue,
        input.scope === 'fingerprint' ? 64 : input.scope === 'user' ? 128 : 256,
      ))
    || (input.scope === 'fingerprint' && !HASH_PATTERN.test(input.scopeValue as string))) {
    throw new Error('Invalid trial risk count input.');
  }
}

function assertCleanupInput(value: unknown): asserts value is CleanupTrialRiskEventsInput {
  const input = exactPlainRecord(value, CLEANUP_KEYS);
  if (!input
    || !finiteDate(input.cutoff)
    || !Number.isSafeInteger(input.limit)
    || (input.limit as number) < 1
    || (input.limit as number) > MAX_CLEANUP_LIMIT) {
    throw new Error('Invalid trial risk cleanup input.');
  }
}

function parseCount(rows: CountRow[]): number {
  if (rows.length !== 1
    || typeof rows[0]?.count !== 'string'
    || !/^\d+$/u.test(rows[0].count)) {
    throw new Error('Invalid trial risk count.');
  }
  const count = Number(rows[0].count);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid trial risk count.');
  return count;
}

function parseEventRow(rows: RiskEventRow[]): { id: string; createdAt: Date } {
  const value = rows[0];
  const createdAt = value ? finiteDate(value.created_at) : null;
  if (rows.length !== 1
    || !value
    || typeof value.id !== 'string'
    || !/^\d+$/u.test(value.id)
    || !createdAt) {
    throw new Error('Invalid trial risk event row.');
  }
  return { id: value.id, createdAt };
}

export async function recordTrialRiskEvent(
  input: RecordTrialRiskEventInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<{ id: string; createdAt: Date }> {
  assertEventInput(input);
  const rows = await dependencies.executor.query<RiskEventRow>(
    `INSERT INTO mcp_trial_risk_events (
       user_id, oauth_client_id, risk_fingerprint_hash, outcome, reason_code
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text AS id, created_at`,
    [input.userId, input.oauthClientId, input.riskFingerprintHash, input.outcome, input.reasonCode],
  );
  return parseEventRow(rows);
}

export async function countTrialRiskEvents(
  input: CountTrialRiskEventsInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<number> {
  assertCountInput(input);
  const column = input.scope === 'user'
    ? 'user_id'
    : input.scope === 'oauth_client'
      ? 'oauth_client_id'
      : input.scope === 'fingerprint'
        ? 'risk_fingerprint_hash'
        : null;
  const params: unknown[] = [new Date(input.since.getTime())];
  const filters = ['created_at >= $1'];
  if (column) {
    params.push(input.scopeValue);
    filters.push(`${column} = $${params.length}`);
  }
  if (input.outcomes.length > 0) {
    params.push([...input.outcomes]);
    filters.push(`outcome = ANY($${params.length}::text[])`);
  }
  const rows = await dependencies.executor.query<CountRow>(
    `SELECT count(*)::text AS count
       FROM mcp_trial_risk_events
      WHERE ${filters.join('\n        AND ')}`,
    params,
  );
  return parseCount(rows);
}

export async function cleanupTrialRiskEvents(
  input: CleanupTrialRiskEventsInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<number> {
  assertCleanupInput(input);
  const rows = await dependencies.executor.query<CountRow>(
    `SELECT cleanup_mcp_trial_risk_events($1, $2)::text AS count`,
    [new Date(input.cutoff.getTime()), input.limit],
  );
  return parseCount(rows);
}
